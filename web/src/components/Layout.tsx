import { pendingCount } from '@engine';
import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { config } from '../config/env';
import { site } from '../config/site';
import { ds } from '../data';
import type { AdminReminder, Category } from '../data';
import { date } from '../lib/format';
import { store } from '../lib/storage';
import { useAuth, useCart, usePromos } from '../state/AppState';
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

function SearchBar({ categories }: { categories: Category[] }) {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [cat, setCat] = useState(params.get('category') ?? '');
  useEffect(() => setQ(params.get('q') ?? ''), [params]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const u = new URLSearchParams();
    if (q.trim()) u.set('q', q.trim());
    if (cat) u.set('category', cat);
    nav(`/search?${u}`);
  };
  return (
    <form className="search" role="search" onSubmit={submit}>
      <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Search in category" className="search-cat">
        <option value="">All</option>
        {categories.filter((c) => !c.parentId).map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
      </select>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search on ${site.name}`} aria-label="Search products" enterKeyHint="search" />
      <button type="submit" aria-label="Search"><Icon name="search" /></button>
    </form>
  );
}

function Bell({ reminders }: { reminders: AdminReminder[] }) {
  const [open, setOpen] = useState(false);
  const pending = pendingCount(reminders);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
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
  const { user, isAdmin } = useAuth();
  const { count } = useCart();
  const { resolved } = usePromos();
  const categories = useCategories();
  const reminders = useAdminReminders();
  const [menu, setMenu] = useState(false);
  const occ = resolved.occurrence;
  const theme = resolved.theme;
  const pin = user?.addresses.find((a) => a.isDefault) ?? user?.addresses[0];
  return (
    <header className="site-header" style={theme.headerImage ? { backgroundImage: `url(${theme.headerImage})` } : undefined}>
      <div className="header-main container">
        <button className="icon-btn header-icon only-mobile" onClick={() => setMenu(true)} aria-label="Open menu"><Icon name="menu" /></button>
        <Logo light={theme.headerBg !== '#FFFFFF'} />
        {occ && <span className="header-motif" title={occ.festival.greeting}><Motif motif={theme.motif} size={30} /></span>}
        <Link to={user ? '/account/addresses' : '/login'} className="deliver only-desktop">
          <Icon name="location" size={18} />
          <span><small>Deliver to</small><strong>{pin ? `${pin.city} ${pin.pincode}` : 'Select address'}</strong></span>
        </Link>
        <div className="only-desktop grow"><SearchBar categories={categories} /></div>
        <div className="header-actions">
          {isAdmin && <Bell reminders={reminders} />}
          <Link to={user ? '/account' : '/login'} className="header-link only-desktop">
            <small>{user ? `Hello, ${user.name?.split(' ')[0] ?? 'there'}` : 'Hello, sign in'}</small>
            <strong>Account</strong>
          </Link>
          <Link to="/orders" className="header-link only-desktop"><small>Returns</small><strong>& Orders</strong></Link>
          {isAdmin && <Link to="/admin" className="header-link only-desktop"><small>Manage</small><strong>Admin</strong></Link>}
          <Link to="/cart" className="header-cart" aria-label={`Cart, ${count} items`}>
            <Icon name="cart" size={28} />
            <span className="cart-count">{count}</span>
            <strong className="only-desktop">Cart</strong>
          </Link>
        </div>
      </div>
      <div className="container only-mobile mobile-search"><SearchBar categories={categories} /></div>
      <nav className="header-nav" aria-label="Shop">
        <div className="container header-nav-inner">
          <button className="nav-all only-desktop" onClick={() => setMenu(true)}><Icon name="menu" size={18} /> All</button>
          {occ && <NavLink to="/deals" className="nav-festival">{occ.festival.name} Sale</NavLink>}
          <NavLink to="/deals">Today’s Deals</NavLink>
          <NavLink to="/deals?tab=lightning">Lightning Deals</NavLink>
          <NavLink to="/deals?tab=offers">Coupons & Bank Offers</NavLink>
          {categories.filter((c) => !c.parentId).slice(0, 8).map((c) => <NavLink key={c.id} to={`/search?category=${c.slug}`}>{c.name}</NavLink>)}
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
    <footer className="site-footer" style={theme.footerImage ? { backgroundImage: `url(${theme.footerImage})` } : undefined}>
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
          <Logo light />
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
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return (
    <div className="app">
      <a href="#main" className="skip">Skip to content</a>
      <AnnouncementBar />
      <Header />
      <main id="main" className="site-main">{children}</main>
      <Footer />
      <TabBar />
    </div>
  );
}
