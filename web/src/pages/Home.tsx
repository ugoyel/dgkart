import { Offer, OfferKind, isLive, isUpcoming, upcomingFestivals } from '@engine';
import { Link } from 'react-router-dom';
import { HomeSlider } from '../components/Banners';
import { Icon } from '../components/Icon';
import { useCategories } from '../components/Layout';
import { Countdown, Empty, Img, ProductCard, Rail, SkeletonGrid, useTitle } from '../components/ui';
import { ds } from '../data';
import type { Product } from '../data';
import { date, money } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { usePromos } from '../state/AppState';

/** Live (and optionally upcoming) item deals of a kind, with their products. */
export function useDeals(kinds: OfferKind[], includeUpcoming = false) {
  const { offers } = usePromos();
  const now = new Date();
  const list = offers
    .filter((o) => kinds.includes(o.kind) && o.scope.productIds?.length && (isLive(o, now) || (includeUpcoming && isUpcoming(o, now))))
    .sort((a, b) => Number(isUpcoming(a, now)) - Number(isUpcoming(b, now)) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const ids = [...new Set(list.flatMap((o) => o.scope.productIds!))];
  const { data } = useAsync(() => ds.productsByIds(ids), [ids.join(',')]);
  const byId = new Map((data ?? []).map((p) => [p.id, p]));
  return list.flatMap((o) => o.scope.productIds!.map((id) => ({ offer: o, product: byId.get(id) }))).filter((d): d is { offer: Offer; product: Product } => !!d.product);
}

export function OfferCard({ offer }: { offer: Offer }) {
  const icon = offer.kind === 'BANK_OFFER' ? 'bank' : 'tag';
  const value = offer.discount.type === 'PERCENT' ? `${offer.discount.value}% off` : `${money(offer.discount.value)} off`;
  return (
    <div className="card offer-card">
      <Icon name={icon} size={28} />
      <div>
        <strong>{offer.kind === 'BANK_OFFER' ? offer.bank : offer.code ? `Code ${offer.code}` : 'Coupon'}</strong>
        <p>{offer.title}</p>
        <span className="muted small">
          {value}
          {offer.discount.maxDiscount ? ` up to ${money(offer.discount.maxDiscount)}` : ''}
          {offer.minOrder ? ` · min ${money(offer.minOrder)}` : ''} · till {date(offer.endsAt)}
        </span>
      </div>
    </div>
  );
}

export function Home() {
  useTitle('');
  const { data: home, error } = useAsync(() => ds.home(), []);
  const { offers, festivals, previewDate } = usePromos();
  const categories = useCategories();
  const lightning = useDeals(['LIGHTNING_DEAL'], true);
  const dotd = useDeals(['DEAL_OF_THE_DAY']);
  const now = new Date();
  const payOffers = offers.filter((o) => (o.kind === 'BANK_OFFER' || (o.kind === 'COUPON' && o.code)) && isLive(o, now));
  const themeNow = previewDate ?? now;
  const coming = upcomingFestivals(festivals, themeNow, 60).filter((o) => o.start > themeNow).slice(0, 4);
  const roots = categories.filter((c) => !c.parentId);

  return (
    <div className="home">
      <div className="container"><HomeSlider /></div>

      <div className="container">
        <h2 className="section-title">Explore popular categories</h2>
        <section className="cat-circles" aria-label="Shop by category">
          {roots.map((c) => (
            <Link key={c.id} to={`/search?category=${c.slug}`} className="cat-circle">
              <Img src={c.imageUrl} alt="" />
              <span>{c.name}</span>
            </Link>
          ))}
        </section>

        {lightning.length > 0 && (
          <Rail title={<><Icon name="bolt" className="accent" /> Lightning Deals</>} to="/deals?tab=lightning">
            {lightning.map(({ offer, product }) => (
              <div key={offer.id + product.id} className="rail-item">
                {isUpcoming(offer, now) ? (
                  <div className="product-card upcoming">
                    <div className="product-card-img"><Img src={product.thumbnailUrl} alt={product.title} /><span className="badge badge-soon">Upcoming</span></div>
                    <div className="product-card-body">
                      <h3 className="product-card-title">{product.title}</h3>
                      <Countdown to={offer.startsAt} prefix="Starts in" />
                    </div>
                  </div>
                ) : <ProductCard product={product} />}
              </div>
            ))}
          </Rail>
        )}

        {dotd.length > 0 && (
          <Rail title="Deal of the Day" to="/deals?tab=dotd" action={<Countdown to={dotd[0].offer.endsAt} />}>
            {dotd.map(({ offer, product }) => <div key={offer.id + product.id} className="rail-item"><ProductCard product={product} /></div>)}
          </Rail>
        )}

        {payOffers.length > 0 && (
          <section className="rail">
            <div className="section-head"><h2>Bank offers & coupons</h2><Link to="/deals?tab=offers" className="see-all">See all <Icon name="chevronRight" size={18} /></Link></div>
            <div className="offer-strip">{payOffers.slice(0, 6).map((o) => <OfferCard key={o.id} offer={o} />)}</div>
          </section>
        )}

        {error && <Empty title="Could not load the store">{error}</Empty>}
        {!home && !error && <SkeletonGrid />}
        {home && (
          <>
            <Rail title="Today’s Deals – all with great prices" to="/search?sort=best">
              {home.dailyDeals.map((p) => <div key={p.id} className="rail-item"><ProductCard product={p} /></div>)}
            </Rail>
            <Rail title="Trending now" to="/search">
              {home.trending.map((p) => <div key={p.id} className="rail-item"><ProductCard product={p} /></div>)}
            </Rail>
            <Rail title="New arrivals" to="/search?sort=newest">
              {home.newArrivals.map((p) => <div key={p.id} className="rail-item"><ProductCard product={p} /></div>)}
            </Rail>
          </>
        )}

        {coming.length > 0 && (
          <section className="rail">
            <div className="section-head"><h2>Coming up</h2></div>
            <div className="festival-strip">
              {coming.map((o) => (
                <div key={o.festival.id + o.year} className="card festival-chip" style={{ background: o.festival.theme.bannerBg }}>
                  <strong>{o.festival.name}</strong>
                  <span>{date(o.start)}</span>
                  <span className="small">
                    {o.themeFrom <= now ? 'Early deals are live' : `Sale starts in ${Math.ceil((o.themeFrom.getTime() - now.getTime()) / 86_400_000)} days`}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
