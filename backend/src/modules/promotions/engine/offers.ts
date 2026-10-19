import { round2, shippingFor } from './shipping';
import {
  AppliedOffer, Discount, Offer, OfferKind, PricedProduct, Quote, QuoteInput, QuoteLine,
} from './types';

/**
 * Amazon-style offer stacking, applied in this order:
 *
 *  1. Item deal: the single best of Lightning Deal, Deal of the Day, Festival
 *     Sale or Category Sale lowers the item price. Deals never stack with
 *     each other. Lightning deals only cover the units still unclaimed.
 *  2. Clip coupon: coupons the shopper ticked on the product page, best one
 *     per item, on top of the deal price.
 *  3. Promo code: one code per order, on eligible items, with minimum order
 *     and a cap.
 *  4. Bank offer: instant discount for paying online with a matching bank /
 *     card type, on what is left after the coupon.
 *  5. Shipping: the existing rule on the post-deal subtotal.
 */

export const ITEM_DEAL_KINDS: OfferKind[] = ['LIGHTNING_DEAL', 'DEAL_OF_THE_DAY', 'FESTIVAL_SALE', 'CATEGORY_SALE'];
const DEAL_RANK: Record<string, number> = { LIGHTNING_DEAL: 0, DEAL_OF_THE_DAY: 1, FESTIVAL_SALE: 2, CATEGORY_SALE: 3 };

export function isLive(o: Offer, now: Date): boolean {
  return o.isActive && new Date(o.startsAt).getTime() <= now.getTime() && now.getTime() < new Date(o.endsAt).getTime();
}

export function isUpcoming(o: Offer, now: Date): boolean {
  return o.isActive && new Date(o.startsAt).getTime() > now.getTime();
}

/** Units / redemptions left; Infinity when unlimited. */
export function remaining(o: Offer): number {
  return o.stockLimit == null ? Infinity : Math.max(0, o.stockLimit - (o.claimedCount ?? 0));
}

/** 0-100, for the "x% claimed" bar. */
export function claimedPercent(o: Offer): number {
  if (!o.stockLimit) return 0;
  return Math.min(100, Math.round(((o.claimedCount ?? 0) / o.stockLimit) * 100));
}

export function inScope(o: Offer, p: Pick<PricedProduct, 'id' | 'categoryId'>): boolean {
  const ids = o.scope?.productIds ?? [];
  const cats = o.scope?.categoryIds ?? [];
  if (!ids.length && !cats.length) return true;
  return ids.includes(p.id) || (!!p.categoryId && cats.includes(p.categoryId));
}

export function discountAmount(base: number, d: Discount): number {
  if (base <= 0) return 0;
  const raw = d.type === 'PERCENT' ? (base * d.value) / 100 : d.value;
  const capped = d.type === 'PERCENT' && d.maxDiscount ? Math.min(raw, d.maxDiscount) : raw;
  return round2(Math.max(0, Math.min(base, capped)));
}

export function priceAfter(price: number, d: Discount): number {
  return round2(price - discountAmount(price, d));
}

function userLeft(o: Offer, usage?: Record<string, number>): number {
  if (!o.perUserLimit) return Infinity;
  return Math.max(0, o.perUserLimit - (usage?.[o.id] ?? 0));
}

export interface DealPrice {
  offer: Offer;
  unitPrice: number;
  /** Units this deal can cover for this shopper right now. */
  units: number;
}

/** Live item deals for a product, best price first. */
export function itemDeals(p: PricedProduct, offers: Offer[], now: Date, usage?: Record<string, number>): DealPrice[] {
  return offers
    .filter((o) => ITEM_DEAL_KINDS.includes(o.kind) && isLive(o, now) && inScope(o, p))
    .map((o) => ({ offer: o, unitPrice: priceAfter(p.price, o.discount), units: Math.min(remaining(o), userLeft(o, usage)) }))
    .filter((d) => d.units > 0 && d.unitPrice < p.price)
    .sort((a, b) => a.unitPrice - b.unitPrice || DEAL_RANK[a.offer.kind] - DEAL_RANK[b.offer.kind]);
}

export function bestDeal(p: PricedProduct, offers: Offer[], now: Date, usage?: Record<string, number>): DealPrice | null {
  return itemDeals(p, offers, now, usage)[0] ?? null;
}

