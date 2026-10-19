import { config } from '../../config/env';
import { store } from '../../lib/storage';
import type { AdminApi, DataSource, PaymentUi } from '../source';
import type {
  Address, AdminReminder, AdminStats, CartItem, Category, Festival, HomeData, ImageUploadResult, ImportJob, Offer, Order,
  OrderStatus, Page, PlaceOrderInput, Product, PromoState, Quote, QuoteRequest, SearchQuery, Session, User,
} from '../types';
import { loadRazorpay } from './razorpay';

const TOKEN_KEY = 'dg.token';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Talks to the DGkart REST API (`/api/v1`, see backend/openapi.json). */
export class ApiDataSource implements DataSource {
  readonly mode = 'api' as const;
  private token: string | null = store.get<string>(TOKEN_KEY);

  constructor(private readonly base = config.apiBaseUrl + '/api/v1') {}

  private async call<T>(method: string, path: string, body?: unknown, form?: FormData): Promise<T> {
    const headers: Record<string, string> = {};
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let res: Response;
    try {
      res = await fetch(this.base + path, { method, headers, body: form ?? (body !== undefined ? JSON.stringify(body) : undefined) });
    } catch {
      throw new ApiError('Cannot reach DGkart right now. Check your connection and try again.', 0);
    }
    const text = await res.text();
    const json = text ? safeJson(text) : null;
    if (!res.ok) {
      if (res.status === 401 && this.token) this.logout();
      const msg = json && typeof json === 'object' && 'message' in json ? (json as { message: string | string[] }).message : res.statusText;
      throw new ApiError(Array.isArray(msg) ? msg.join('. ') : String(msg), res.status);
    }
    return json as T;
  }

