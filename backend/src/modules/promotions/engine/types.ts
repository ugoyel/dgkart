/**
 * Promotions engine: festival calendar, theming, admin reminders and
 * Amazon-style offer pricing.
 *
 * Everything in this folder is plain TypeScript with no framework imports, so
 * the API (NestJS) and the website (React) run the exact same rules. Keep it
 * that way: no Node, DOM or NestJS APIs in engine/.
 */

/** ISO date `YYYY-MM-DD` (calendar day in India, IST). */
export type IsoDate = string;
/** ISO timestamp, e.g. `2026-11-01T00:00:00+05:30`. */
export type IsoDateTime = string;

// ---------------------------------------------------------------- festivals

export type FestivalMotif =
  | 'diya' | 'rangoli' | 'colors' | 'crescent' | 'star' | 'kite' | 'pookalam'
  | 'tricolor' | 'rakhi' | 'dandiya' | 'lotus' | 'bow' | 'sparkle';

/** Decoration drawn along the header / footer while a festival theme is on. */
export type FestivalDecor = 'toran' | 'lights' | 'tricolor' | 'bunting' | 'none';

export interface FestivalTheme {
  /** Main action colour (buttons, links). */
  primary: string;
  primaryDark: string;
  /** Second brand colour (badges, highlights). */
  accent: string;
  /** Header background (CSS colour or gradient). */
  headerBg: string;
  headerText: string;
  /** Footer background (CSS colour or gradient). */
  footerBg: string;
  footerText: string;
  /** Hero banner gradient. */
  bannerBg: string;
  motif: FestivalMotif;
  decor: FestivalDecor;
  /** Optional uploaded artwork; replaces the generated art when set. */
  headerImage?: string;
  footerImage?: string;
  bannerImage?: string;
}

export interface FestivalOfferTemplate {
  /** Sitewide or category sale percent for the festival sale. */
  salePercent: number;
  /** Category slugs the sale focuses on (empty = all). */
  categories: string[];
  couponPercent: number;
  couponMaxDiscount: number;
  couponMinOrder: number;
  bankPercent: number;
  bankMaxDiscount: number;
  bankMinOrder: number;
  /** How many lightning deals to draft from best sellers. */
  lightningDeals: number;
  lightningPercent: number;
}

export interface Festival {
  /** Stable key, e.g. `diwali`. Used in coupon codes and reminders. */
  id: string;
  name: string;
  /** Short greeting shown in the banner, e.g. "Happy Diwali". */
  greeting: string;
  tagline: string;
  /** Dates per year. Lunar festivals move every year: update them yearly. */
  dates: Record<string, { start: IsoDate; end: IsoDate }>;
  /** Higher wins when two festival windows overlap. */
  priority: number;
  /** Theme switches on this many days before `start`... */
  themeLeadDays: number;
  /** ...and stays this many days after `end`. */
  themeTrailDays: number;
  /** Admin reminders fire this many weeks before `start` (each entry fires once). */
  reminderWeeks: number[];
  theme: FestivalTheme;
  offerTemplate: FestivalOfferTemplate;
  enabled: boolean;
  /** Set for festivals whose date is lunar / moon-sighting based. */
  approximate?: boolean;
}

export interface FestivalOccurrence {
  festival: Festival;
  year: string;
  start: Date;
  end: Date;
  themeFrom: Date;
  themeTo: Date;
}

// ---------------------------------------------------------------- offers

export type OfferKind =
  | 'DEAL_OF_THE_DAY'
  | 'LIGHTNING_DEAL'
  | 'COUPON'
  | 'BANK_OFFER'
  | 'CATEGORY_SALE'
  | 'FESTIVAL_SALE';

export const OFFER_KINDS: OfferKind[] = ['DEAL_OF_THE_DAY', 'LIGHTNING_DEAL', 'COUPON', 'BANK_OFFER', 'CATEGORY_SALE', 'FESTIVAL_SALE'];

export const OFFER_LABELS: Record<OfferKind, string> = {
  DEAL_OF_THE_DAY: 'Deal of the Day',
  LIGHTNING_DEAL: 'Lightning Deal',
  COUPON: 'Coupon',
  BANK_OFFER: 'Bank Offer',
  CATEGORY_SALE: 'Category Sale',
  FESTIVAL_SALE: 'Festival Sale',
};

