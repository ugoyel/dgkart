import { productOffers } from '@engine';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DeliveryCheck, RecentlyViewed, recordView } from '../components/Extras';
import { Icon } from '../components/Icon';
import { ClaimBar, Countdown, DealBadge, Empty, Img, PriceBlock, ProductCard, Rail, Spinner, Stars, useTitle } from '../components/ui';
import { site } from '../config/site';
import { ds } from '../data';
import { compact, conditionLabel, money } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { errorText, useAuth, useCart, usePromos, useToast } from '../state/AppState';

export function ProductPage() {
  const { id = '' } = useParams();
  const { data: p, error } = useAsync(() => ds.product(id), [id]);
  const { data: similar } = useAsync(() => ds.similar(id), [id]);
  const { offers, clipped, toggleClip } = usePromos();
  const { user } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const nav = useNavigate();
  const [img, setImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [watched, setWatched] = useState(false);
  useTitle(p?.title ?? 'Product');
  useEffect(() => {
    setImg(0);
    setQty(1);
  }, [id]);
  useEffect(() => {
    if (p?.id) recordView(p.id);
  }, [p?.id]);
  useEffect(() => {
    if (user) ds.watchlist().then((w) => setWatched(w.some((x) => x.id === id))).catch(() => {});
  }, [user, id]);

  if (error) return <div className="container"><Empty title="Product not found">{error}</Empty></div>;
  if (!p) return <div className="container"><Spinner /></div>;

  const now = new Date();
  const po = productOffers(p, offers, now);
  const deal = po.deal;
  const images = p.images?.length ? p.images : [{ id: 'thumb', url: p.thumbnailUrl ?? '', position: 0 }];
  const inStock = p.stock > 0;

  const toggleWatch = async () => {
    if (!user) return nav(`/login?next=/product/${p.id}`);
    try {
      await ds.setWatched(p.id, !watched);
      setWatched(!watched);
      toast(watched ? 'Removed from watchlist' : 'Added to watchlist', 'success');
    } catch (e) {
      toast(errorText(e), 'error');
    }
  };

  return (
    <div className="container product-page">
      <div className="breadcrumbs">
        <Link to="/">Home</Link> ›{' '}
        {p.category ? <Link to={`/search?category=${p.category.slug}`}>{p.category.name}</Link> : 'Products'} › <span>{p.brand ?? p.sku}</span>
      </div>
      <div className="pdp">
        <div className="gallery">
          <div className="gallery-thumbs">
            {images.map((im, i) => (
              <button key={im.id} className={i === img ? 'on' : ''} onClick={() => setImg(i)} aria-label={`Image ${i + 1}`}>
                <Img src={im.url} alt="" />
              </button>
            ))}
          </div>
          <div className="gallery-main">
            <Img src={images[img]?.url} alt={p.title} />
            {images.length > 1 && <span className="gallery-count">{img + 1} of {images.length}</span>}
            <button className={`watch ${watched ? 'on' : ''}`} onClick={toggleWatch} aria-label={watched ? 'Remove from watchlist' : 'Add to watchlist'}>
              <Icon name={watched ? 'heartFill' : 'heart'} />
            </button>
          </div>
        </div>

        <div className="pdp-info">
          {p.brand && <Link to={`/search?q=${encodeURIComponent(p.brand)}`} className="brand">Visit the {p.brand} store</Link>}
          <h1>{p.title}</h1>
          <div className="pdp-meta">
            <Stars rating={p.rating} count={p.reviewCount} />
            {p.soldCount > 0 && <span className="sold">{compact(p.soldCount)} sold</span>}
          </div>
          <hr />
          {deal && (
            <div className="pdp-deal">
              <DealBadge offer={deal.offer} />
              {(deal.offer.kind === 'LIGHTNING_DEAL' || deal.offer.kind === 'DEAL_OF_THE_DAY') && <Countdown to={deal.offer.endsAt} />}
            </div>
          )}
          <PriceBlock product={p} large />
          <span className="muted small">Inclusive of all taxes</span>
          {deal?.offer.kind === 'LIGHTNING_DEAL' && <ClaimBar offer={deal.offer} />}
          {po.upcoming.length > 0 && !deal && (
            <p className="note"><Icon name="bolt" size={16} /> Lightning deal coming: <Countdown to={po.upcoming[0].startsAt} prefix="starts in" /></p>
          )}

          {(po.clipCoupons.length > 0 || po.codeCoupons.length > 0 || po.bankOffers.length > 0) && (
            <div className="pdp-offers">
              <h2><Icon name="tag" size={18} /> Offers</h2>
              {po.clipCoupons.map((c) => (
                <label key={c.id} className="clip">
                  <input type="checkbox" checked={clipped.includes(c.id)} onChange={() => toggleClip(c.id)} />
                  <span className="clip-tag">Coupon</span>
                  <span>{clipped.includes(c.id) ? 'Coupon applied: ' : 'Apply '}{c.discount.type === 'PERCENT' ? `${c.discount.value}%` : money(c.discount.value)} coupon</span>
                </label>
              ))}
              <div className="offer-tiles">
                {po.bankOffers.slice(0, 3).map((o) => (
                  <div key={o.id} className="offer-tile"><strong>Bank Offer</strong><span>{o.title}{o.minOrder ? ` on orders of ${money(o.minOrder)}+` : ''}</span></div>
                ))}
                {po.codeCoupons.slice(0, 2).map((o) => (
                  <div key={o.id} className="offer-tile"><strong>Coupon</strong><span>{o.title}. Use <b>{o.code}</b> at checkout</span></div>
                ))}
              </div>
            </div>
          )}

          <dl className="facts">
            <dt>Condition</dt><dd>{conditionLabel[p.condition]}</dd>
            <dt>Delivery</dt><dd>{p.freeShipping ? 'Free delivery' : 'Free delivery on orders over ₹499'} in {site.delivery.standardDays} days</dd>
            <dt>Returns</dt><dd>{site.delivery.returnDays} days easy returns</dd>
            <dt>Availability</dt><dd className={inStock ? 'ok' : 'bad'}>{inStock ? (p.stock < 10 ? `Only ${p.stock} left in stock` : 'In stock') : 'Out of stock'}</dd>
          </dl>
        </div>

        <aside className="buy-box card">
          <PriceBlock product={p} />
          <p className="muted small"><Icon name="truck" size={16} /> {p.freeShipping ? 'FREE delivery' : 'Delivery ₹40 (free over ₹499)'}</p>
          <DeliveryCheck />
          <label className="qty-select">
            Quantity
            <select value={qty} onChange={(e) => setQty(Number(e.target.value))} disabled={!inStock}>
              {Array.from({ length: Math.max(1, Math.min(10, p.stock)) }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
            </select>
          </label>
          <button className="btn btn-accent" disabled={!inStock} onClick={() => nav(`/checkout?buy=${p.id}&qty=${qty}`)}>Buy It Now</button>
          <button className="btn" disabled={!inStock} onClick={() => cart.add(p, qty).catch(() => {})}>Add to cart</button>
          <button className="btn btn-outline" onClick={toggleWatch}><Icon name={watched ? 'heartFill' : 'heart'} size={18} /> {watched ? 'Watching' : 'Add to watchlist'}</button>
          <ul className="assure">
            <li><Icon name="shield" size={18} /> Secure payments</li>
            <li><Icon name="return" size={18} /> {site.delivery.returnDays}-day returns</li>
            <li><Icon name="truck" size={18} /> Ships from {site.name}</li>
          </ul>
        </aside>
      </div>

      <section className="pdp-details">
        {p.specs && Object.keys(p.specs).length > 0 && (
          <div>
            <h2>Item specifics</h2>
            <table className="specs"><tbody>{Object.entries(p.specs).map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody></table>
          </div>
        )}
        {p.description && (
          <div>
            <h2>About this item</h2>
            <p className="description">{p.description}</p>
            <p className="muted small">SKU {p.sku}</p>
          </div>
        )}
      </section>

      {similar && similar.length > 0 && (
        <Rail title="Similar items">{similar.map((s) => <div key={s.id} className="rail-item"><ProductCard product={s} /></div>)}</Rail>
      )}
      <RecentlyViewed key={p.id} exclude={p.id} />
    </div>
  );
}