  private qs(params: Record<string, unknown>): string {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '' && v !== false) u.set(k, String(v));
    const s = u.toString();
    return s ? `?${s}` : '';
  }

  // ------------------------------------------------------------ auth
  async authMode() {
    return (await this.call<{ mode: 'dev' | 'firebase' }>('GET', '/auth/config')).mode;
  }
  requestOtp(phone: string) {
    return this.call<{ hint?: string }>('POST', '/auth/otp/request', { phone });
  }
  async verifyOtp(phone: string, code: string) {
    return this.keep(await this.call<Session>('POST', '/auth/otp/verify', { phone, code }));
  }
  async loginWithFirebase(idToken: string) {
    return this.keep(await this.call<Session>('POST', '/auth/firebase', { idToken }));
  }
  private keep(s: Session): Session {
    this.token = s.accessToken;
    store.set(TOKEN_KEY, s.accessToken);
    return s;
  }
  async restore() {
    if (!this.token) return null;
    try {
      return await this.call<User>('GET', '/users/me');
    } catch {
      return null;
    }
  }
  logout() {
    this.token = null;
    store.remove(TOKEN_KEY);
  }
  updateProfile(patch: { name?: string; email?: string }) {
    return this.call<User>('PATCH', '/users/me', patch);
  }
  saveAddresses(addresses: Address[]) {
    return this.call<User>('PUT', '/users/me/addresses', { addresses });
  }

  // ------------------------------------------------------------ catalogue
  home() {
    return this.call<HomeData>('GET', '/home');
  }
  categories() {
    return this.call<Category[]>('GET', '/categories');
  }
  search(q: SearchQuery) {
    return this.call<Page<Product>>('GET', '/products' + this.qs({ ...q }));
  }
  product(id: string) {
    return this.call<Product>('GET', `/products/${id}`);
  }
  similar(id: string) {
    return this.call<Product[]>('GET', `/products/${id}/similar`);
  }
  async productsByIds(ids: string[]) {
    if (!ids.length) return [];
    const page = await this.call<Page<Product>>('GET', '/products' + this.qs({ ids: ids.slice(0, 100).join(','), pageSize: 100 }));
    const byId = new Map(page.items.map((p) => [p.id, p]));
    return ids.map((id) => byId.get(id)).filter((p): p is Product => !!p);
  }

  // ------------------------------------------------------------ cart
  private async cartItems(r: Promise<{ items: CartItem[] }>) {
    return (await r).items;
  }
  cart() {
    return this.cartItems(this.call('GET', '/cart'));
  }
  addToCart(productId: string, quantity: number) {
    return this.cartItems(this.call('POST', '/cart', { productId, quantity }));
  }
  setQuantity(productId: string, quantity: number) {
    return this.cartItems(this.call('PATCH', `/cart/${productId}`, { quantity }));
  }
  removeFromCart(productId: string) {
    return this.cartItems(this.call('DELETE', `/cart/${productId}`));
  }
  async watchlist() {
    const r = await this.call<{ items: { product: Product }[] } | Product[]>('GET', '/watchlist');
    return Array.isArray(r) ? r : r.items.map((i) => i.product);
  }
  async setWatched(productId: string, watched: boolean) {
    await this.call(watched ? 'PUT' : 'DELETE', `/watchlist/${productId}`);
  }

  // ------------------------------------------------------------ orders
  placeOrder(input: PlaceOrderInput) {
    return this.call<Order>('POST', '/orders', input);
  }
  async pay(order: Order, ui: PaymentUi): Promise<Order> {
    const g = await this.call<{ provider: 'razorpay' | 'mock'; gatewayOrderId: string; amount: number; keyId?: string; orderNumber: string }>(
      'POST', '/payments/checkout', { orderId: order.id },
    );
    if (g.provider === 'mock') {
      const r = await ui.simulate(order);
      if (r === 'success') return this.call<Order>('POST', '/payments/confirm', { orderId: order.id, gatewayOrderId: g.gatewayOrderId, paymentId: `mock_pay_${Date.now()}`, signature: 'mock-success' });
      if (r === 'failure') return this.call<Order>('POST', '/payments/fail', { orderId: order.id });
      return order;
    }
    const Razorpay = await loadRazorpay();
    const result = await new Promise<{ razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string } | null>((resolve) => {
      const rzp = new Razorpay({
        key: g.keyId,
        amount: g.amount,
        currency: 'INR',
        name: 'DGkart',
        description: `Order ${g.orderNumber}`,
        order_id: g.gatewayOrderId,
        prefill: { contact: order.shippingAddress.phone, name: order.shippingAddress.name },
        theme: { color: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#1A56DB' },
        handler: resolve,
        modal: { ondismiss: () => resolve(null) },
      });
      rzp.on('payment.failed', () => resolve(null));
      rzp.open();
    });
    if (!result) return this.call<Order>('POST', '/payments/fail', { orderId: order.id });
    return this.call<Order>('POST', '/payments/confirm', {
      orderId: order.id, gatewayOrderId: result.razorpay_order_id, paymentId: result.razorpay_payment_id, signature: result.razorpay_signature,
    });
  }
  orders(page = 1) {
    return this.call<Page<Order>>('GET', '/orders' + this.qs({ page, pageSize: 20 }));
  }
  order(id: string) {
    return this.call<Order>('GET', `/orders/${id}`);
  }

  // ------------------------------------------------------------ promotions
  promotions(at?: Date) {
    return this.call<PromoState>('GET', '/promotions' + this.qs({ at: at?.toISOString() }));
  }
  quote(req: QuoteRequest) {
    return this.call<Quote>('POST', '/promotions/quote', req);
  }

  // ------------------------------------------------------------ admin
  admin: AdminApi = {
    canImport: true,
    stats: () => this.call<AdminStats>('GET', '/admin/stats'),
    offers: () => this.call<Offer[]>('GET', '/admin/offers'),
    createOffer: (o) => this.call<Offer>('POST', '/admin/offers', o),
    updateOffer: (id, patch) => this.call<Offer>('PATCH', `/admin/offers/${id}`, stripId(patch)),
    deleteOffer: async (id) => void (await this.call('DELETE', `/admin/offers/${id}`)),
    festivals: () => this.call<Festival[]>('GET', '/admin/festivals'),
    saveFestival: (f) => this.call<Festival[]>('PUT', `/admin/festivals/${f.id}`, f),
    deleteFestival: (id) => this.call<Festival[]>('DELETE', `/admin/festivals/${id}`),
    resetFestivals: () => this.call<Festival[]>('POST', '/admin/festivals/reset'),
    createDrafts: (id, year) => this.call<Offer[]>('POST', `/admin/festivals/${id}/drafts` + this.qs({ year })),
    notifications: () => this.call<AdminReminder[]>('GET', '/admin/notifications'),
    dismiss: async (id) => void (await this.call('POST', `/admin/notifications/${encodeURIComponent(id)}/dismiss`)),
    orders: (page, status?: OrderStatus) => this.call<Page<Order>>('GET', '/admin/orders' + this.qs({ page, pageSize: 20, status })),
    setOrderStatus: (id, status) => this.call<Order>('PATCH', `/admin/orders/${id}/status`, { status }),
    createProduct: (p) => this.call<Product>('POST', '/admin/products', p),
    updateProduct: (id, patch) => this.call<Product>('PATCH', `/admin/products/${id}`, patch),
    deleteProduct: async (id) => void (await this.call('DELETE', `/admin/products/${id}`)),
    importProducts: (file) => this.call<ImportJob>('POST', '/admin/import/products', undefined, formOf('file', [file])),
    importMapping: (file) => this.call<ImportJob>('POST', '/admin/import/image-mapping', undefined, formOf('file', [file])),
    uploadImages: (files) => this.call<ImageUploadResult>('POST', '/admin/images', undefined, formOf('files', files)),
    job: (id) => this.call<ImportJob>('GET', `/admin/jobs/${id}`),
    templateUrl: (kind) => `${this.base}/admin/templates/${kind}.xlsx`,
    seed: (count) => this.call<ImportJob>('POST', '/admin/seed', { count }),
    wipeDummy: () => this.call<{ deleted: number }>('DELETE', '/admin/products/dummy'),
  };
}

function formOf(field: string, files: File[]) {
  const f = new FormData();
  for (const file of files) f.append(field, file, file.name);
  return f;
}

function stripId<T extends { id?: string }>(o: T): Omit<T, 'id'> {
  const { id: _id, ...rest } = o;
  return rest;
}

function safeJson(t: string): unknown {
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}
