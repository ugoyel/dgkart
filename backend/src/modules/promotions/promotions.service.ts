import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, MoreThan, Repository } from 'typeorm';
import { Category } from '../catalog/category.entity';
import { Product } from '../catalog/product.entity';
import { randomUUID } from 'crypto';
import { StorageService } from '../storage/storage.service';
import {
  AppliedOffer, Appearance, DEFAULT_FESTIVALS, Festival, FestivalOverride, Offer, PaymentChoice, Quote,
  draftFestivalOffers, dueReminders, mergeAppearance, mergeCalendar, occurrences, quote, resolveSiteTheme, validateAppearance,
  validateFestival, validateOffer,
} from './engine';
import { AppSetting, Promotion } from './promotion.entity';

const FESTIVAL_OVERRIDES = 'festival-overrides';
const DISMISSED_REMINDERS = 'dismissed-reminders';
const APPEARANCE = 'appearance';
const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

export interface QuoteRequest {
  items: { productId: string; quantity: number }[];
  couponCode?: string;
  clippedCouponIds?: string[];
  payment?: PaymentChoice;
}

export function toOffer(p: Promotion): Offer {
  return {
    ...p,
    startsAt: new Date(p.startsAt).toISOString(),
    endsAt: new Date(p.endsAt).toISOString(),
  };
}

@Injectable()
export class PromotionsService {
  constructor(
    @InjectRepository(Promotion) private readonly promos: Repository<Promotion>,
    @InjectRepository(AppSetting) private readonly settings: Repository<AppSetting>,
    private readonly db: DataSource,
    private readonly storage: StorageService,
  ) {}

  // ------------------------------------------------------------ appearance

  async appearance(): Promise<Appearance> {
    return mergeAppearance(await this.setting<Partial<Appearance> | null>(APPEARANCE, null));
  }

  async saveAppearance(input: Partial<Appearance>): Promise<Appearance> {
    const a = mergeAppearance(input);
    const errors = validateAppearance(a);
    if (errors.length) throw new BadRequestException(errors.slice(0, 5).join('. '));
    if (JSON.stringify(a).length > 512_000) throw new BadRequestException('Settings are too large: upload images instead of pasting them');
    await this.saveSetting(APPEARANCE, a);
    return a;
  }

  async resetAppearance(): Promise<Appearance> {
    await this.settings.delete({ key: APPEARANCE });
    return mergeAppearance(null);
  }

  /** Stores a banner, background or header/footer image and returns its public URL. */
  async uploadMedia(file?: { buffer: Buffer; mimetype: string; size: number }): Promise<{ url: string }> {
    if (!file) throw new BadRequestException('Attach an image as "file"');
    const ext = IMAGE_TYPES[file.mimetype];
    if (!ext) throw new BadRequestException('Upload a JPG, PNG, WebP or GIF image');
    return { url: await this.storage.put(`site/${randomUUID()}${ext}`, file.buffer, file.mimetype) };
  }

  // ------------------------------------------------------------ calendar

  private async setting<T>(key: string, fallback: T): Promise<T> {
    const row = await this.settings.findOne({ where: { key } });
    return (row?.value as T) ?? fallback;
  }

  private async saveSetting(key: string, value: unknown) {
    await this.settings.save({ key, value });
  }

  async calendar(): Promise<Festival[]> {
    return mergeCalendar(DEFAULT_FESTIVALS, await this.setting<FestivalOverride[]>(FESTIVAL_OVERRIDES, []));
  }

  /** Replace one festival (admin edit). Stores only the override, defaults stay in code. */
  async saveFestival(f: Festival) {
    const errors = validateFestival(f);
    if (errors.length) throw new BadRequestException(errors.join('. '));
    const overrides = (await this.setting<FestivalOverride[]>(FESTIVAL_OVERRIDES, [])).filter((o) => o.id !== f.id);
    overrides.push(f);
    await this.saveSetting(FESTIVAL_OVERRIDES, overrides);
    return this.calendar();
  }

  async deleteFestival(id: string) {
    const overrides = (await this.setting<FestivalOverride[]>(FESTIVAL_OVERRIDES, [])).filter((o) => o.id !== id);
    if (DEFAULT_FESTIVALS.some((f) => f.id === id)) overrides.push({ id, deleted: true });
    await this.saveSetting(FESTIVAL_OVERRIDES, overrides);
    return this.calendar();
  }

  /** Drop all edits and go back to the calendar shipped in code. */
  async resetCalendar() {
    await this.saveSetting(FESTIVAL_OVERRIDES, []);
    return this.calendar();
  }

  // ------------------------------------------------------------ storefront

  /** Active offers that have not ended, for the storefront. */
  async liveOffers(now = new Date()): Promise<Offer[]> {
    const rows = await this.promos.find({ where: { isActive: true, endsAt: MoreThan(now) }, order: { sortOrder: 'ASC', startsAt: 'ASC' } });
    return rows.map(toOffer);
  }

  /** Everything the website needs on load: theme, calendar and offers. */
  async publicState(at?: Date) {
    const now = new Date();
    const festivals = await this.calendar();
    const offers = await this.liveOffers(now);
    // Hide codes of coupons that have not started yet.
    const visible = offers.map((o) => (new Date(o.startsAt) > now && o.kind === 'COUPON' ? { ...o, code: null } : o));
    const appearance = await this.appearance();
    const theme = resolveSiteTheme(festivals, appearance, at ?? now);
    return {
      appearance,
      serverTime: now.toISOString(),
      // Offer templates are the admin's plans; shoppers only need dates and themes.
      festivals: festivals.map(({ offerTemplate: _t, ...f }) => f),
      offers: visible,
      theme: { ...theme, occurrence: theme.occurrence && serializeOcc(theme.occurrence) },
    };
  }

