import {
  DEFAULT_APPEARANCE, DEFAULT_FESTIVALS, Offer, activeFestival, mergeAppearance, resolveSiteTheme, validateAppearance, draftFestivalOffers, dueReminders, mergeCalendar, quote, resolveTheme, upcomingFestivals,
} from './index';

const at = (s: string) => new Date(s);
const offer = (o: Partial<Offer>): Offer => ({
  id: o.id ?? Math.random().toString(36).slice(2),
  kind: 'COUPON',
  title: 't',
  discount: { type: 'PERCENT', value: 10 },
  scope: {},
  startsAt: '2026-01-01T00:00:00Z',
  endsAt: '2027-01-01T00:00:00Z',
  isActive: true,
  claimedCount: 0,
  ...o,
});
const phone = { id: 'p1', price: 1000, mrp: 1500, categoryId: 'c-mob', freeShipping: true };
const tee = { id: 'p2', price: 200, mrp: 400, categoryId: 'c-fash', freeShipping: false };
const now = at('2026-10-19T12:00:00+05:30');

describe('festival calendar', () => {
  it('switches theme ahead of a festival, picks the highest priority and reverts afterwards', () => {
    expect(activeFestival(DEFAULT_FESTIVALS, at('2026-10-15T10:00:00+05:30'))?.festival.id).toBe('navratri');
    // Dussehra (the day after Navratri ends) takes over three days ahead.
    expect(activeFestival(DEFAULT_FESTIVALS, at('2026-10-19T10:00:00+05:30'))?.festival.id).toBe('dussehra');
    // Diwali (priority 100) lead-up starts 12 days before 6 Nov.
    const diwali = resolveTheme(DEFAULT_FESTIVALS, at('2026-10-28T10:00:00+05:30'));
    expect(diwali.occurrence?.festival.id).toBe('diwali');
    expect(diwali.phase).toBe('lead-up');
    expect(diwali.daysToStart).toBe(9);
    expect(resolveTheme(DEFAULT_FESTIVALS, at('2026-11-08T20:00:00+05:30')).phase).toBe('live');
    // A quiet week: everyday theme.
    const plain = resolveTheme(DEFAULT_FESTIVALS, at('2026-11-20T10:00:00+05:30'));
    expect(plain.occurrence).toBeNull();
    expect(plain.theme.primary).toBe('#1A56DB');
  });

  it('lets the admin change dates, disable or add festivals', () => {
    const merged = mergeCalendar(DEFAULT_FESTIVALS, [
      { id: 'diwali', dates: { '2028': { start: '2028-10-17', end: '2028-10-19' } } },
      { id: 'holi', enabled: false },
      { id: 'store-anniversary', name: 'DGkart Anniversary', dates: { '2026': { start: '2026-12-01', end: '2026-12-03' } } },
    ]);
    const diwali = merged.find((f) => f.id === 'diwali')!;
    expect(Object.keys(diwali.dates)).toEqual(['2026', '2027', '2028']);
    expect(upcomingFestivals(merged, at('2027-02-20T00:00:00Z'), 60).map((o) => o.festival.id)).not.toContain('holi');
    expect(resolveTheme(merged, at('2026-12-02T10:00:00+05:30')).occurrence?.festival.name).toBe('DGkart Anniversary');
  });
});

describe('admin reminders', () => {
  it('reminds ahead of Diwali until offers are linked, at the latest tier reached', () => {
    const due = dueReminders(DEFAULT_FESTIVALS, [], now);
    const diwali = due.find((r) => r.festivalId === 'diwali')!;
    expect(diwali.id).toBe('diwali-2026-4w'); // 18 days out → 4-week tier
    expect(diwali.level).toBe('info');
    expect(diwali.offersReady).toBe(false);
    expect(dueReminders(DEFAULT_FESTIVALS, [], at('2026-11-01T10:00:00+05:30')).find((r) => r.festivalId === 'diwali')!.level).toBe('urgent');

    const linked = [offer({ festivalId: 'diwali', endsAt: '2026-11-11T00:00:00Z' })];
    expect(dueReminders(DEFAULT_FESTIVALS, linked, now).find((r) => r.festivalId === 'diwali')!.offersReady).toBe(true);
    expect(dueReminders(DEFAULT_FESTIVALS, [], now, ['diwali-2026-4w']).find((r) => r.festivalId === 'diwali')).toBeUndefined();
  });

  it('drafts a full festive sale as inactive offers', () => {
    const occ = upcomingFestivals(DEFAULT_FESTIVALS, now).find((o) => o.festival.id === 'diwali')!;
    const drafts = draftFestivalOffers(occ, {
      now,
      categories: [{ id: 'c-el', slug: 'electronics', parentId: null }, { id: 'c-mob', slug: 'mobiles', parentId: 'c-el' }],
      topProducts: Array.from({ length: 20 }, (_, i) => ({ id: `p${i}` })),
    });
    const kinds = drafts.map((d) => d.kind);
    expect(kinds.filter((k) => k === 'LIGHTNING_DEAL')).toHaveLength(12);
    expect(kinds).toEqual(expect.arrayContaining(['FESTIVAL_SALE', 'COUPON', 'BANK_OFFER', 'DEAL_OF_THE_DAY']));
    expect(drafts.every((d) => !d.isActive && d.festivalId === 'diwali')).toBe(true);
    expect(drafts.find((d) => d.kind === 'COUPON' && !d.clip)!.code).toBe('DIWALI26');
  });
});

