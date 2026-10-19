import { pendingCount } from '@engine';
import { FormEvent, KeyboardEvent, ReactNode, useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { config } from '../config/env';
import { site } from '../config/site';
import { ds } from '../data';
import type { AdminReminder, Category } from '../data';
import { date } from '../lib/format';
import { store } from '../lib/storage';
import { cssUrl, isLight, useAuth, useCart, usePromos } from '../state/AppState';
import { DecorStrip, Motif } from './FestivalArt';
import { Icon } from './Icon';
import { Logo } from './ui';

let categoryCache: Promise<Category[]> | null = null;
export function useCategories() {
  const [cats, setCats] = useState<Category[]>([]);
  useEffect(() => {
    categoryCache ??= ds.categories().catch(() => {
      categoryCache = null;
      return [];
    });
    categoryCache.then(setCats);
  }, []);
  return cats;
}

/** Admin festival reminders, polled every 10 minutes; also raises a browser notification once per reminder. */
export function useAdminReminders() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<AdminReminder[]>([]);
  useEffect(() => {
    if (!isAdmin) return setItems([]);
    let alive = true;
    const load = () =>
      ds.admin.notifications().then((r) => {
        if (!alive) return;
        setItems(r);
        notifyBrowser(r);
      }).catch(() => {});
    load();
    const t = setInterval(load, 10 * 60_000);
    window.addEventListener('dg:reminders-changed', load);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener('dg:reminders-changed', load);
    };
  }, [isAdmin]);
  return items;
}

function notifyBrowser(reminders: AdminReminder[]) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const seen = store.get<string[]>('dg.notified') ?? [];
  const fresh = reminders.filter((r) => !r.offersReady && !seen.includes(r.id));
  for (const r of fresh) new Notification(`DGkart admin: ${r.title}`, { body: r.body, tag: r.id });
  if (fresh.length) store.set('dg.notified', [...seen, ...fresh.map((r) => r.id)].slice(-200));
}

interface Suggestion { key: string; label: string; hint?: string; to: string }

/** Bold the part of `text` that matches what was typed. */
function Highlight({ text, q }: { text: string; q: string }) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0 || !q) return <>{text}</>;
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

