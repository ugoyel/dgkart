import {
  DEFAULT_FESTIVALS, FestivalOverride, Offer, Quote, draftFestivalOffers, dueReminders, mergeCalendar, occurrences, quote,
  resolveTheme, validateFestival, validateOffer,
} from '@engine';
import { assetUrl, config } from '../../config/env';
import { site } from '../../config/site';
import { uid } from '../../lib/format';
import { store } from '../../lib/storage';
import type { AdminApi, DataSource, PaymentUi } from '../source';
import type {
  Address, CartItem, Category, HomeData, Order, Page, PlaceOrderInput, Product, PromoState, QuoteRequest, SearchQuery, Session, User,
} from '../types';
import { seedOffers } from './seedOffers';

interface Catalog {
  categories: Category[];
  products: Product[];
  home: { dailyDeals: string[]; trending: string[]; newArrivals: string[] };
}

/** Everything demo mode remembers between visits (this browser only). */
interface DemoState {
  version: 1;
  users: Record<string, User>;
  carts: Record<string, { productId: string; quantity: number }[]>;
  watch: Record<string, string[]>;
  orders: Order[];
  offers: Offer[];
  seededAt: number;
  festivalOverrides: FestivalOverride[];
  dismissed: string[];
  productEdits: Record<string, Partial<Product> & { deleted?: boolean }>;
  extraProducts: Product[];
}

const STATE_KEY = 'dg.demo.state';
const SESSION_KEY = 'dg.demo.session';
const DAY = 86_400_000;

class DemoError extends Error {}

const normPhone = (p: string) => p.replace(/\D/g, '').slice(-10);

/** In-browser backend for demos and offline previews. Same rules as the API via the shared engine. */
export class DemoDataSource implements DataSource {
  readonly mode = 'demo' as const;
  private catalog: Promise<Catalog> | null = null;
  private state: DemoState;
  private session: string | null = store.get<string>(SESSION_KEY);

  constructor() {
    this.state = store.get<DemoState>(STATE_KEY) ?? {
      version: 1, users: {}, carts: {}, watch: {}, orders: [], offers: [], seededAt: 0,
      festivalOverrides: [], dismissed: [], productEdits: {}, extraProducts: [],
    };
  }

  private save() {
    store.set(STATE_KEY, this.state);
  }

  private async load(): Promise<Catalog> {
    this.catalog ??= fetch(config.basePath + 'demo/catalog.json')
      .then((r) => {
        if (!r.ok) throw new DemoError('Demo catalogue missing. Run "npm run sync-demo".');
        return r.json() as Promise<Catalog>;
      })
      .then((c) => {
        const fix = (p: Product): Product => ({ ...p, thumbnailUrl: assetUrl(p.thumbnailUrl), images: p.images?.map((i) => ({ ...i, url: assetUrl(i.url)! })) });
        return { ...c, products: c.products.map(fix), categories: c.categories.map((x) => ({ ...x, imageUrl: assetUrl(x.imageUrl) })) };
      });
    const c = await this.catalog;
    await this.ensureOffers(c);
    return c;
  }

  /** Re-seed sample offers daily so the demo always has live deals. Admin-made offers are kept. */
  private async ensureOffers(c: Catalog) {
    if (Date.now() - this.state.seededAt < DAY / 2) return;
    const byId = new Map(c.products.map((p) => [p.id, p]));
    const home: HomeData = {
      categories: [],
      dailyDeals: c.home.dailyDeals.map((id) => byId.get(id)!).filter(Boolean),
      trending: c.home.trending.map((id) => byId.get(id)!).filter(Boolean),
      newArrivals: [],
    };
    const kept = this.state.offers.filter((o) => !o.id.startsWith('seed-'));
    this.state.offers = [...seedOffers(new Date(), home, c.categories, this.festivals()), ...kept];
    this.state.seededAt = Date.now();
    this.save();
  }