describe('offer pricing', () => {
  it('uses the best single item deal, never stacking deals', () => {
    const q = quote({
      now,
      lines: [{ product: phone, quantity: 1 }],
      offers: [
        offer({ id: 'cat', kind: 'CATEGORY_SALE', discount: { type: 'PERCENT', value: 10 }, scope: { categoryIds: ['c-mob'] } }),
        offer({ id: 'dotd', kind: 'DEAL_OF_THE_DAY', discount: { type: 'PERCENT', value: 25 }, scope: { productIds: ['p1'] } }),
      ],
    });
    expect(q.lines[0].unitPrice).toBe(750);
    expect(q.dealDiscount).toBe(250);
    expect(q.applied.map((a) => a.offerId)).toEqual(['dotd']);
    expect(q.total).toBe(750);
  });

  it('limits lightning deal units to what is left and falls back to the next price', () => {
    const q = quote({
      now,
      lines: [{ product: phone, quantity: 3 }],
      offers: [offer({ id: 'ld', kind: 'LIGHTNING_DEAL', discount: { type: 'PERCENT', value: 40 }, scope: { productIds: ['p1'] }, stockLimit: 10, claimedCount: 9 })],
    });
    expect(q.lines[0].lineTotal).toBe(600 + 2000);
    expect(q.lines[0].deal?.units).toBe(1);
    const soldOut = quote({ now, lines: [{ product: phone, quantity: 1 }], offers: [offer({ kind: 'LIGHTNING_DEAL', scope: { productIds: ['p1'] }, stockLimit: 5, claimedCount: 5 })] });
    expect(soldOut.total).toBe(1000);
  });

  it('stacks clip coupon, promo code and bank offer in Amazon order with caps and minimums', () => {
    const offers = [
      offer({ id: 'clip', kind: 'COUPON', clip: true, discount: { type: 'PERCENT', value: 5 }, scope: { productIds: ['p1'] } }),
      offer({ id: 'code', kind: 'COUPON', code: 'DIWALI26', discount: { type: 'PERCENT', value: 10, maxDiscount: 100 }, minOrder: 500 }),
      offer({ id: 'hdfc', kind: 'BANK_OFFER', bank: 'HDFC Bank', cardType: 'CREDIT', discount: { type: 'PERCENT', value: 10, maxDiscount: 1500 }, minOrder: 1000 }),
    ];
    const q = quote({
      now, offers, couponCode: 'diwali26', clippedCouponIds: ['clip'],
      lines: [{ product: phone, quantity: 1 }, { product: tee, quantity: 1 }],
      payment: { method: 'ONLINE', bank: 'HDFC Bank', cardType: 'CREDIT' },
    });
    expect(q.subtotal).toBe(950 + 200); // clip coupon on the phone only
    expect(q.couponDiscount).toBe(100); // 10% of 1150 capped at 100
    expect(q.bankDiscount).toBe(105); // 10% of 1050
    expect(q.shippingFee).toBe(0);
    expect(q.total).toBe(945);
    expect(q.discount).toBe(50 + 100 + 105);

    const cod = quote({ now, offers, couponCode: 'DIWALI26', lines: [{ product: tee, quantity: 1 }], payment: { method: 'COD' } });
    expect(cod.couponError).toMatch(/Add ₹300 more/);
    expect(cod.bankDiscount).toBe(0);
    expect(cod.total).toBe(240);
  });

  it('rejects unknown, expired and already used codes', () => {
    const base = { now, lines: [{ product: phone, quantity: 1 }] };
    expect(quote({ ...base, offers: [], couponCode: 'NOPE' }).couponError).toMatch(/not a valid/);
    expect(quote({ ...base, offers: [offer({ code: 'OLD', endsAt: '2026-02-01T00:00:00Z' })], couponCode: 'OLD' }).couponError).toMatch(/expired/);
    expect(quote({ ...base, offers: [offer({ id: 'u', code: 'ONCE', perUserLimit: 1 })], couponCode: 'ONCE', usage: { u: 1 } }).couponError).toMatch(/already used/);
    expect(quote({ ...base, offers: [offer({ code: 'DRAFT', isActive: false })], couponCode: 'DRAFT' }).couponError).toMatch(/not a valid/);
  });
});

describe('appearance', () => {
  it('defaults are valid and unknown fields are dropped', () => {
    expect(validateAppearance(DEFAULT_APPEARANCE)).toEqual([]);
    const a = mergeAppearance({ radius: 8, junk: 1 } as never);
    expect(a.radius).toBe(8);
    expect('junk' in a).toBe(false);
  });

  it('can force a festival theme until a date, or keep the everyday look', () => {
    const forced = mergeAppearance({ themeMode: 'festival', forcedFestivalId: 'diwali', forcedUntil: '2026-10-25' });
    expect(resolveSiteTheme(DEFAULT_FESTIVALS, forced, now).occurrence?.festival.id).toBe('diwali');
    expect(resolveSiteTheme(DEFAULT_FESTIVALS, forced, at('2026-10-26T10:00:00+05:30')).occurrence?.festival.id).toBe('diwali'); // calendar lead-up
    expect(resolveSiteTheme(DEFAULT_FESTIVALS, forced, at('2026-10-26T10:00:00+05:30')).phase).toBe('lead-up');
    const everyday = mergeAppearance({ themeMode: 'everyday', base: { ...DEFAULT_APPEARANCE.base, primary: '#123456' } });
    const t = resolveSiteTheme(DEFAULT_FESTIVALS, everyday, now);
    expect(t.occurrence).toBeNull();
    expect(t.theme.primary).toBe('#123456');
  });

  it('rejects unsafe or broken settings', () => {
    const bad = mergeAppearance({ heroSlides: [{ ...DEFAULT_APPEARANCE.heroSlides[0], link: 'javascript:alert(1)', image: 'ftp://x' }] });
    expect(validateAppearance(bad).length).toBe(2);
  });
});