export interface Discount {
  type: 'PERCENT' | 'FLAT';
  value: number;
  /** Cap for percent discounts (per item for item deals, per order for coupons and bank offers). */
  maxDiscount?: number;
}

export interface OfferScope {
  /** Empty or missing = everything. */
  productIds?: string[];
  /** Category ids (a product matches its own category). */
  categoryIds?: string[];
}

export type CardType = 'CREDIT' | 'DEBIT' | 'ANY';

export interface Offer {
  id: string;
  kind: OfferKind;
  title: string;
  description?: string | null;
  discount: Discount;
  scope: OfferScope;
  startsAt: IsoDateTime;
  endsAt: IsoDateTime;
  /** Inactive offers are drafts: never shown, never applied. */
  isActive: boolean;
  /** Units (lightning deal) or redemptions (coupon) available; null = unlimited. */
  stockLimit?: number | null;
  claimedCount?: number;
  /** Per customer redemptions (coupons) or units (lightning deals). */
  perUserLimit?: number | null;
  /** Coupons: the code shoppers type. Clip coupons have none. */
  code?: string | null;
  /** Coupons: shown on product pages with an "Apply coupon" tick box. */
  clip?: boolean | null;
  /** Coupons and bank offers: cart value needed. */
  minOrder?: number | null;
  /** Bank offers. */
  bank?: string | null;
  cardType?: CardType | null;
  /** Link to the festival this offer was created for. */
  festivalId?: string | null;
  /** Banner image for festival / category sales. */
  bannerImage?: string | null;
  /** Lower first when several deals compete for a slot. */
  sortOrder?: number | null;
}

export interface PricedProduct {
  id: string;
  price: number;
  mrp?: number | null;
  categoryId?: string | null;
  freeShipping?: boolean;
}

export interface QuoteLineInput {
  product: PricedProduct;
  quantity: number;
}

export interface PaymentChoice {
  method: 'ONLINE' | 'COD';
  bank?: string | null;
  cardType?: CardType | null;
}

export interface QuoteInput {
  lines: QuoteLineInput[];
  offers: Offer[];
  now: Date;
  couponCode?: string | null;
  /** Clip coupons the shopper ticked. */
  clippedCouponIds?: string[];
  payment?: PaymentChoice | null;
  /** How many times this shopper already used each offer (id → count). */
  usage?: Record<string, number>;
}

export interface AppliedOffer {
  offerId: string;
  kind: OfferKind;
  title: string;
  amount: number;
  code?: string | null;
  /** Lightning deals: units claimed by this order. */
  units?: number;
}

export interface QuoteLine {
  productId: string;
  quantity: number;
  listPrice: number;
  /** Price after the best item deal. */
  unitPrice: number;
  mrp: number | null;
  deal: AppliedOffer | null;
  /** Clip coupon savings on this line (total for all units). */
  clipDiscount: number;
  lineTotal: number;
}

export interface Quote {
  lines: QuoteLine[];
  /** Sum of list prices. */
  itemsTotal: number;
  /** Savings from item deals. */
  dealDiscount: number;
  couponDiscount: number;
  bankDiscount: number;
  /** All discounts. */
  discount: number;
  /** Sum after item deals and clip coupons (before code coupon and bank offer). */
  subtotal: number;
  shippingFee: number;
  total: number;
  applied: AppliedOffer[];
  /** Human messages, e.g. why a coupon did not apply. */
  messages: string[];
  couponError?: string;
}

// ---------------------------------------------------------------- reminders

export type ReminderLevel = 'info' | 'warning' | 'urgent';

export interface AdminReminder {
  /** Stable id so dismissals stick: `<festival>-<year>-<weeks>w`. */
  id: string;
  festivalId: string;
  festivalName: string;
  year: string;
  level: ReminderLevel;
  title: string;
  body: string;
  dueAt: IsoDateTime;
  festivalStart: IsoDate;
  daysLeft: number;
  /** True once at least one active offer is linked to this festival. */
  offersReady: boolean;
}