  private async products(): Promise<Product[]> {
    const c = await this.load();
    const edits = this.state.productEdits;
    return [...c.products, ...this.state.extraProducts]
      .filter((p) => !edits[p.id]?.deleted)
      .map((p) => (edits[p.id] ? { ...p, ...edits[p.id] } : p))
      .filter((p) => p.isActive !== false);
  }

  private festivals() {
    return mergeCalendar(DEFAULT_FESTIVALS, this.state.festivalOverrides);
  }

  private user(): User {
    const u = this.session ? Object.values(this.state.users).find((x) => x.id === this.session) : undefined;
    if (!u) throw new DemoError('Please sign in to continue');
    return u;
  }

  private delay<T>(v: T): Promise<T> {
    return new Promise((r) => setTimeout(() => r(v), 120));
  }

  // ------------------------------------------------------------ auth
  async authMode() {
    return 'demo' as const;
  }
  async requestOtp(phone: string) {
    if (normPhone(phone).length !== 10 || !/^[6-9]/.test(normPhone(phone))) throw new DemoError('Enter a valid 10 digit mobile number');
    return this.delay({ hint: `Demo mode: use OTP ${site.demoOtp}` });
  }
  async verifyOtp(phone: string, code: string): Promise<Session> {
    if (code !== site.demoOtp) throw new DemoError('Incorrect OTP');
    const p = normPhone(phone);
    const role = p === normPhone(site.adminPhone) ? 'ADMIN' : 'USER';
    const u = this.state.users[p] ?? { id: uid(), phone: `+91${p}`, name: null, email: null, role, addresses: [] };
    u.role = role;
    this.state.users[p] = u;
    this.session = u.id;
    store.set(SESSION_KEY, u.id);
    this.save();
    return this.delay({ accessToken: `demo.${u.id}`, user: u });
  }
  async restore() {
    try {
      return this.user();
    } catch {
      return null;
    }
  }
  logout() {
    this.session = null;
    store.remove(SESSION_KEY);
  }
  async updateProfile(patch: { name?: string; email?: string }) {
    Object.assign(this.user(), patch);
    this.save();
    return this.user();
  }
  async saveAddresses(addresses: Address[]) {
    this.user().addresses = addresses;
    this.save();
    return this.user();
  }

