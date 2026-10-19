/**
 * Website domain types. They mirror the API's JSON (backend/openapi.json), so
 * swapping demo data for the API, or the API for another backend, only means
 * writing another DataSource.
 */
import type { AdminReminder, AppliedOffer, CardType, Festival, Offer, Quote, ResolvedTheme } from '@engine';

export type Condition = 'NEW' | 'OPEN_BOX' | 'REFURBISHED' | 'USED';
export type Role = 'USER' | 'ADMIN';

export interface Category {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  parentId: string | null;
  sortOrder: number;
}

export interface ProductImage {
  id: string;
  url: string;
  position: number;
}

export interface Product {
  id: string;
  sku: string;
  title: string;
  description?: string;
  brand: string | null;
  condition: Condition;
  price: number;
  mrp: number | null;
  stock: number;
  categoryId: string | null;
  category?: Category | null;
  specs?: Record<string, string>;
  freeShipping: boolean;
  rating: number;
  reviewCount: number;
  soldCount: number;
  thumbnailUrl: string | null;
  images?: ProductImage[];
  isDummy?: boolean;
  isActive?: boolean;
  createdAt?: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export type SortKey = 'best' | 'price_asc' | 'price_desc' | 'newest';

export interface SearchQuery {
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: Condition;
  freeShipping?: boolean;
  sort?: SortKey;
  page?: number;
  pageSize?: number;
}

export interface HomeData {
  categories: Category[];
  dailyDeals: Product[];
  trending: Product[];
  newArrivals: Product[];
}

export interface Address {
  id: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
}

export interface User {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  role: Role;
  addresses: Address[];
}

export interface Session {
  accessToken: string;
  user: User;
}

export interface CartItem {
  productId: string;
  quantity: number;
  product: Product;
}

export type OrderStatus = 'PENDING_PAYMENT' | 'PAID' | 'PAYMENT_FAILED' | 'CONFIRMED_COD' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type PaymentMethod = 'ONLINE' | 'COD';

export interface OrderLine {
  productId: string;
  sku: string;
  title: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  listPrice?: number;
  lineTotal?: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  items: OrderLine[];
  subtotal: number;
  shippingFee: number;
  discount: number;
  discounts: AppliedOffer[];
  total: number;
  shippingAddress: Address;
  payment: Record<string, string>;
  createdAt: string;
}

export interface PlaceOrderInput {
  address: Address;
  paymentMethod: PaymentMethod;
  items?: { productId: string; quantity: number }[];
  couponCode?: string;
  clippedCouponIds?: string[];
  bank?: string;
  cardType?: CardType;
}

export interface QuoteRequest {
  items: { productId: string; quantity: number }[];
  couponCode?: string;
  clippedCouponIds?: string[];
  payment?: { method: PaymentMethod; bank?: string; cardType?: CardType };
}

export interface PromoState {
  serverTime: string;
  festivals: Festival[];
  offers: Offer[];
  theme?: ResolvedTheme;
}

export interface AdminStats {
  products: number;
  dummyProducts: number;
  productsWithoutImages?: number;
  imageMappings?: number;
  users: number;
  orders: number;
  revenue: number;
}

export interface ImportJob {
  id: string;
  type: 'PRODUCTS' | 'IMAGE_MAPPING' | 'SEED';
  status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED';
  fileName: string | null;
  totalRows: number;
  processedRows: number;
  upsertedRows: number;
  failedRows: number;
  errors: { row: number; message: string }[];
}

export interface ImageUploadResult {
  matched: { file: string; sku: string; position: number }[];
  unmatched: { file: string; reason: string }[];
}

export type { AdminReminder, Festival, Offer, Quote };
