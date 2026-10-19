import type { Appearance } from '@engine';
import type {
  Address, AdminReminder, AdminStats, CartItem, Category, Festival, HomeData, ImageUploadResult, ImportJob, Offer,
  Order, OrderStatus, Page, PlaceOrderInput, Product, PromoState, Quote, QuoteRequest, SearchQuery, Session, User,
} from './types';

/**
 * The website's only door to data (ports and adapters). Pages never call
 * fetch() or localStorage directly. Two adapters ship:
 *  - ApiDataSource: the DGkart REST API (same one the Android app uses)
 *  - DemoDataSource: runs in the browser with the app's sample catalogue
 * Moving to another backend means writing one more class.
 */
export interface DataSource {
  readonly mode: 'api' | 'demo';

  // auth
  authMode(): Promise<'dev' | 'firebase' | 'demo'>;
  requestOtp(phone: string): Promise<{ hint?: string }>;
  verifyOtp(phone: string, code: string): Promise<Session>;
  /** Firebase path: the client verified the OTP and passes the ID token. */
  loginWithFirebase?(idToken: string): Promise<Session>;
  restore(): Promise<User | null>;
  logout(): void;
  updateProfile(patch: { name?: string; email?: string }): Promise<User>;
  saveAddresses(addresses: Address[]): Promise<User>;

  // catalogue
  home(): Promise<HomeData>;
  categories(): Promise<Category[]>;
  search(q: SearchQuery): Promise<Page<Product>>;
  product(id: string): Promise<Product>;
  similar(id: string): Promise<Product[]>;
  /** Fetch several products (for deal strips). */
  productsByIds(ids: string[]): Promise<Product[]>;

  // cart and watchlist (signed-in shoppers; guests use a local cart)
  cart(): Promise<CartItem[]>;
  addToCart(productId: string, quantity: number): Promise<CartItem[]>;
  setQuantity(productId: string, quantity: number): Promise<CartItem[]>;
  removeFromCart(productId: string): Promise<CartItem[]>;
  watchlist(): Promise<Product[]>;
  setWatched(productId: string, watched: boolean): Promise<void>;

  // orders and payment
  placeOrder(input: PlaceOrderInput): Promise<Order>;
  /** Runs the payment step (Razorpay, or a simulated sheet) and returns the updated order. */
  pay(order: Order, ui: PaymentUi): Promise<Order>;
  orders(page?: number): Promise<Page<Order>>;
  order(id: string): Promise<Order>;

  // promotions
  promotions(at?: Date): Promise<PromoState>;
  quote(req: QuoteRequest): Promise<Quote>;

  admin: AdminApi;
}

/** Lets the data layer ask the page to show a payment sheet. */
export interface PaymentUi {
  simulate(order: Order): Promise<'success' | 'failure' | 'cancel'>;
}

export interface AdminApi {
  stats(): Promise<AdminStats>;
  offers(): Promise<Offer[]>;
  createOffer(o: Omit<Offer, 'id'>): Promise<Offer>;
  updateOffer(id: string, patch: Partial<Offer>): Promise<Offer>;
  deleteOffer(id: string): Promise<void>;
  festivals(): Promise<Festival[]>;
  saveFestival(f: Festival): Promise<Festival[]>;
  deleteFestival(id: string): Promise<Festival[]>;
  resetFestivals(): Promise<Festival[]>;
  createDrafts(festivalId: string, year?: string): Promise<Offer[]>;
  notifications(): Promise<AdminReminder[]>;
  dismiss(id: string): Promise<void>;
  orders(page: number, status?: OrderStatus): Promise<Page<Order>>;
  setOrderStatus(id: string, status: OrderStatus): Promise<Order>;
  createProduct(p: Partial<Product>): Promise<Product>;
  updateProduct(id: string, patch: Partial<Product>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  /** Catalogue upload needs the API (files are processed server-side). */
  readonly canImport: boolean;
  importProducts(file: File): Promise<ImportJob>;
  importMapping(file: File): Promise<ImportJob>;
  uploadImages(files: File[]): Promise<ImageUploadResult>;
  job(id: string): Promise<ImportJob>;
  templateUrl(kind: 'products' | 'image-mapping'): string;
  seed(count: number): Promise<ImportJob | { added: number }>;
  wipeDummy(): Promise<{ deleted: number }>;
  appearance(): Promise<Appearance>;
  saveAppearance(a: Appearance): Promise<Appearance>;
  resetAppearance(): Promise<Appearance>;
  /** Stores a banner / background image (already resized in the browser) and returns its URL. */
  uploadMedia(file: Blob, name: string): Promise<string>;
}
