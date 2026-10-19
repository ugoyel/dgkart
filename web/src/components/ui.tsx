import { OFFER_LABELS, Offer, claimedPercent } from '@engine';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { site } from '../config/site';
import type { Product } from '../data';
import { compact, countdown, money, percentOff } from '../lib/format';
import { useNow } from '../lib/useNow';
import { usePromos, useWatch } from '../state/AppState';
import { Icon } from './Icon';

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className={`logo${light ? ' logo-light' : ''}`} aria-label={`${site.name} home`}>
      <span className="logo-left">{site.logo.left}</span>
      <span className="logo-right">{site.logo.right}</span>
    </Link>
  );
}

export function Img({ src, alt, className }: { src: string | null | undefined; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  if (!src || failed) {
    return (
      <div className={`img-fallback ${className ?? ''}`} role="img" aria-label={alt}>
        <Icon name="box" size={36} />
      </div>
    );
  }
  // Fade pictures in as they arrive instead of popping in line by line.
  return (
    <img
      src={src}
      alt={alt}
      className={`img-fade${loaded ? ' loaded' : ''}${className ? ` ${className}` : ''}`}
      loading="lazy"
      decoding="async"
      ref={(el) => {
        if (el?.complete && el.naturalWidth && !loaded) setLoaded(true);
      }}
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
    />
  );
}

export function Stars({ rating, count }: { rating: number; count?: number }) {
  const full = Math.round(rating * 2) / 2;
  return (
    <span className="stars" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      <span className="stars-track">
        <span className="stars-fill" style={{ width: `${(full / 5) * 100}%` }}>★★★★★</span>★★★★★
      </span>
      {count !== undefined && <span className="muted"> ({compact(count)})</span>}
    </span>
  );
}

const DEAL_CLASS: Record<string, string> = {
  LIGHTNING_DEAL: 'badge-lightning', DEAL_OF_THE_DAY: 'badge-dotd', FESTIVAL_SALE: 'badge-festival', CATEGORY_SALE: 'badge-sale',
};

export function DealBadge({ offer }: { offer: Offer }) {
  return <span className={`badge ${DEAL_CLASS[offer.kind] ?? ''}`}>{offer.kind === 'LIGHTNING_DEAL' && <Icon name="bolt" size={12} />}{OFFER_LABELS[offer.kind]}</span>;
}

export function Countdown({ to, prefix = 'Ends in' }: { to: string; prefix?: string }) {
  const now = useNow(1000);
  const ms = new Date(to).getTime() - now.getTime();
  return <span className="countdown"><Icon name="clock" size={14} /> {prefix} {countdown(ms)}</span>;
}

export function ClaimBar({ offer }: { offer: Offer }) {
  const pct = claimedPercent(offer);
  return (
    <div className="claim" aria-label={`${pct}% claimed`}>
      <div className="claim-track"><div className="claim-fill" style={{ transform: `scaleX(${pct / 100})` }} /></div>
      <span>{pct}% claimed</span>
    </div>
  );
}

/** Price block used by cards and the product page (applies the best live deal). */
export function PriceBlock({ product, large = false }: { product: Product; large?: boolean }) {
  const { dealFor } = usePromos();
  const deal = dealFor(product);
  const price = deal?.unitPrice ?? product.price;
  const was = deal ? Math.max(product.price, product.mrp ?? 0) : product.mrp;
  const off = percentOff(price, was);
  return (
    <div className={`price ${large ? 'price-lg' : ''}`}>
      <span className="price-now">{money(price)}</span>
      {was && was > price && <span className="price-was">{large ? 'M.R.P.: ' : ''}<s>{money(was)}</s></span>}
      {off > 0 && <span className="price-off">{off}% off</span>}
    </div>
  );
}

/** Heart button that saves a product to the watchlist (eBay style). */
export function WatchHeart({ productId }: { productId: string }) {
  const watch = useWatch();
  const nav = useNavigate();
  const loc = useLocation();
  const on = watch.has(productId);
  return (
    <button
      type="button"
      className={`heart${on ? ' on' : ''}`}
      aria-label={on ? 'Remove from watchlist' : 'Save to watchlist'}
      aria-pressed={on}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!(await watch.toggle(productId))) nav(`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`);
      }}
    >
      <Icon name={on ? 'heartFill' : 'heart'} size={20} />
    </button>
  );
}

