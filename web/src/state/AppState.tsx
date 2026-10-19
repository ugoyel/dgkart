import { Appearance, FestivalTheme, Offer, ResolvedTheme, SLIDE_EASINGS, bestDeal, mergeAppearance, resolveSiteTheme } from '@engine';
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
  /** The admin's chosen look (banners, colours, transitions); a draft while the admin is editing. */
  appearance: Appearance;
  /** Admin live preview of unsaved look settings (null = the published ones). */
  setAppearanceDraft: (a: Appearance | null) => void;
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
const LOOK_CACHE = 'dg.look';

function readPreview(): Date | null {
  const fromUrl = new URLSearchParams(window.location.search).get('themeDate');
  const raw = fromUrl ?? store.get<string>(PREVIEW_KEY);
  if (!raw) return null;
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00+05:30` : raw);
  return isNaN(d.getTime()) ? null : d;
}

const SHADOWS = {
  flat: 'none',
  soft: '0 1px 2px rgba(15, 30, 61, 0.06), 0 2px 8px rgba(15, 30, 61, 0.06)',
  deep: '0 4px 10px rgba(15, 30, 61, 0.12), 0 12px 32px rgba(15, 30, 61, 0.14)',
};

/** CSS url() for an image setting, quoted so odd characters can't break out. */
export const cssUrl = (u: string) => `url("${encodeURI(u).replace(/"/g, '%22')}")`;

/** Page-wide look settings that are not festival colours. */
export function applyLook(a: Appearance) {
  const r = document.documentElement.style;
  r.setProperty('--page-bg', a.pageBg);
  r.setProperty('--page-bg-image', a.pageBgImage ? cssUrl(a.pageBgImage) : 'none');
  r.setProperty('--radius', `${a.radius}px`);
  r.setProperty('--radius-sm', `${Math.round(a.radius * 0.6)}px`);
  r.setProperty('--shadow', SHADOWS[a.shade]);
  r.setProperty('--slide-speed', `${a.slider.speedMs}ms`);
  r.setProperty('--slide-ease', SLIDE_EASINGS[a.slider.easing]);
}

/** Is a CSS colour light (so dark text/logo should sit on it)? Gradients use their first colour. */
export function isLight(css: string) {
  const m = css.match(/#([0-9a-f]{6}|[0-9a-f]{3})\b/i);
  if (!m) return !/gradient/.test(css);
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 160;
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
  const [published, setPublished] = useState<Appearance>(() => mergeAppearance(store.get<Appearance>(LOOK_CACHE)));
  const [draft, setDraft] = useState<Appearance | null>(null);
  const appearance = draft ?? published;
  // Re-check every minute so the theme flips on its own when a festival window opens or closes.
  const minute = useNow(60_000);

  const refresh = useCallback(async () => {
    try {
      const s = await ds.promotions();
      setOffers(s.offers);
      setFestivals(s.festivals);
      const look = mergeAppearance(s.appearance);
      setPublished(look);
      // Cached so the next visit paints the right banners and colours straight away.
      store.set(LOOK_CACHE, { ...look, heroSlides: look.heroSlides.filter((x) => !x.image?.startsWith('data:')), categoryBanners: {} });
    } finally {
      setReady(true);
    }
  }, []);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5 * 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  const resolved = useMemo(() => resolveSiteTheme(festivals, appearance, previewDate ?? minute), [festivals, appearance, previewDate, minute]);
  useEffect(() => {
    applyTheme(resolved.theme);
  }, [resolved]);
  useEffect(() => {
    applyLook(appearance);
  }, [appearance]);
  useEffect(() => {
    document.documentElement.dataset.festival = resolved.occurrence?.festival.id ?? 'none';
  }, [resolved]);

  const value = useMemo<PromoCtx>(() => ({
    ready,
    offers,
    festivals,
    resolved,
    appearance,
    setAppearanceDraft: setDraft,
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
  }), [ready, offers, festivals, resolved, appearance, previewDate, clipped, refresh]);

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

// ------------------------------------------------------------------ watchlist

interface WatchState {
  has: (productId: string) => boolean;
  /** Returns false when the shopper must sign in first. */
  toggle: (productId: string) => Promise<boolean>;
}
const WatchCtx = createContext<WatchState>(null!);
export const useWatch = () => useContext(WatchCtx);

function WatchProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const toast = useToast();
  const [ids, setIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!user) return setIds(new Set());
    ds.watchlist().then((w) => setIds(new Set(w.map((p) => p.id)))).catch(() => {});
  }, [user]);
  const value = useMemo<WatchState>(() => ({
    has: (id) => ids.has(id),
    toggle: async (id) => {
      if (!user) return false;
      const on = !ids.has(id);
      try {
        await ds.setWatched(id, on);
        setIds((s) => {
          const n = new Set(s);
          if (on) n.add(id);
          else n.delete(id);
          return n;
        });
        toast(on ? 'Saved to your watchlist' : 'Removed from watchlist', 'success');
      } catch (e) {
        toast(errorText(e), 'error');
      }
      return true;
    },
  }), [ids, user, toast]);
  return <WatchCtx.Provider value={value}>{children}</WatchCtx.Provider>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <PromoProvider>
          <CartProvider>
            <WatchProvider>{children}</WatchProvider>
          </CartProvider>
        </PromoProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
