import { FestivalTheme, Offer, ResolvedTheme, bestDeal, resolveTheme } from '@engine';
import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ds } from '../data';
import type { CartItem, Festival, Product, User } from '../data';
import { store } from '../lib/storage';
import { useNow } from '../lib/useNow';

// ------------------------------------------------------------------ toasts

interface Toast { id: number; text: string; kind: 'info' | 'error' | 'success' }
const ToastCtx = createContext<(text: string, kind?: Toast['kind']) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast toast-${t.kind}`}>{t.text}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

// ------------------------------------------------------------------ auth

interface AuthState {
  user: User | null;
  ready: boolean;
  isAdmin: boolean;
  signIn: (phone: string, code: string) => Promise<User>;
  signInWithFirebase: (idToken: string) => Promise<User>;
  signOut: () => void;
  setUser: (u: User) => void;
}
const AuthCtx = createContext<AuthState>(null!);
export const useAuth = () => useContext(AuthCtx);

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    ds.restore().then((u) => {
      setUser(u);
      setReady(true);
    });
  }, []);
  const value = useMemo<AuthState>(() => ({
    user,
    ready,
    isAdmin: user?.role === 'ADMIN',
    signIn: async (phone, code) => {
      const s = await ds.verifyOtp(phone, code);
      setUser(s.user);
      return s.user;
    },
    signInWithFirebase: async (token) => {
      const s = await ds.loginWithFirebase!(token);
      setUser(s.user);
      return s.user;
    },
    signOut: () => {
      ds.logout();
      setUser(null);
    },
    setUser,
  }), [user, ready]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

// ------------------------------------------------------------------ promotions + theme

interface PromoCtx {
  ready: boolean;
  offers: Offer[];
  festivals: Festival[];
  resolved: ResolvedTheme;
  /** Admin preview: show the site as it will look on this date. */
  previewDate: Date | null;
  setPreviewDate: (d: Date | null) => void;
  /** Clip coupons the shopper ticked. */
  clipped: string[];
  toggleClip: (id: string) => void;
  refresh: () => Promise<void>;
  dealFor: (p: Product) => ReturnType<typeof bestDeal>;
}
const PromoContext = createContext<PromoCtx>(null!);
export const usePromos = () => useContext(PromoContext);

const PREVIEW_KEY = 'dg.themePreview';
const CLIP_KEY = 'dg.clipped';

function readPreview(): Date | null {
  const fromUrl = new URLSearchParams(window.location.search).get('themeDate');
  const raw = fromUrl ?? store.get<string>(PREVIEW_KEY);
  if (!raw) return null;
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00+05:30` : raw);
  return isNaN(d.getTime()) ? null : d;
}

export function applyTheme(t: FestivalTheme) {
  const r = document.documentElement.style;
  r.setProperty('--primary', t.primary);
  r.setProperty('--primary-dark', t.primaryDark);
  r.setProperty('--accent', t.accent);
  r.setProperty('--header-bg', t.headerBg);
  r.setProperty('--header-text', t.headerText);
  r.setProperty('--footer-bg', t.footerBg);
  r.setProperty('--footer-text', t.footerText);
  r.setProperty('--banner-bg', t.bannerBg);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.primaryDark);
}