const applied = (o: Offer, amount: number, extra: Partial<AppliedOffer> = {}): AppliedOffer => ({
  offerId: o.id, kind: o.kind, title: o.title, amount: round2(amount), code: o.code ?? null, ...extra,
});

/** Price a basket. Pure: the API calls this inside the order transaction. */
export function quote(input: QuoteInput): Quote {
  const { offers, now, usage } = input;
  const messages: string[] = [];
  const appliedOffers: AppliedOffer[] = [];
  const clipped = new Set(input.clippedCouponIds ?? []);
  const clipCoupons = offers.filter((o) => o.kind === 'COUPON' && o.clip && clipped.has(o.id) && isLive(o, now) && remaining(o) > 0 && userLeft(o, usage) > 0);

  // 1 + 2. item deals and clip coupons
  const lines: QuoteLine[] = input.lines.map(({ product: p, quantity }) => {
    const deals = itemDeals(p, offers, now, usage);
    let lineTotal = 0;
    let left = quantity;
    let deal: AppliedOffer | null = null;
    // Walk deals best-first so limited lightning units fall back to the next best deal.
    for (const d of deals) {
      if (left <= 0) break;
      const units = Math.min(left, d.units);
      lineTotal += units * d.unitPrice;
      left -= units;
      if (!deal) {
        deal = applied(d.offer, (p.price - d.unitPrice) * units, d.offer.kind === 'LIGHTNING_DEAL' ? { units } : {});
        if (units < quantity && d.offer.kind === 'LIGHTNING_DEAL') {
          messages.push(`Lightning deal price applies to ${units} of ${quantity} units.`);
        }
      } else {
        deal.amount = round2(deal.amount + (p.price - d.unitPrice) * units);
      }
    }
    lineTotal = round2(lineTotal + left * p.price);
    const unitPrice = deals[0]?.unitPrice ?? p.price;

    let clipDiscount = 0;
    const clip = clipCoupons
      .filter((c) => inScope(c, p))
      .map((c) => ({ c, amount: discountAmount(lineTotal, c.discount) }))
      .sort((a, b) => b.amount - a.amount)[0];
    if (clip && clip.amount > 0) {
      clipDiscount = clip.amount;
      lineTotal = round2(lineTotal - clipDiscount);
      const prev = appliedOffers.find((a) => a.offerId === clip.c.id);
      if (prev) prev.amount = round2(prev.amount + clipDiscount);
      else appliedOffers.push(applied(clip.c, clipDiscount));
    }

    return { productId: p.id, quantity, listPrice: p.price, unitPrice, mrp: p.mrp ?? null, deal, clipDiscount, lineTotal };
  });

  for (const l of lines) if (l.deal) appliedOffers.unshift(l.deal);
  const itemsTotal = round2(input.lines.reduce((s, l) => s + l.product.price * l.quantity, 0));
  const subtotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
  const dealDiscount = round2(lines.reduce((s, l) => s + (l.deal?.amount ?? 0), 0));

  // 3. promo code
  let couponDiscount = 0;
  let couponError: string | undefined;
  const code = input.couponCode?.trim().toUpperCase();
  if (code) {
    const c = offers.find((o) => o.kind === 'COUPON' && !o.clip && (o.code ?? '').toUpperCase() === code);
    const eligible = c ? round2(lines.filter((l) => inScope(c, productOf(input, l.productId))).reduce((s, l) => s + l.lineTotal, 0)) : 0;
    if (!c || !c.isActive) couponError = `"${code}" is not a valid coupon code.`;
    else if (new Date(c.startsAt) > now) couponError = `"${code}" starts ${new Date(c.startsAt).toLocaleDateString('en-IN')}.`;
    else if (!isLive(c, now)) couponError = `"${code}" has expired.`;
    else if (remaining(c) <= 0) couponError = `"${code}" has been fully redeemed.`;
    else if (userLeft(c, usage) <= 0) couponError = `You have already used "${code}".`;
    else if (eligible <= 0) couponError = `"${code}" does not apply to the items in your cart.`;
    else if (c.minOrder && eligible < c.minOrder) couponError = `Add ₹${round2(c.minOrder - eligible)} more of eligible items to use "${code}".`;
    else {
      couponDiscount = discountAmount(eligible, c.discount);
      appliedOffers.push(applied(c, couponDiscount));
    }
  }

  // 4. bank offer
  let bankDiscount = 0;
  const pay = input.payment;
  if (pay?.method === 'ONLINE' && pay.bank) {
    const base = round2(subtotal - couponDiscount);
    const candidates = offers.filter(
      (o) => o.kind === 'BANK_OFFER' && isLive(o, now) && remaining(o) > 0 && userLeft(o, usage) > 0 &&
        (o.bank ?? '').toLowerCase() === pay.bank!.toLowerCase() &&
        (!o.cardType || o.cardType === 'ANY' || o.cardType === pay.cardType),
    );
    const best = candidates
      .filter((o) => !o.minOrder || base >= o.minOrder)
      .map((o) => ({ o, amount: discountAmount(base, o.discount) }))
      .sort((a, b) => b.amount - a.amount)[0];
    if (best && best.amount > 0) {
      bankDiscount = best.amount;
      appliedOffers.push(applied(best.o, bankDiscount));
    } else if (candidates.length) {
      const min = Math.min(...candidates.map((o) => o.minOrder ?? 0));
      messages.push(`Add ₹${round2(min - base)} more to get the ${pay.bank} bank offer.`);
    }
  }

  // 5. shipping
  const { shippingFee } = shippingFor(subtotal, input.lines.map((l) => ({ freeShipping: !!l.product.freeShipping })));
  const clipTotal = round2(lines.reduce((s, l) => s + l.clipDiscount, 0));
  const discount = round2(dealDiscount + clipTotal + couponDiscount + bankDiscount);
  const total = round2(Math.max(0, subtotal - couponDiscount - bankDiscount) + shippingFee);

  return {
    lines, itemsTotal, dealDiscount, couponDiscount, bankDiscount, discount, subtotal, shippingFee, total,
    applied: appliedOffers, messages, couponError,
  };
}