function SearchBar({ categories }: { categories: Category[] }) {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [cat, setCat] = useState(params.get('category') ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [products, setProducts] = useState<Suggestion[]>([]);
  useEffect(() => {
    setQ(params.get('q') ?? '');
  }, [params]);

  // Type-ahead: matching categories straight away, product titles after a short pause.
  const term = q.trim();
  useEffect(() => {
    if (term.length < 2) {
      setProducts([]);
      return;
    }
    let alive = true;
    const t = setTimeout(() => {
      ds.search({ q: term, category: cat || undefined, pageSize: 5 })
        .then((r) => alive && setProducts(r.items.map((p) => ({ key: p.id, label: p.title, to: `/product/${p.id}` }))))
        .catch(() => {});
    }, 150);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [term, cat]);
  const suggestions: Suggestion[] = term.length < 2 ? [] : [
    ...categories
      .filter((c) => c.name.toLowerCase().includes(term.toLowerCase()))
      .slice(0, 3)
      .map((c) => ({ key: `c-${c.id}`, label: c.name, hint: 'Category', to: `/search?category=${c.slug}` })),
    ...products,
  ];
  const show = open && suggestions.length > 0;

  const go = (to: string) => {
    setOpen(false);
    setActive(-1);
    nav(to);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (show && active >= 0) return go(suggestions[active].to);
    const u = new URLSearchParams();
    if (term) u.set('q', term);
    if (cat) u.set('category', cat);
    go(`/search?${u}`);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && suggestions.length) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp' && suggestions.length) {
      e.preventDefault();
      setActive((a) => (a <= 0 ? suggestions.length - 1 : a - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };
  return (
    <form className="search" role="search" onSubmit={submit}>
      <div className="search-wrap">
        <div className="search-box">
          <Icon name="search" size={20} className="search-icon" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={onKeyDown}
            placeholder="Search for anything"
            aria-label="Search products"
            enterKeyHint="search"
            role="combobox"
            aria-expanded={show}
            aria-controls="search-suggest"
            aria-autocomplete="list"
            aria-activedescendant={show && active >= 0 ? `sug-${active}` : undefined}
            autoComplete="off"
          />
          <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Search in category" className="search-cat only-desktop">
            <option value="">All Categories</option>
            {categories.filter((c) => !c.parentId).map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
        </div>
        {show && (
          <ul className="suggest" id="search-suggest" role="listbox">
            {suggestions.map((s, i) => (
              <li
                key={s.key}
                id={`sug-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(s.to)}
              >
                <Icon name={s.hint ? 'grid' : 'search'} size={16} />
                <span><Highlight text={s.label} q={term} /></span>
                {s.hint && <span className="muted">{s.hint}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <button type="submit" className="search-btn"><span className="only-desktop">Search</span><Icon name="search" size={22} className="only-mobile" /></button>
    </form>
  );
}

/** "Shop by category" mega menu (desktop). */
function CategoryMenu({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [loc.pathname, loc.search]);
  const roots = categories.filter((c) => !c.parentId);
  return (
    <div className="catmenu only-desktop" onMouseLeave={() => setOpen(false)}>
      <button className="catmenu-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        Shop by category <Icon name="chevronDown" size={18} />
      </button>
      {open && (
        <div className="catmenu-panel">
          {roots.map((r) => (
            <div key={r.id}>
              <Link to={`/search?category=${r.slug}`} className="catmenu-root">{r.name}</Link>
              {categories.filter((c) => c.parentId === r.id).slice(0, 6).map((c) => <Link key={c.id} to={`/search?category=${c.slug}`}>{c.name}</Link>)}
            </div>
          ))}
          <Link to="/categories" className="catmenu-all">See all categories <Icon name="chevronRight" size={16} /></Link>
        </div>
      )}
    </div>
  );
}

function Bell({ reminders }: { reminders: AdminReminder[] }) {
  const [open, setOpen] = useState(false);
  const pending = pendingCount(reminders);
  const loc = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [loc.pathname]);
  return (
    <div className="bell">
      <button className="icon-btn header-icon" onClick={() => setOpen((o) => !o)} aria-label={`Admin notifications (${pending} need action)`} aria-expanded={open}>
        <Icon name="bell" />
        {pending > 0 && <span className="dot-count">{pending}</span>}
      </button>
      {open && (
        <div className="bell-panel card">
          <div className="bell-head"><strong>Festival reminders</strong><Link to="/admin/notifications">View all</Link></div>
          {reminders.length === 0 && <p className="muted">Nothing due. You will be reminded weeks before each festival.</p>}
          {reminders.slice(0, 4).map((r) => (
            <Link key={r.id} to={`/admin/notifications#${r.id}`} className={`bell-item lvl-${r.offersReady ? 'ok' : r.level}`}>
              <strong>{r.title}</strong>
              <span className="muted small">Starts {date(r.festivalStart)} · {r.daysLeft} days left</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Drawer({ open, onClose, categories }: { open: boolean; onClose: () => void; categories: Category[] }) {
  const { user, isAdmin, signOut } = useAuth();
  if (!open) return null;
  const roots = categories.filter((c) => !c.parentId);
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <nav className="drawer" onClick={(e) => e.stopPropagation()} aria-label="Menu">
        <div className="drawer-head">
          <Icon name="user" />
          <span>{user ? `Hello, ${user.name ?? user.phone}` : 'Hello, sign in'}</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close menu"><Icon name="close" /></button>
        </div>
        <div className="drawer-body" onClick={onClose}>
          <h3>Shop</h3>
          <Link to="/deals">Today’s Deals</Link>
          <Link to="/deals?tab=offers">Coupons & bank offers</Link>
          <Link to="/categories">All categories</Link>
          <h3>Categories</h3>
          {roots.map((c) => <Link key={c.id} to={`/search?category=${c.slug}`}>{c.name}</Link>)}
          <h3>Your account</h3>
          {user ? (
            <>
              <Link to="/account">Account</Link>
              <Link to="/orders">Orders</Link>
              <Link to="/watchlist">Watchlist</Link>
              {isAdmin && <Link to="/admin">Admin panel</Link>}
              <button className="link" onClick={signOut}>Sign out</button>
            </>
          ) : (
            <Link to="/login">Sign in</Link>
          )}
          <h3>Help</h3>
          <Link to="/help">Help centre</Link>
        </div>
      </nav>
    </div>
  );
}

function Header() {
  const { user, isAdmin, signOut } = useAuth();
  const { count } = useCart();
  const { resolved } = usePromos();
  const categories = useCategories();
  const reminders = useAdminReminders();
  const [menu, setMenu] = useState(false);
  const occ = resolved.occurrence;
  const theme = resolved.theme;
  const pin = user?.addresses.find((a) => a.isDefault) ?? user?.addresses[0];
  const light = !isLight(theme.headerBg);
  const roots = categories.filter((c) => !c.parentId);
  const [params] = useSearchParams();
  const cat = categories.find((c) => c.slug === params.get('category'));
  const activeCat = cat?.parentId ? categories.find((c) => c.id === cat.parentId)?.slug : cat?.slug;
  return (
    <header className={`site-header${light ? ' on-dark' : ''}`} style={theme.headerImage ? { backgroundImage: cssUrl(theme.headerImage) } : undefined}>
      <div className="topbar only-desktop">
        <div className="container topbar-inner">
          <span>
            {user ? <>Hi <strong>{user.name?.split(' ')[0] ?? 'there'}</strong>! <button className="link" onClick={signOut}>Sign out</button></> : <>Hi! <Link to="/login">Sign in</Link> or <Link to="/login">register</Link></>}
          </span>
          {occ && <Link to="/deals" className="topbar-festival">{occ.festival.name} Sale</Link>}
          <Link to="/deals">Daily Deals</Link>
          <Link to="/deals?tab=offers">Coupons &amp; Bank Offers</Link>
          <Link to="/help">Help &amp; Contact</Link>
          <span className="grow" />
          <Link to={user ? '/account/addresses' : '/login'} className="deliver"><Icon name="location" size={15} />{pin ? `Deliver to ${pin.city} ${pin.pincode}` : 'Deliver to'}</Link>
          <Link to="/watchlist">Watchlist</Link>
          <Link to={user ? '/orders' : '/login?next=/orders'}>My {site.name}</Link>
          {isAdmin && <Link to="/admin">Admin</Link>}
          {isAdmin && <Bell reminders={reminders} />}
          <Link to="/cart" className="header-cart" aria-label={`Cart, ${count} items`}>
            <Icon name="cart" size={22} />
            {count > 0 && <span className="dot-count">{count}</span>}
          </Link>
        </div>
      </div>
      <div className="header-main container">
        <button className="icon-btn header-icon only-mobile" onClick={() => setMenu(true)} aria-label="Open menu"><Icon name="menu" /></button>
        <Logo light={light} />
        {occ && <span className="header-motif" title={occ.festival.greeting}><Motif motif={theme.motif} size={30} /></span>}
        <CategoryMenu categories={categories} />
        <div className="only-desktop grow"><SearchBar categories={categories} /></div>
        <div className="header-actions only-mobile">
          {isAdmin && <Bell reminders={reminders} />}
          <Link to="/cart" className="header-cart" aria-label={`Cart, ${count} items`}>
            <Icon name="cart" size={26} />
            {count > 0 && <span className="dot-count">{count}</span>}
          </Link>
        </div>
      </div>
      <div className="container only-mobile mobile-search"><SearchBar categories={categories} /></div>
      <nav className="header-nav" aria-label="Shop">
        <div className="container header-nav-inner">
          <NavLink to="/" end>Home</NavLink>
          {occ && <NavLink to="/deals" className="nav-festival">{occ.festival.name} Sale</NavLink>}
          <Link to="/deals?tab=lightning">Lightning Deals</Link>
          <NavLink to="/watchlist">Saved</NavLink>
          {roots.slice(0, 9).map((c) => <Link key={c.id} to={`/search?category=${c.slug}`} className={activeCat === c.slug ? 'active' : undefined}>{c.name}</Link>)}
        </div>
      </nav>
      <DecorStrip decor={theme.decor} />
      <Drawer open={menu} onClose={() => setMenu(false)} categories={categories} />
    </header>
  );
}

function AnnouncementBar() {
  const { resolved, previewDate, setPreviewDate } = usePromos();
  const occ = resolved.occurrence;
  return (
    <>
      {previewDate && (
        <div className="preview-bar">
          Previewing the site as on {date(previewDate)}.
          <button className="link" onClick={() => setPreviewDate(null)}>Back to today</button>
        </div>
      )}
      {config.dataMode === 'demo' && !previewDate && <div className="demo-bar">Demo store: sample products, OTP {site.demoOtp}, payments are simulated.</div>}
      {occ && (
        <Link to="/deals" className="announce">
          <Motif motif={resolved.theme.motif} size={20} />
          {resolved.phase === 'lead-up'
            ? `${occ.festival.greeting}! ${occ.festival.name} starts in ${resolved.daysToStart} day${resolved.daysToStart === 1 ? '' : 's'}. Early deals are live.`
            : resolved.phase === 'live'
              ? `${occ.festival.greeting}! ${occ.festival.tagline}`
              : `Last chance: ${occ.festival.name} deals end soon`}
        </Link>
      )}
    </>
  );
}

function Footer() {
  const { resolved } = usePromos();
  const theme = resolved.theme;
  const occ = resolved.occurrence;
  return (
    <footer className={`site-footer${isLight(theme.footerBg) ? '' : ' on-dark'}`} style={theme.footerImage ? { backgroundImage: cssUrl(theme.footerImage) } : undefined}>
      <DecorStrip decor={theme.decor} />
      <button className="back-to-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Back to top</button>
      <div className="container footer-grid">
        {site.footer.map((col) => (
          <div key={col.title}>
            <h3>{col.title}</h3>
            <ul>{col.links.map((l) => <li key={l.label}><Link to={l.to}>{l.label}</Link></li>)}</ul>
          </div>
        ))}
      </div>
      <div className="container footer-mid">
        <div>
          <Logo light={!isLight(theme.footerBg)} />
          <p className="footer-tag">{occ ? `${occ.festival.greeting} from all of us at ${site.name}!` : site.tagline}</p>
        </div>
        <div className="pay-methods" aria-label="Payment methods">{site.paymentMethods.map((m) => <span key={m}>{m}</span>)}</div>
        <div className="social">{site.social.map((s) => <a key={s.label} href={s.href} target="_blank" rel="noreferrer">{s.label}</a>)}</div>
      </div>
      <div className="footer-bottom">
        {occ && <Motif motif={theme.motif} size={36} className="footer-motif" />}
        <span>© {new Date().getFullYear()} {site.domain}. All rights reserved.</span>
        <span>{site.address} · <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a></span>
      </div>
    </footer>
  );
}

function TabBar() {
  const { count } = useCart();
  const { user, isAdmin } = useAuth();
  return (
    <nav className="tabbar only-mobile" aria-label="Main">
      <NavLink to="/" end><Icon name="home" /><span>Home</span></NavLink>
      <NavLink to="/categories"><Icon name="grid" /><span>Categories</span></NavLink>
      <NavLink to="/deals"><Icon name="tag" /><span>Deals</span></NavLink>
      <NavLink to={user ? '/account' : '/login'}><Icon name="user" /><span>{user ? 'Account' : 'Sign in'}</span></NavLink>
      {isAdmin ? <NavLink to="/admin"><Icon name="admin" /><span>Admin</span></NavLink> : (
        <NavLink to="/cart" className="tab-cart"><Icon name="cart" />{count > 0 && <span className="dot-count">{count}</span>}<span>Cart</span></NavLink>
      )}
    </nav>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  // Block body: newer browsers return a Promise from scrollTo, which React would call as a cleanup.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <div className="app">
      <a href="#main" className="skip">Skip to content</a>
      <AnnouncementBar />
      <Header />
      <main id="main" className="site-main">
        {/* Re-keyed per page so each page eases in rather than snapping. */}
        <div key={pathname} className="page-enter">{children}</div>
      </main>
      <Footer />
      <TabBar />
    </div>
  );
}
