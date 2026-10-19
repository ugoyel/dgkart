import { OFFER_LABELS, isLive, isUpcoming } from '@engine';
import { Link, useSearchParams } from 'react-router-dom';
import { Motif } from '../components/FestivalArt';
import { useCategories } from '../components/Layout';
import { ClaimBar, Countdown, Empty, Img, ProductCard, useTitle } from '../components/ui';
import { date, money } from '../lib/format';
import { usePromos } from '../state/AppState';
import { OfferCard, useDeals } from './Home';

const TABS = [
  { id: 'all', label: 'All deals' },
  { id: 'lightning', label: 'Lightning Deals' },
  { id: 'dotd', label: 'Deal of the Day' },
  { id: 'sales', label: 'Sales' },
  { id: 'offers', label: 'Coupons & Bank Offers' },
] as const;

export function Deals() {
  useTitle('Today’s Deals');
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'all';
  const { offers, resolved, clipped, toggleClip } = usePromos();
  const categories = useCategories();
  const lightning = useDeals(['LIGHTNING_DEAL'], true);
  const dotd = useDeals(['DEAL_OF_THE_DAY']);
  const now = new Date();
  const sales = offers.filter((o) => (o.kind === 'CATEGORY_SALE' || o.kind === 'FESTIVAL_SALE') && (isLive(o, now) || isUpcoming(o, now)));
  const coupons = offers.filter((o) => o.kind === 'COUPON' && isLive(o, now));
  const banks = offers.filter((o) => o.kind === 'BANK_OFFER' && isLive(o, now));
  const occ = resolved.occurrence;

  const liveLightning = lightning.filter((d) => isLive(d.offer, now));
  const soon = lightning.filter((d) => isUpcoming(d.offer, now));
  const slugFor = (ids: string[] = []) => categories.find((c) => ids.includes(c.id) && !c.parentId)?.slug ?? categories.find((c) => ids.includes(c.id))?.slug;

  return (
    <div className="container deals-page">
      <div className="deals-head" style={{ background: 'var(--banner-bg)' }}>
        <div>
          <h1>{occ ? `${occ.festival.name} Sale` : 'Today’s Deals'}</h1>
          <p>{occ ? occ.festival.tagline : 'Lightning deals, deals of the day, coupons and bank offers, refreshed every day.'}</p>
        </div>
        <Motif motif={resolved.theme.motif} size={90} />
      </div>
      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setParams({ tab: t.id })}>{t.label}</button>
        ))}
      </nav>

      {(tab === 'all' || tab === 'lightning') && (
        <section>
          <h2>Lightning Deals <span className="muted small">limited stock, limited time</span></h2>
          {liveLightning.length === 0 && soon.length === 0 && <p className="muted">No lightning deals right now. Check back soon.</p>}
          <div className="grid">{liveLightning.map(({ offer, product }) => <ProductCard key={offer.id + product.id} product={product} />)}</div>
          {soon.length > 0 && (
            <>
              <h3>Upcoming</h3>
              <div className="grid">
                {soon.map(({ offer, product }) => (
                  <Link key={offer.id + product.id} to={`/product/${product.id}`} className="product-card upcoming">
                    <div className="product-card-img"><Img src={product.thumbnailUrl} alt={product.title} /><span className="badge badge-soon">Upcoming</span></div>
                    <div className="product-card-body">
                      <h3 className="product-card-title">{product.title}</h3>
                      <span className="muted small">{offer.discount.type === 'PERCENT' ? `${offer.discount.value}% off` : `${money(offer.discount.value)} off`} · {offer.stockLimit} units</span>
                      <Countdown to={offer.startsAt} prefix="Starts in" />
                      <ClaimBar offer={offer} />
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {(tab === 'all' || tab === 'dotd') && (
        <section>
          <h2>Deal of the Day {dotd[0] && <Countdown to={dotd[0].offer.endsAt} />}</h2>
          {dotd.length === 0 && <p className="muted">Today’s deal of the day has ended. New deals start at midnight.</p>}
          <div className="grid">{dotd.map(({ offer, product }) => <ProductCard key={offer.id + product.id} product={product} />)}</div>
        </section>
      )}

      {(tab === 'all' || tab === 'sales') && (
        <section>
          <h2>Sales</h2>
          {sales.length === 0 && <p className="muted">No category sales running right now.</p>}
          <div className="sale-grid">
            {sales.map((o) => {
              const slug = slugFor(o.scope.categoryIds);
              return (
                <Link key={o.id} to={slug ? `/search?category=${slug}` : '/search'} className="card sale-card" style={{ background: o.bannerImage ? `center/cover url(${o.bannerImage})` : o.kind === 'FESTIVAL_SALE' ? 'var(--banner-bg)' : undefined }}>
                  <span className="badge badge-festival">{OFFER_LABELS[o.kind]}</span>
                  <strong>{o.title}</strong>
                  {o.description && <span>{o.description}</span>}
                  {isUpcoming(o, now) ? <Countdown to={o.startsAt} prefix="Starts in" /> : <span className="small">Ends {date(o.endsAt)}</span>}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {(tab === 'all' || tab === 'offers') && (
        <section>
          <h2>Coupons</h2>
          {coupons.length === 0 && <p className="muted">No coupons right now.</p>}
          <div className="offer-strip">
            {coupons.map((o) => o.clip ? (
              <label key={o.id} className="card offer-card clip-card">
                <input type="checkbox" checked={clipped.includes(o.id)} onChange={() => toggleClip(o.id)} />
                <div><strong>{clipped.includes(o.id) ? 'Coupon clipped' : 'Clip coupon'}</strong><p>{o.title}</p><span className="muted small">Applies to eligible items · till {date(o.endsAt)}</span></div>
              </label>
            ) : <OfferCard key={o.id} offer={o} />)}
          </div>
          <h2>Bank offers</h2>
          {banks.length === 0 && <p className="muted">No bank offers right now.</p>}
          <div className="offer-strip">{banks.map((o) => <OfferCard key={o.id} offer={o} />)}</div>
        </section>
      )}
      {offers.length === 0 && <Empty title="No offers yet" icon="tag"><p>Deals will appear here as soon as they go live.</p></Empty>}
    </div>
  );
}