  async quote(userId: string | null, req: QuoteRequest, tx?: EntityManager): Promise<{ quote: Quote; products: Product[] }> {
    const m = tx ?? this.db.manager;
    const products = await m.getRepository(Product).find({ where: { id: In(req.items.map((i) => i.productId)), isActive: true } });
    const byId = new Map(products.map((p) => [p.id, p]));
    const lines = req.items.filter((i) => byId.has(i.productId)).map((i) => ({ product: byId.get(i.productId)!, quantity: i.quantity }));
    const offers = (await m.getRepository(Promotion).find({ where: { isActive: true, endsAt: MoreThan(new Date()) } })).map(toOffer);
    const q = quote({
      lines, offers, now: new Date(),
      couponCode: req.couponCode, clippedCouponIds: req.clippedCouponIds, payment: req.payment,
      usage: userId ? await this.usage(userId, m) : {},
    });
    return { quote: q, products };
  }

  /** How many times this shopper used each offer on orders that still stand. */
  private async usage(userId: string, m: EntityManager): Promise<Record<string, number>> {
    const rows: { id: string; n: string }[] = await m.query(
      `SELECT d->>'offerId' AS id, SUM(COALESCE((d->>'units')::int, 1)) AS n
         FROM orders o, jsonb_array_elements(o.discounts) d
        WHERE o."userId" = $1 AND o.status NOT IN ('CANCELLED', 'PAYMENT_FAILED')
        GROUP BY 1`,
      [userId],
    );
    return Object.fromEntries(rows.map((r) => [r.id, Number(r.n)]));
  }

  /** Reserve limited deal units / coupon redemptions inside the order transaction. */
  async claim(tx: EntityManager, applied: AppliedOffer[]) {
    for (const a of applied) {
      const n = a.units ?? 1;
      const res = await tx.query(
        `UPDATE promotions SET "claimedCount" = "claimedCount" + $1
          WHERE id = $2 AND ("stockLimit" IS NULL OR "claimedCount" + $1 <= "stockLimit")`,
        [n, a.offerId],
      );
      if (!res[1]) throw new BadRequestException(`"${a.title}" just sold out. Please review your cart.`);
    }
  }

  async release(tx: EntityManager, applied: AppliedOffer[]) {
    for (const a of applied ?? []) {
      await tx.query('UPDATE promotions SET "claimedCount" = GREATEST("claimedCount" - $1, 0) WHERE id = $2', [a.units ?? 1, a.offerId]);
    }
  }

  // ------------------------------------------------------------ admin

  async all(): Promise<Offer[]> {
    return (await this.promos.find({ order: { startsAt: 'DESC' } })).map(toOffer);
  }

  async create(data: Partial<Offer>) {
    this.assertValid(data);
    return toOffer(await this.promos.save(this.promos.create(this.normalise(data))));
  }

  async update(id: string, patch: Partial<Offer>) {
    const row = await this.promos.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Offer not found');
    const next = { ...toOffer(row), ...patch, id };
    this.assertValid(next);
    return toOffer(await this.promos.save(this.promos.merge(row, this.normalise(next))));
  }

  async remove(id: string) {
    await this.promos.delete({ id });
    return { deleted: true };
  }

  private assertValid(o: Partial<Offer>) {
    const errors = validateOffer(o);
    if (errors.length) throw new BadRequestException(errors.join('. '));
  }

  private normalise(o: Partial<Offer>): Partial<Promotion> {
    const { id: _id, ...rest } = o;
    return {
      ...rest,
      code: o.code ? o.code.trim().toUpperCase() : null,
      startsAt: o.startsAt ? new Date(o.startsAt) : undefined,
      endsAt: o.endsAt ? new Date(o.endsAt) : undefined,
    } as Partial<Promotion>;
  }

  async reminders(now = new Date()) {
    const [festivals, offers, dismissed] = await Promise.all([
      this.calendar(),
      this.all(),
      this.setting<string[]>(DISMISSED_REMINDERS, []),
    ]);
    return dueReminders(festivals, offers, now, dismissed);
  }

  async dismissReminder(id: string) {
    const dismissed = await this.setting<string[]>(DISMISSED_REMINDERS, []);
    if (!dismissed.includes(id)) await this.saveSetting(DISMISSED_REMINDERS, [...dismissed.slice(-500), id]);
    return { dismissed: true };
  }

  /** Create the prepared (inactive) offers for a festival's next occurrence. */
  async createDrafts(festivalId: string, year?: string) {
    const now = new Date();
    const occ = occurrences(await this.calendar()).find(
      (o) => o.festival.id === festivalId && (year ? o.year === year : o.end.getTime() >= now.getTime()),
    );
    if (!occ) throw new NotFoundException('No upcoming dates for this festival. Add them in the festival calendar first.');
    const [categories, topProducts] = await Promise.all([
      this.db.getRepository(Category).find({ select: ['id', 'slug', 'parentId'] }),
      this.db.getRepository(Product).find({
        where: { isActive: true }, select: ['id', 'title'], order: { soldCount: 'DESC' }, take: 40,
      }),
    ]);
    const drafts = draftFestivalOffers(occ, { now, categories, topProducts });
    const saved = await this.promos.save(drafts.map((d) => this.promos.create(this.normalise(d))));
    return saved.map(toOffer);
  }
}

function serializeOcc(o: ReturnType<typeof occurrences>[number]) {
  return { festival: o.festival, year: o.year, start: o.start.toISOString(), end: o.end.toISOString(), themeFrom: o.themeFrom.toISOString(), themeTo: o.themeTo.toISOString() };
}