function productOf(input: QuoteInput, id: string): PricedProduct {
  return input.lines.find((l) => l.product.id === id)!.product;
}

/** Everything a product page shows in its "Offers" strip. */
export function productOffers(p: PricedProduct, offers: Offer[], now: Date) {
  const deal = bestDeal(p, offers, now);
  const live = offers.filter((o) => isLive(o, now));
  return {
    deal,
    clipCoupons: live.filter((o) => o.kind === 'COUPON' && o.clip && remaining(o) > 0 && inScope(o, p)),
    codeCoupons: live.filter((o) => o.kind === 'COUPON' && !o.clip && o.code && remaining(o) > 0 && inScope(o, p)),
    bankOffers: live.filter((o) => o.kind === 'BANK_OFFER' && remaining(o) > 0),
    /** Lightning deals for this product that start later. */
    upcoming: offers.filter((o) => o.kind === 'LIGHTNING_DEAL' && isUpcoming(o, now) && inScope(o, p)),
  };
}

/** Admin form validation; returns readable errors. */
export function validateOffer(o: Partial<Offer>): string[] {
  const e: string[] = [];
  if (!o.kind) e.push('Choose an offer type');
  if (!o.title?.trim()) e.push('Title is required');
  if (!o.discount || !(o.discount.value > 0)) e.push('Discount must be more than 0');
  if (o.discount?.type === 'PERCENT' && o.discount.value > 90) e.push('Percent discount cannot be more than 90');
  if (!o.startsAt || !o.endsAt || isNaN(Date.parse(o.startsAt)) || isNaN(Date.parse(o.endsAt))) e.push('Start and end time are required');
  else if (Date.parse(o.endsAt) <= Date.parse(o.startsAt)) e.push('End time must be after the start time');
  if (o.kind === 'COUPON' && !o.clip && !/^[A-Z0-9]{3,20}$/.test((o.code ?? '').toUpperCase())) e.push('Coupon code must be 3-20 letters or digits');
  if (o.kind === 'BANK_OFFER' && !o.bank?.trim()) e.push('Bank name is required');
  if (o.kind === 'LIGHTNING_DEAL') {
    if (!o.scope?.productIds?.length) e.push('A lightning deal needs at least one product');
    if (!o.stockLimit || o.stockLimit < 1) e.push('A lightning deal needs a stock limit');
  }
  if (o.kind === 'DEAL_OF_THE_DAY' && !o.scope?.productIds?.length) e.push('A deal of the day needs at least one product');
  if (o.kind === 'CATEGORY_SALE' && !o.scope?.categoryIds?.length) e.push('A category sale needs at least one category');
  return e;
}