function PromoProvider({ children }: { children: ReactNode }) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [ready, setReady] = useState(false);
  const [previewDate, setPreview] = useState<Date | null>(readPreview);
  const [clipped, setClipped] = useState<string[]>(() => store.get<string[]>(CLIP_KEY) ?? []);
  // Re-check every minute so the theme flips on its own when a festival window opens or closes.
  const minute = useNow(60_000);

  const refresh = useCallback(async () => {
    try {
      const s = await ds.promotions();
      setOffers(s.offers);
      setFestivals(s.festivals);
    } finally {
      setReady(true);
    }
  }, []);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5 * 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  const resolved = useMemo(() => resolveTheme(festivals, previewDate ?? minute), [festivals, previewDate, minute]);
  useEffect(() => applyTheme(resolved.theme), [resolved]);
  useEffect(() => {
    document.documentElement.dataset.festival = resolved.occurrence?.festival.id ?? 'none';
  }, [resolved]);

  const value = useMemo<PromoCtx>(() => ({
    ready,
    offers,
    festivals,
    resolved,
    previewDate,
    setPreviewDate: (d) => {
      setPreview(d);
      if (d) store.set(PREVIEW_KEY, d.toISOString());
      else store.remove(PREVIEW_KEY);
    },
    clipped,
    toggleClip: (id) => {
      setClipped((c) => {
        const next = c.includes(id) ? c.filter((x) => x !== id) : [...c, id];
        store.set(CLIP_KEY, next);
        return next;
      });
    },
    refresh,
    dealFor: (p) => bestDeal(p, offers, new Date()),
  }), [ready, offers, festivals, resolved, previewDate, clipped, refresh]);

  return <PromoContext.Provider value={value}>{children}</PromoContext.Provider>;
}

// ------------------------------------------------------------------ cart

interface CartState {
  items: CartItem[];
  count: number;
  loading: boolean;
  add: (p: Product, qty?: number) => Promise<void>;
  setQty: (productId: string, qty: number) => Promise<void>;
  remove: (productId: string) => Promise<void>;
  reload: () => Promise<void>;
  /** After a cart checkout the server cart is empty; mirror that. */
  clearLocal: () => void;
}
const CartCtx = createContext<CartState>(null!);
export const useCart = () => useContext(CartCtx);

const GUEST_CART = 'dg.guestCart';

function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<CartItem[]>(() => store.get<CartItem[]>(GUEST_CART) ?? []);
  const [loading, setLoading] = useState(false);
  const prevUser = useRef<string | null>(null);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setItems(await ds.cart());
    } finally {
      setLoading(false);
    }
  }, [user]);

  // On sign-in, move the guest cart into the account cart.
  useEffect(() => {
    if (user && prevUser.current !== user.id) {
      prevUser.current = user.id;
      const guest = store.get<CartItem[]>(GUEST_CART) ?? [];
      (async () => {
        for (const g of guest) {
          try {
            await ds.addToCart(g.productId, g.quantity);
          } catch {
            /* out of stock: skip */
          }
        }
        store.remove(GUEST_CART);
        await reload();
      })();
    }
    if (!user && prevUser.current) {
      prevUser.current = null;
      setItems([]);
    }
  }, [user, reload]);

  const saveGuest = (next: CartItem[]) => {
    store.set(GUEST_CART, next);
    setItems(next);
  };

  const value = useMemo<CartState>(() => ({
    items,
    count: items.reduce((s, i) => s + i.quantity, 0),
    loading,
    reload,
    clearLocal: () => (user ? setItems([]) : saveGuest([])),
    add: async (p, qty = 1) => {
      try {
        if (user) setItems(await ds.addToCart(p.id, qty));
        else {
          const existing = items.find((i) => i.productId === p.id);
          const quantity = Math.min(p.stock, (existing?.quantity ?? 0) + qty);
          saveGuest(existing ? items.map((i) => (i.productId === p.id ? { ...i, quantity } : i)) : [...items, { productId: p.id, quantity, product: p }]);
        }
        toast('Added to cart', 'success');
      } catch (e) {
        toast(errorText(e), 'error');
        throw e;
      }
    },
    setQty: async (id, qty) => {
      try {
        if (user) setItems(await ds.setQuantity(id, qty));
        else saveGuest(qty <= 0 ? items.filter((i) => i.productId !== id) : items.map((i) => (i.productId === id ? { ...i, quantity: qty } : i)));
      } catch (e) {
        toast(errorText(e), 'error');
      }
    },
    remove: async (id) => {
      if (user) setItems(await ds.removeFromCart(id));
      else saveGuest(items.filter((i) => i.productId !== id));
    },
  }), [items, loading, user, reload, toast]);

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <PromoProvider>
          <CartProvider>{children}</CartProvider>
        </PromoProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
