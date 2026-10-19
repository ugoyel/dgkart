import { istEnd, istStart } from './festivals';
import { FestivalOccurrence, Offer } from './types';

export type DraftOffer = Omit<Offer, 'id'>;

export interface DraftContext {
  categories: { id: string; slug: string; parentId: string | null }[];
  /** Best sellers to pick lightning deals and deals of the day from. */
  topProducts: { id: string; title?: string }[];
  now: Date;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Category slugs → ids, including each category's children. */
export function expandCategories(slugs: string[], categories: DraftContext['categories']): string[] {
  const roots = categories.filter((c) => slugs.includes(c.slug)).map((c) => c.id);
  return [...new Set([...roots, ...categories.filter((c) => c.parentId && roots.includes(c.parentId)).map((c) => c.id)])];
}

/** `diwali` + 2026 → `DIWALI26`. */
export function festivalCode(festivalId: string, year: string): string {
  return festivalId.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 12) + year.slice(-2);
}

const iso = (d: Date) => d.toISOString();

/**
 * Prepared, inactive offers for a festival, modelled on how Amazon runs a
 * festive sale. The admin reviews, edits and activates them.
 */
export function draftFestivalOffers(occ: FestivalOccurrence, ctx: DraftContext): DraftOffer[] {
  const f = occ.festival;
  const t = f.offerTemplate;
  const now = ctx.now.getTime();
  // Sale runs through the theme lead-up and the festival days.
  const saleStart = new Date(Math.max(now, occ.themeFrom.getTime()));
  const saleEnd = occ.end;
  const categoryIds = expandCategories(t.categories, ctx.categories);
  const base = { festivalId: f.id, isActive: false, claimedCount: 0 };
  const drafts: DraftOffer[] = [];

  drafts.push({
    ...base,
    kind: 'FESTIVAL_SALE',
    title: `${f.name} Sale: up to ${t.salePercent}% off`,
    description: f.tagline,
    discount: { type: 'PERCENT', value: t.salePercent },
    scope: { categoryIds },
    startsAt: iso(saleStart),
    endsAt: iso(saleEnd),
    sortOrder: 0,
  });

  drafts.push({
    ...base,
    kind: 'COUPON',
    title: `Extra ${t.couponPercent}% off with code ${festivalCode(f.id, occ.year)}`,
    code: festivalCode(f.id, occ.year),
    clip: false,
    discount: { type: 'PERCENT', value: t.couponPercent, maxDiscount: t.couponMaxDiscount },
    minOrder: t.couponMinOrder,
    perUserLimit: 1,
    stockLimit: null,
    scope: {},
    startsAt: iso(saleStart),
    endsAt: iso(saleEnd),
  });

  drafts.push({
    ...base,
    kind: 'COUPON',
    title: `Save 5% with coupon`,
    clip: true,
    code: null,
    discount: { type: 'PERCENT', value: 5, maxDiscount: 200 },
    perUserLimit: 3,
    scope: { categoryIds },
    startsAt: iso(saleStart),
    endsAt: iso(saleEnd),
  });

  for (const [bank, cardType] of [['HDFC Bank', 'CREDIT'], ['SBI', 'ANY']] as const) {
    drafts.push({
      ...base,
      kind: 'BANK_OFFER',
      title: `${t.bankPercent}% instant discount with ${bank} ${cardType === 'ANY' ? 'cards' : 'credit cards'}`,
      bank,
      cardType,
      discount: { type: 'PERCENT', value: t.bankPercent, maxDiscount: t.bankMaxDiscount },
      minOrder: t.bankMinOrder,
      perUserLimit: 1,
      scope: {},
      startsAt: iso(saleStart),
      endsAt: iso(saleEnd),
    });
  }

  // Lightning deals: 6-hour slots at 08:00, 14:00 and 20:00 IST from the festival's first day.
  const pool = [...ctx.topProducts];
  const firstDay = istStart(f.dates[occ.year].start).getTime();
  const slots = [8, 14, 20];
  for (let i = 0; i < t.lightningDeals && pool.length; i++) {
    const p = pool.shift()!;
    let start = firstDay + Math.floor(i / slots.length) * DAY + slots[i % slots.length] * HOUR;
    if (start < now) start = now + (i + 1) * HOUR; // festival already close: start soon, staggered
    drafts.push({
      ...base,
      kind: 'LIGHTNING_DEAL',
      title: `Lightning Deal${p.title ? `: ${p.title}` : ''}`,
      discount: { type: 'PERCENT', value: t.lightningPercent },
      scope: { productIds: [p.id] },
      stockLimit: 50,
      perUserLimit: 2,
      startsAt: iso(new Date(start)),
      endsAt: iso(new Date(start + 6 * HOUR)),
      sortOrder: i,
    });
  }

  // Deal of the day for each festival day (up to 5).
  const days = Math.min(5, Math.round((istEnd(f.dates[occ.year].end).getTime() - firstDay) / DAY));
  for (let d = 0; d < Math.max(1, days) && pool.length; d++) {
    const start = Math.max(now, firstDay + d * DAY);
    const end = firstDay + (d + 1) * DAY;
    if (end <= start) continue;
    const p = pool.shift()!;
    drafts.push({
      ...base,
      kind: 'DEAL_OF_THE_DAY',
      title: `Deal of the Day${p.title ? `: ${p.title}` : ''}`,
      discount: { type: 'PERCENT', value: Math.min(90, t.salePercent + 15) },
      scope: { productIds: [p.id] },
      startsAt: iso(new Date(start)),
      endsAt: iso(new Date(end)),
      sortOrder: d,
    });
  }

  return drafts;
}
