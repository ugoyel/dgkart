import { DEFAULT_FESTIVALS, Festival, Offer, activeFestival, expandCategories } from '@engine';
import type { Category, HomeData } from '../types';

const H = 3_600_000;
const D = 24 * H;

/** End of today in IST. */
function endOfIstDay(now: Date): Date {
  const ist = new Date(now.getTime() + 5.5 * H);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + 1) - 5.5 * H);
}

/**
 * Sample offers for demo mode, laid out around "now" so the storefront always
 * shows live lightning deals, a deal of the day, coupons and bank offers.
 * Diwali is deliberately left without offers so the admin reminder fires.
 */
export function seedOffers(now: Date, home: HomeData, categories: Category[], festivals: Festival[] = DEFAULT_FESTIVALS): Offer[] {
  const t = now.getTime();
  const iso = (ms: number) => new Date(ms).toISOString();
  const month = iso(t + 30 * D);
  const base = { isActive: true, claimedCount: 0, scope: {} } as const;
  const cats = (slugs: string[]) => expandCategories(slugs, categories);
  const offers: Offer[] = [
    { ...base, id: 'seed-bank-hdfc', kind: 'BANK_OFFER', title: '10% instant discount on HDFC Bank credit cards', bank: 'HDFC Bank', cardType: 'CREDIT', discount: { type: 'PERCENT', value: 10, maxDiscount: 1500 }, minOrder: 4999, startsAt: iso(t - D), endsAt: month },
    { ...base, id: 'seed-bank-icici', kind: 'BANK_OFFER', title: '7.5% off with ICICI Bank cards', bank: 'ICICI Bank', cardType: 'ANY', discount: { type: 'PERCENT', value: 7.5, maxDiscount: 1000 }, minOrder: 2999, startsAt: iso(t - D), endsAt: month },
    { ...base, id: 'seed-bank-sbi', kind: 'BANK_OFFER', title: 'Flat ₹250 off with SBI credit cards', bank: 'SBI', cardType: 'CREDIT', discount: { type: 'FLAT', value: 250 }, minOrder: 1999, startsAt: iso(t - D), endsAt: month },
    { ...base, id: 'seed-coupon-welcome', kind: 'COUPON', title: 'Flat ₹100 off your first order', code: 'WELCOME100', discount: { type: 'FLAT', value: 100 }, minOrder: 999, perUserLimit: 1, startsAt: iso(t - D), endsAt: month },
    { ...base, id: 'seed-coupon-dg10', kind: 'COUPON', title: 'Extra 10% off (up to ₹300)', code: 'DGKART10', discount: { type: 'PERCENT', value: 10, maxDiscount: 300 }, minOrder: 1499, perUserLimit: 3, startsAt: iso(t - D), endsAt: month },
    { ...base, id: 'seed-clip-electronics', kind: 'COUPON', title: 'Save 5% with coupon', clip: true, code: null, discount: { type: 'PERCENT', value: 5, maxDiscount: 250 }, scope: { categoryIds: cats(['electronics']) }, perUserLimit: 3, startsAt: iso(t - D), endsAt: iso(t + 7 * D) },
    { ...base, id: 'seed-clip-books', kind: 'COUPON', title: 'Save ₹40 with coupon', clip: true, code: null, discount: { type: 'FLAT', value: 40 }, scope: { categoryIds: cats(['books']) }, startsAt: iso(t - D), endsAt: iso(t + 7 * D) },
    { ...base, id: 'seed-sale-kitchen', kind: 'CATEGORY_SALE', title: 'Kitchen Fest: 15% off kitchen & dining', discount: { type: 'PERCENT', value: 15 }, scope: { categoryIds: cats(['kitchen']) }, startsAt: iso(t - D), endsAt: iso(t + 3 * D) },
  ];

  const occ = activeFestival(festivals, now);
  if (occ && occ.festival.id !== 'diwali') {
    const tpl = occ.festival.offerTemplate;
    offers.push({
      ...base, id: `seed-festival-${occ.festival.id}`, kind: 'FESTIVAL_SALE', festivalId: occ.festival.id,
      title: `${occ.festival.name} Sale: up to ${tpl.salePercent}% off`, description: occ.festival.tagline,
      discount: { type: 'PERCENT', value: tpl.salePercent }, scope: { categoryIds: cats(tpl.categories) },
      startsAt: iso(Math.min(t - D, occ.themeFrom.getTime())), endsAt: iso(occ.themeTo.getTime()),
    });
  }

  // Lightning deals: four live, four starting later today.
  const pool = home.trending.filter((p) => p.stock > 5);
  pool.slice(0, 8).forEach((p, i) => {
    const live = i < 4;
    const start = live ? t - (i + 1) * H : t + (i - 3) * 1.5 * H;
    const limit = 40 + i * 10;
    offers.push({
      ...base, id: `seed-ld-${i}`, kind: 'LIGHTNING_DEAL', title: `Lightning Deal: ${p.title}`,
      discount: { type: 'PERCENT', value: 30 + (i % 3) * 5 }, scope: { productIds: [p.id] },
      stockLimit: limit, claimedCount: live ? Math.round(limit * (0.25 + i * 0.18)) : 0, perUserLimit: 2,
      startsAt: iso(start), endsAt: iso(start + 6 * H), sortOrder: i,
    });
  });

  // Deals of the day end at midnight IST.
  const eod = endOfIstDay(now).getTime();
  home.dailyDeals.slice(0, 6).forEach((p, i) => {
    offers.push({
      ...base, id: `seed-dotd-${i}`, kind: 'DEAL_OF_THE_DAY', title: `Deal of the Day: ${p.title}`,
      discount: { type: 'PERCENT', value: 15 }, scope: { productIds: [p.id] },
      startsAt: iso(t - 2 * H), endsAt: iso(eod), sortOrder: i,
    });
  });
  return offers;
}