export function ProductCard({ product, showDeal = true }: { product: Product; showDeal?: boolean }) {
  const { dealFor } = usePromos();
  const deal = showDeal ? dealFor(product) : null;
  return (
    <Link to={`/product/${product.id}`} className="product-card">
      <div className="product-card-img">
        <Img src={product.thumbnailUrl} alt={product.title} />
        {deal && <DealBadge offer={deal.offer} />}
        <WatchHeart productId={product.id} />
      </div>
      <div className="product-card-body">
        <h3 className="product-card-title">{product.title}</h3>
        {product.reviewCount > 0 && <Stars rating={product.rating} count={product.reviewCount} />}
        <PriceBlock product={product} />
        {deal?.offer.kind === 'LIGHTNING_DEAL' ? (
          <>
            <ClaimBar offer={deal.offer} />
            <Countdown to={deal.offer.endsAt} />
          </>
        ) : deal?.offer.kind === 'DEAL_OF_THE_DAY' ? (
          <Countdown to={deal.offer.endsAt} />
        ) : (
          <span className="muted small">{product.freeShipping ? 'Free delivery' : product.stock > 0 && product.stock < 10 ? `Only ${product.stock} left` : ' '}</span>
        )}
      </div>
    </Link>
  );
}

export function Rail({ title, to, children, action }: { title: ReactNode; to?: string; children: ReactNode; action?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const scroll = (d: number) => ref.current?.scrollBy({ left: d * ref.current.clientWidth * 0.8, behavior: 'smooth' });
  const measure = () => {
    const el = ref.current;
    if (el) setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  };
  useEffect(measure, [children]);
  return (
    <section className="rail">
      <div className="section-head">
        <h2>{title}</h2>
        {action}
        {to && <Link to={to} className="see-all">See all <Icon name="chevronRight" size={18} /></Link>}
      </div>
      <div className="rail-wrap">
        {!edge.start && <button className="rail-btn left" onClick={() => scroll(-1)} aria-label="Scroll left"><Icon name="chevronLeft" /></button>}
        <div className="rail-items" ref={ref} onScroll={measure}>{children}</div>
        {!edge.end && <button className="rail-btn right" onClick={() => scroll(1)} aria-label="Scroll right"><Icon name="chevronRight" /></button>}
      </div>
    </section>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <div className="spinner" role="status"><span className="spinner-dot" /><span className="sr-only">{label}</span></div>;
}

export function SkeletonGrid({ n = 8 }: { n?: number }) {
  return <div className="grid">{Array.from({ length: n }, (_, i) => <div key={i} className="card skeleton" />)}</div>;
}

export function Empty({ title, children, icon = 'box' }: { title: string; children?: ReactNode; icon?: Parameters<typeof Icon>[0]['name'] }) {
  return (
    <div className="empty">
      <Icon name={icon} size={48} />
      <h2>{title}</h2>
      {children}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', esc);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function QtyStepper({ value, max, onChange }: { value: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="qty" role="group" aria-label="Quantity">
      <button onClick={() => onChange(value - 1)} aria-label="Decrease">{value <= 1 ? <Icon name="trash" size={16} /> : <Icon name="minus" size={16} />}</button>
      <span>{value}</span>
      <button onClick={() => onChange(value + 1)} disabled={value >= Math.min(max, 99)} aria-label="Increase"><Icon name="plus" size={16} /></button>
    </div>
  );
}

export function useTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} | ${site.domain}` : `${site.domain}: ${site.tagline}`;
  }, [title]);
}
