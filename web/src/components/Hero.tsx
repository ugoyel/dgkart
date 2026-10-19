import { Offer, isLive } from '@engine';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { site } from '../config/site';
import { countdown } from '../lib/format';
import { useNow } from '../lib/useNow';
import { usePromos } from '../state/AppState';
import { Motif } from './FestivalArt';
import { Icon } from './Icon';

/** Festival banner while a festival theme is on; otherwise rotating sale slides. */
export function Hero() {
  const { resolved, offers, previewDate } = usePromos();
  const occ = resolved.occurrence;
  const live = useNow(1000);
  // While previewing a date the countdown is shown as of that date.
  const now = previewDate ?? live;

  if (occ) {
    const t = resolved.theme;
    const coupon = offers.find((o) => o.kind === 'COUPON' && o.festivalId === occ.festival.id && o.code && isLive(o, now));
    const target = resolved.phase === 'lead-up' ? occ.start : occ.themeTo;
    return (
      <section className="hero hero-festival" style={{ background: t.bannerImage ? `center/cover url(${t.bannerImage})` : t.bannerBg }}>
        <div className="hero-art"><Motif motif={t.motif} size={220} /></div>
        <div className="hero-text">
          <span className="hero-kicker">{occ.festival.greeting}</span>
          <h1>{occ.festival.name} Sale</h1>
          <p>{occ.festival.tagline}</p>
          <p className="hero-count">
            <Icon name="clock" size={18} />
            {resolved.phase === 'lead-up' ? `Festival starts in ${countdown(target.getTime() - now.getTime())}` : `Sale ends in ${countdown(target.getTime() - now.getTime())}`}
          </p>
          <div className="hero-cta">
            <Link to="/deals" className="btn btn-light">Shop the sale</Link>
            {coupon && <span className="coupon-chip">Use code <strong>{coupon.code}</strong></span>}
          </div>
        </div>
      </section>
    );
  }
  return <Slides offers={offers} />;
}

function Slides({ offers }: { offers: Offer[] }) {
  const slides = useMemo(() => {
    const sales = offers
      .filter((o) => (o.kind === 'CATEGORY_SALE' || o.kind === 'FESTIVAL_SALE') && isLive(o, new Date()))
      .map((o) => ({ title: o.title, subtitle: o.description ?? 'Limited time offer', to: '/deals', bg: 'var(--banner-bg)', image: o.bannerImage }));
    return [...sales, ...site.heroSlides.map((s) => ({ ...s, image: null as string | null | undefined }))];
  }, [offers]);
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [slides.length]);
  const s = slides[i % slides.length];
  return (
    <section className="hero" style={{ background: s.image ? `center/cover url(${s.image})` : s.bg }}>
      <div className="hero-art"><Motif motif="sparkle" size={180} /></div>
      <div className="hero-text">
        <h1>{s.title}</h1>
        <p>{s.subtitle}</p>
        <div className="hero-cta"><Link to={s.to} className="btn btn-light">Shop now</Link></div>
      </div>
      <div className="hero-dots">
        {slides.map((_, k) => <button key={k} className={k === i % slides.length ? 'on' : ''} onClick={() => setI(k)} aria-label={`Slide ${k + 1}`} />)}
      </div>
    </section>
  );
}