  // ------------------------------------------------------------ catalogue
  async home(): Promise<HomeData> {
    const c = await this.load();
    const all = await this.products();
    const byId = new Map(all.map((p) => [p.id, p]));
    const pick = (ids: string[]) => ids.map((id) => byId.get(id)).filter((p): p is Product => !!p);
    return this.delay({
      categories: c.categories.filter((x) => !x.parentId).sort((a, b) => a.sortOrder - b.sortOrder),
      dailyDeals: pick(c.home.dailyDeals),
      trending: pick(c.home.trending),
      newArrivals: [...this.state.extraProducts, ...pick(c.home.newArrivals)].slice(0, 12),
    });
  }
  async categories() {
    return (await this.load()).categories;
  }
  async search(q: SearchQuery): Promise<Page<Product>> {
    const cats = await this.categories();
    let list = await this.products();
    const text = q.q?.trim().toLowerCase();
    if (text) {
      const words = text.split(/\s+/);
      list = list.filter((p) => {
        const hay = `${p.title} ${p.brand ?? ''} ${p.sku}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      });
    }
    if (q.category) {
      const cat = cats.find((c) => c.slug === q.category);
      const ids = cat ? [cat.id, ...cats.filter((c) => c.parentId === cat.id).map((c) => c.id)] : [];
      list = list.filter((p) => p.categoryId && ids.includes(p.categoryId));
    }
    if (q.minPrice != null) list = list.filter((p) => p.price >= q.minPrice!);
    if (q.maxPrice != null) list = list.filter((p) => p.price <= q.maxPrice!);
    if (q.condition) list = list.filter((p) => p.condition === q.condition);
    if (q.freeShipping) list = list.filter((p) => p.freeShipping);
    const sorted = [...list];
    switch (q.sort) {
      case 'price_asc': sorted.sort((a, b) => a.price - b.price); break;
      case 'price_desc': sorted.sort((a, b) => b.price - a.price); break;
      case 'newest': sorted.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')); break;
      default: sorted.sort((a, b) => b.soldCount - a.soldCount || b.rating - a.rating);
    }
    const page = q.page ?? 1;
    const size = q.pageSize ?? 24;
    const items = sorted.slice((page - 1) * size, page * size);
    return this.delay({ items, page, pageSize: size, total: sorted.length, hasMore: page * size < sorted.length });
  }
  async product(id: string) {
    const p = (await this.products()).find((x) => x.id === id);
    if (!p) throw new DemoError('Product not found');
    const cats = await this.categories();
    return this.delay({ ...p, category: cats.find((c) => c.id === p.categoryId) ?? null });
  }
  async similar(id: string) {
    const all = await this.products();
    const p = all.find((x) => x.id === id);
    return all.filter((x) => x.categoryId === p?.categoryId && x.id !== id).sort((a, b) => b.soldCount - a.soldCount).slice(0, 12);
  }
  async productsByIds(ids: string[]) {
    const byId = new Map((await this.products()).map((p) => [p.id, p]));
    return ids.map((id) => byId.get(id)).filter((p): p is Product => !!p);
  }

  // ------------------------------------------------------------ cart
  private async cartView(): Promise<CartItem[]> {
    const rows = this.state.carts[this.user().id] ?? [];
    const byId = new Map((await this.products()).map((p) => [p.id, p]));
    return rows.filter((r) => byId.has(r.productId)).map((r) => ({ ...r, product: byId.get(r.productId)! }));
  }
  async cart() {
    return this.cartView();
  }
  async addToCart(productId: string, quantity: number) {
    const rows = (this.state.carts[this.user().id] ??= []);
    const p = (await this.products()).find((x) => x.id === productId);
    if (!p) throw new DemoError('Product not found');
    const row = rows.find((r) => r.productId === productId);
    const qty = (row?.quantity ?? 0) + quantity;
    if (qty > p.stock) throw new DemoError(`Only ${p.stock} left in stock`);
    if (row) row.quantity = qty;
    else rows.push({ productId, quantity });
    this.save();
    return this.cartView();
  }
  async setQuantity(productId: string, quantity: number) {
    if (quantity <= 0) return this.removeFromCart(productId);
    const row = (this.state.carts[this.user().id] ?? []).find((r) => r.productId === productId);
    if (row) row.quantity = quantity;
    this.save();
    return this.cartView();
  }
  async removeFromCart(productId: string) {
    const id = this.user().id;
    this.state.carts[id] = (this.state.carts[id] ?? []).filter((r) => r.productId !== productId);
    this.save();
    return this.cartView();
  }
  async watchlist() {
    return this.productsByIds(this.state.watch[this.user().id] ?? []);
  }
  async setWatched(productId: string, watched: boolean) {
    const id = this.user().id;
    const list = (this.state.watch[id] ?? []).filter((x) => x !== productId);
    this.state.watch[id] = watched ? [productId, ...list] : list;
    this.save();
  }

  // ------------------------------------------------------------ orders
  private usage(userId: string): Record<string, number> {
    const u: Record<string, number> = {};
    for (const o of this.state.orders) {
      if (o.userId !== userId || o.status === 'CANCELLED' || o.status === 'PAYMENT_FAILED') continue;
      for (const d of o.discounts) u[d.offerId] = (u[d.offerId] ?? 0) + (d.units ?? 1);
    }
    return u;
  }

  private async priced(userId: string | null, req: QuoteRequest): Promise<{ q: Quote; products: Product[] }> {
    const byId = new Map((await this.products()).map((p) => [p.id, p]));
    const lines = req.items.filter((i) => byId.has(i.productId)).map((i) => ({ product: byId.get(i.productId)!, quantity: i.quantity }));
    const q = quote({
      lines, offers: this.state.offers, now: new Date(), couponCode: req.couponCode, clippedCouponIds: req.clippedCouponIds,
      payment: req.payment, usage: userId ? this.usage(userId) : {},
    });
    return { q, products: lines.map((l) => l.product) };
  }

  async placeOrder(input: PlaceOrderInput): Promise<Order> {
    const u = this.user();
    const fromCart = !input.items?.length;
    const wanted = fromCart ? (this.state.carts[u.id] ?? []).map((r) => ({ ...r })) : input.items!;
    if (!wanted.length) throw new DemoError('Your cart is empty');
    const { q, products } = await this.priced(u.id, {
      items: wanted, couponCode: input.couponCode, clippedCouponIds: input.clippedCouponIds,
      payment: { method: input.paymentMethod, bank: input.bank, cardType: input.cardType },
    });
    if (input.couponCode && q.couponError) throw new DemoError(q.couponError);
    for (const w of wanted) {
      const p = products.find((x) => x.id === w.productId);
      if (!p) throw new DemoError('An item in your cart is no longer available');
      if (p.stock < w.quantity) throw new DemoError(`"${p.title}" has only ${p.stock} left`);
    }
    for (const a of q.applied) {
      const o = this.state.offers.find((x) => x.id === a.offerId);
      if (o?.stockLimit != null && (o.claimedCount ?? 0) + (a.units ?? 1) > o.stockLimit) throw new DemoError(`"${a.title}" just sold out. Please review your cart.`);
    }
    for (const a of q.applied) {
      const o = this.state.offers.find((x) => x.id === a.offerId);
      if (o) o.claimedCount = (o.claimedCount ?? 0) + (a.units ?? 1);
    }
    for (const w of wanted) {
      const p = products.find((x) => x.id === w.productId)!;
      this.state.productEdits[p.id] = { ...this.state.productEdits[p.id], stock: p.stock - w.quantity, soldCount: p.soldCount + w.quantity };
    }
    const order: Order = {
      id: uid(),
      orderNumber: `DG${new Date().toISOString().slice(2, 10).replace(/-/g, '')}${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`,
      userId: u.id,
      status: input.paymentMethod === 'COD' ? 'CONFIRMED_COD' : 'PENDING_PAYMENT',
      paymentMethod: input.paymentMethod,
      items: wanted.map((w) => {
        const p = products.find((x) => x.id === w.productId)!;
        const l = q.lines.find((x) => x.productId === p.id)!;
        return { productId: p.id, sku: p.sku, title: p.title, imageUrl: p.thumbnailUrl, unitPrice: l.unitPrice, quantity: w.quantity, listPrice: p.price, lineTotal: l.lineTotal };
      }),
      subtotal: q.subtotal,
      shippingFee: q.shippingFee,
      discount: Math.round((q.couponDiscount + q.bankDiscount) * 100) / 100,
      discounts: q.applied,
      total: q.total,
      shippingAddress: input.address,
      payment: {},
      createdAt: new Date().toISOString(),
    };
    this.state.orders.unshift(order);
    if (fromCart) this.state.carts[u.id] = [];
    this.save();
    return this.delay(order);
  }

  async pay(order: Order, ui: PaymentUi): Promise<Order> {
    const r = await ui.simulate(order);
    if (r === 'cancel') return order;
    return this.setStatus(order.id, r === 'success' ? 'PAID' : 'PAYMENT_FAILED', r === 'success' ? { provider: 'demo', paymentId: `demo_${Date.now()}` } : {});
  }

  private setStatus(id: string, status: Order['status'], payment: Record<string, string> = {}): Order {
    const o = this.state.orders.find((x) => x.id === id);
    if (!o) throw new DemoError('Order not found');
    const releasing = status === 'CANCELLED' || status === 'PAYMENT_FAILED';
    const released = o.status === 'CANCELLED' || o.status === 'PAYMENT_FAILED';
    if (releasing && !released) {
      for (const l of o.items) {
        const e = this.state.productEdits[l.productId];
        if (e?.stock != null) e.stock += l.quantity;
      }
      for (const d of o.discounts) {
        const off = this.state.offers.find((x) => x.id === d.offerId);
        if (off) off.claimedCount = Math.max(0, (off.claimedCount ?? 0) - (d.units ?? 1));
      }
    }
    o.status = status;
    o.payment = { ...o.payment, ...payment };
    this.save();
    return o;
  }

  async orders(page = 1): Promise<Page<Order>> {
    const mine = this.state.orders.filter((o) => o.userId === this.user().id);
    return { items: mine.slice((page - 1) * 20, page * 20), page, pageSize: 20, total: mine.length, hasMore: page * 20 < mine.length };
  }
  async order(id: string) {
    const o = this.state.orders.find((x) => x.id === id && (x.userId === this.user().id || this.user().role === 'ADMIN'));
    if (!o) throw new DemoError('Order not found');
    return o;
  }

  // ------------------------------------------------------------ promotions
  async promotions(at?: Date): Promise<PromoState> {
    await this.load();
    const now = new Date();
    const festivals = this.festivals();
    return {
      serverTime: now.toISOString(),
      festivals,
      offers: this.state.offers.filter((o) => o.isActive && new Date(o.endsAt) > now),
      theme: resolveTheme(festivals, at ?? now),
    };
  }
  async quote(req: QuoteRequest) {
    let userId: string | null = null;
    try {
      userId = this.user().id;
    } catch {
      /* guest */
    }
    return (await this.priced(userId, req)).q;
  }

  // ------------------------------------------------------------ admin
  private requireAdmin() {
    if (this.user().role !== 'ADMIN') throw new DemoError('Admin access required');
  }

  admin: AdminApi = {
    canImport: false,
    stats: async () => {
      this.requireAdmin();
      const all = await this.products();
      const counted = this.state.orders.filter((o) => ['PAID', 'CONFIRMED_COD', 'SHIPPED', 'DELIVERED'].includes(o.status));
      return {
        products: all.length,
        dummyProducts: all.filter((p) => p.isDummy).length,
        productsWithoutImages: all.filter((p) => !p.thumbnailUrl).length,
        imageMappings: 0,
        users: Object.keys(this.state.users).length,
        orders: this.state.orders.length,
        revenue: counted.reduce((s, o) => s + o.total, 0),
      };
    },
    offers: async () => {
      this.requireAdmin();
      await this.load();
      return [...this.state.offers].sort((a, b) => b.startsAt.localeCompare(a.startsAt));
    },
    createOffer: async (o) => {
      this.requireAdmin();
      const errors = validateOffer(o);
      if (errors.length) throw new DemoError(errors.join('. '));
      const created: Offer = { ...o, id: uid(), code: o.code ? o.code.toUpperCase() : null, claimedCount: o.claimedCount ?? 0 };
      this.state.offers.push(created);
      this.save();
      return created;
    },
    updateOffer: async (id, patch) => {
      this.requireAdmin();
      const i = this.state.offers.findIndex((x) => x.id === id);
      if (i < 0) throw new DemoError('Offer not found');
      const next = { ...this.state.offers[i], ...patch, id };
      const errors = validateOffer(next);
      if (errors.length) throw new DemoError(errors.join('. '));
      next.code = next.code ? next.code.toUpperCase() : null;
      this.state.offers[i] = next;
      this.save();
      return next;
    },
    deleteOffer: async (id) => {
      this.requireAdmin();
      this.state.offers = this.state.offers.filter((x) => x.id !== id);
      this.save();
    },
    festivals: async () => this.festivals(),
    saveFestival: async (f) => {
      this.requireAdmin();
      const errors = validateFestival(f);
      if (errors.length) throw new DemoError(errors.join('. '));
      this.state.festivalOverrides = [...this.state.festivalOverrides.filter((o) => o.id !== f.id), f];
      this.save();
      return this.festivals();
    },
    deleteFestival: async (id) => {
      this.requireAdmin();
      this.state.festivalOverrides = this.state.festivalOverrides.filter((o) => o.id !== id);
      if (DEFAULT_FESTIVALS.some((f) => f.id === id)) this.state.festivalOverrides.push({ id, deleted: true });
      this.save();
      return this.festivals();
    },
    resetFestivals: async () => {
      this.requireAdmin();
      this.state.festivalOverrides = [];
      this.save();
      return this.festivals();
    },
    createDrafts: async (festivalId, year) => {
      this.requireAdmin();
      const now = new Date();
      const occ = occurrences(this.festivals()).find((o) => o.festival.id === festivalId && (year ? o.year === year : o.end.getTime() >= now.getTime()));
      if (!occ) throw new DemoError('No upcoming dates for this festival. Add them in the festival calendar first.');
      const top = [...(await this.products())].sort((a, b) => b.soldCount - a.soldCount).slice(0, 40);
      const drafts = draftFestivalOffers(occ, { now, categories: await this.categories(), topProducts: top }).map((d) => ({ ...d, id: uid() }));
      this.state.offers.push(...drafts);
      this.save();
      return drafts;
    },
    notifications: async () => {
      this.requireAdmin();
      await this.load();
      return dueReminders(this.festivals(), this.state.offers, new Date(), this.state.dismissed);
    },
    dismiss: async (id) => {
      this.state.dismissed = [...this.state.dismissed, id];
      this.save();
    },
    orders: async (page, status) => {
      this.requireAdmin();
      const list = this.state.orders.filter((o) => !status || o.status === status);
      return { items: list.slice((page - 1) * 20, page * 20), page, pageSize: 20, total: list.length, hasMore: page * 20 < list.length };
    },
    setOrderStatus: async (id, status) => {
      this.requireAdmin();
      return this.setStatus(id, status);
    },
    createProduct: async (p) => {
      this.requireAdmin();
      const created: Product = {
        id: uid(), sku: (p.sku ?? `SKU-${Date.now()}`).toUpperCase(), title: p.title ?? 'Untitled', description: p.description ?? '',
        brand: p.brand ?? null, condition: p.condition ?? 'NEW', price: p.price ?? 0, mrp: p.mrp ?? null, stock: p.stock ?? 0,
        categoryId: p.categoryId ?? null, specs: p.specs ?? {}, freeShipping: p.freeShipping ?? true, rating: 0, reviewCount: 0,
        soldCount: 0, thumbnailUrl: p.thumbnailUrl ?? null, images: p.thumbnailUrl ? [{ id: uid(), url: p.thumbnailUrl, position: 0 }] : [],
        isDummy: false, createdAt: new Date().toISOString(),
      };
      this.state.extraProducts.unshift(created);
      this.save();
      return created;
    },
    updateProduct: async (id, patch) => {
      this.requireAdmin();
      const extra = this.state.extraProducts.find((p) => p.id === id);
      if (extra) Object.assign(extra, patch);
      else this.state.productEdits[id] = { ...this.state.productEdits[id], ...patch };
      this.save();
      return this.product(id);
    },
    deleteProduct: async (id) => {
      this.requireAdmin();
      this.state.extraProducts = this.state.extraProducts.filter((p) => p.id !== id);
      this.state.productEdits[id] = { ...this.state.productEdits[id], deleted: true };
      this.save();
    },
    importProducts: async () => {
      throw new DemoError('Excel import needs the DGkart API. Run the site with VITE_DATA_MODE=api.');
    },
    importMapping: async () => {
      throw new DemoError('Image mapping import needs the DGkart API.');
    },
    uploadImages: async () => {
      throw new DemoError('Image upload needs the DGkart API.');
    },
    job: async () => {
      throw new DemoError('Import jobs run on the API.');
    },
    templateUrl: () => '#',
    seed: async () => {
      this.requireAdmin();
      let added = 0;
      for (const [id, e] of Object.entries(this.state.productEdits)) {
        if (e.deleted) {
          delete this.state.productEdits[id];
          added++;
        }
      }
      this.save();
      return { added };
    },
    wipeDummy: async () => {
      this.requireAdmin();
      const dummies = (await this.products()).filter((p) => p.isDummy);
      for (const p of dummies) this.state.productEdits[p.id] = { ...this.state.productEdits[p.id], deleted: true };
      this.save();
      return { deleted: dummies.length };
    },
  };
}
