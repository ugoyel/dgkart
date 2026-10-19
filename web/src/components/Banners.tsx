import { BannerSlide, Offer, isLive } from '@engine';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ds } from '../data';
import type { Category, Product } from '../data';
import { countdown } from '../lib/format';
import { useNow } from '../lib/useNow';
import { cssUrl, usePromos } from '../state/AppState';
import { Carousel } from './Carousel';
import { Motif } from './FestivalArt';
import { Icon } from './Icon';

/** A banner as drawn: the saved slide plus things computed at runtime. */
export interface BannerItem extends BannerSlide {
  kicker?: string;
  /** Product pictures shown on the right when the slide has no side image. */
  thumbs?: string[];
  art?: ReactNode;
  extra?: ReactNode;
}

const categoryOf = (link: string) => link.match(/[?&]category=([a-z0-9-]+)/)?.[1] ?? null;

export function BannerView({ b, eager = true }: { b: BannerItem; eager?: boolean }) {
  const body = (
    <div className="banner" style={{ background: b.background, color: b.textColor }}>
      {b.image && <div className="banner-photo" style={{ backgroundImage: cssUrl(b.image) }} />}
      <div className="banner-text">
        {b.kicker && <span className="banner-kicker">{b.kicker}</span>}
        <h2>{b.title}</h2>
        {b.subtitle && <p>{b.subtitle}</p>}
        {b.extra}
        {b.cta && <span className="btn banner-cta">{b.cta}</span>}
      </div>
      {b.sideImage ? (
        <img className="banner-side" src={b.sideImage} alt="" loading={eager ? 'eager' : 'lazy'} draggable={false} />
      ) : b.art ? (
        <div className="banner-art">{b.art}</div>
      ) : b.thumbs?.length ? (
        <div className={`banner-thumbs n${Math.min(3, b.thumbs.length)}`}>
          {b.thumbs.slice(0, 3).map((t) => <span key={t}><img src={t} alt="" loading={eager ? 'eager' : 'lazy'} draggable={false} /></span>)}
        </div>
      ) : null}
    </div>
  );
  return /^https?:\/\//.test(b.link)
    ? <a href={b.link} className="banner-link" target="_blank" rel="noreferrer">{body}</a>
    : <Link to={b.link} className="banner-link">{body}</Link>;
}

const thumbCache = new Map<string, Promise<string[]>>();
/** Best-selling product pictures for each category (so plain banners still show products, as on eBay). */
export function useCategoryThumbs(slugs: (string | null)[]) {
  const key = [...new Set(slugs.filter(Boolean))].sort().join(',');
  const [thumbs, setThumbs] = useState<Record<string, string[]>>({});
  useEffect(() => {
    let alive = true;
    for (const slug of key ? key.split(',') : []) {
      if (!thumbCache.has(slug)) {
        thumbCache.set(slug, ds.search({ category: slug, sort: 'best', pageSize: 6 })
          .then((r) => r.items.map((p) => p.thumbnailUrl).filter((u): u is string => !!u).slice(0, 3))
          .catch(() => []));
      }
      thumbCache.get(slug)!.then((t) => alive && setThumbs((m) => (m[slug] ? m : { ...m, [slug]: t })));
    }
    return () => {
      alive = false;
    };
  }, [key]);
  return thumbs;
}

function FestivalExtra({ target, lead, coupon }: { target: Date; lead: boolean; coupon?: string | null }) {
  const { previewDate } = usePromos();
  const live = useNow(1000);
  const now = previewDate ?? live;
  return (
    <>
      <p className="banner-count"><Icon name="clock" size={18} />{lead ? 'Festival starts in' : 'Sale ends in'} {countdown(target.getTime() - now.getTime())}</p>
      {coupon && <span className="coupon-chip">Use code <strong>{coupon}</strong></span>}
    </>
  );
}

const saleSlide = (o: Offer): BannerItem => ({
  id: `sale-${o.id}`,
  title: o.title,
  subtitle: o.description ?? 'Limited time offer',
  cta: 'See the deals',
  link: '/deals?tab=sales',
  background: 'var(--banner-bg)',
  image: o.bannerImage ?? null,
  textColor: '#FFFFFF',
  enabled: true,
  kicker: o.discount.type === 'PERCENT' ? `${o.discount.value}% off` : 'Sale',
  art: <Motif motif="sparkle" size={170} />,
});

/** Home page slider: festival banner, live sales, then the admin's slides. */
export function HomeSlider() {
  const { resolved, offers, appearance } = usePromos();
  const occ = resolved.occurrence;
  const t = resolved.theme;
  const own = appearance.heroSlides.filter((s) => s.enabled);
  const thumbs = useCategoryThumbs(own.filter((s) => !s.image && !s.sideImage).map((s) => categoryOf(s.link)));

  const items = useMemo(() => {
    const list: BannerItem[] = [];
    if (occ && appearance.festivalSlide) {
      const coupon = offers.find((o) => o.kind === 'COUPON' && o.festivalId === occ.festival.id && o.code && isLive(o, new Date()));
      const lead = resolved.phase === 'lead-up';
      list.push({
        id: 'festival',
        kicker: occ.festival.greeting,
        title: `${occ.festival.name} Sale`,
        subtitle: occ.festival.tagline,
        cta: 'Shop the sale',
        link: '/deals',
        background: t.bannerBg,
        image: t.bannerImage ?? null,
        textColor: '#FFFFFF',
        enabled: true,
        art: <Motif motif={t.motif} size={230} />,
        extra: <FestivalExtra target={lead ? occ.start : occ.themeTo} lead={lead} coupon={coupon?.code} />,
      });
    }
    if (appearance.saleSlides) {
      const now = new Date();
      for (const o of offers) {
        if ((o.kind === 'CATEGORY_SALE' || (o.kind === 'FESTIVAL_SALE' && o.festivalId !== occ?.festival.id)) && isLive(o, now)) list.push(saleSlide(o));
      }
    }
    for (const s of own) list.push({ ...s, thumbs: thumbs[categoryOf(s.link) ?? ''] });
    return list;
  }, [occ, t, resolved.phase, offers, appearance.festivalSlide, appearance.saleSlides, own, thumbs]);

  return (
    <Carousel
      label="Featured offers"
      className="hero-carousel"
      settings={appearance.slider}
      slides={items.map((b, k) => <BannerView key={b.id} b={b} eager={k === 0} />)}
    />
  );
}

const PALETTES = [
  ['#0B3BA8', '#1A56DB', '#60A5FA'], ['#9D174D', '#DB2777', '#F9A8D4'], ['#065F46', '#059669', '#6EE7B7'],
  ['#7C2D12', '#EA580C', '#FDBA74'], ['#4C1D95', '#7C3AED', '#C4B5FD'], ['#134E4A', '#0D9488', '#5EEAD4'],
  ['#78350F', '#D97706', '#FCD34D'], ['#1E3A8A', '#4F46E5', '#A5B4FC'], ['#831843', '#BE185D', '#FBCFE8'],
];
const gradientFor = (slug: string) => {
  const h = [...slug].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const [a, b, c] = PALETTES[h % PALETTES.length];
  return `linear-gradient(120deg,${a},${b} 60%,${c})`;
};

/** Sliding banners at the top of a category page. */
export function CategorySlider({ category, categories, products }: { category: Category; categories: Category[]; products: Product[] }) {
  const { appearance, offers, resolved } = usePromos();
  const parent = category.parentId ? categories.find((c) => c.id === category.parentId) : null;
  const own = (appearance.categoryBanners[category.slug] ?? (parent ? appearance.categoryBanners[parent.slug] : undefined) ?? []).filter((s) => s.enabled);
  const subs = categories.filter((c) => c.parentId === category.id && c.imageUrl).slice(0, 3);
  const subThumbs = useCategoryThumbs(subs.map((c) => c.slug));

  const items = useMemo(() => {
    if (own.length) return own.map((s): BannerItem => s);
    if (!appearance.autoCategoryBanners) return [];
    const pics = products.map((p) => p.thumbnailUrl).filter((u): u is string => !!u);
    const now = new Date();
    const ids = new Set([category.id, ...categories.filter((c) => c.parentId === category.id).map((c) => c.id), ...(parent ? [parent.id] : [])]);
    const sales = offers.filter((o) => (o.kind === 'CATEGORY_SALE' || o.kind === 'FESTIVAL_SALE') && isLive(o, now) &&
      (!o.scope.categoryIds?.length || o.scope.categoryIds.some((c) => ids.has(c))) && !o.scope.productIds?.length);
    const list: BannerItem[] = [];
    const occ = resolved.occurrence;
    for (const o of sales.slice(0, 2)) {
      list.push({ ...saleSlide(o), background: occ ? resolved.theme.bannerBg : gradientFor(category.slug), thumbs: pics.slice(0, 3), art: undefined });
    }
    list.push({
      id: `${category.slug}-top`,
      kicker: occ ? `${occ.festival.name} picks` : 'Top picks',
      title: `Best of ${category.name}`,
      subtitle: 'Most-loved products, with free delivery on orders over ₹499',
      cta: 'Shop now',
      link: `/search?category=${category.slug}&sort=best`,
      background: gradientFor(category.slug),
      textColor: '#FFFFFF',
      enabled: true,
      thumbs: pics.slice(0, 3),
    });
    list.push({
      id: `${category.slug}-new`,
      kicker: 'Just in',
      title: `New in ${category.name}`,
      subtitle: 'Fresh arrivals added this week',
      cta: 'See what’s new',
      link: `/search?category=${category.slug}&sort=newest`,
      background: gradientFor(category.slug + '-new'),
      textColor: '#FFFFFF',
      enabled: true,
      thumbs: pics.slice(3, 6),
    });
    for (const c of subs) {
      list.push({
        id: `${c.slug}-sub`,
        kicker: category.name,
        title: c.name,
        subtitle: `Explore ${c.name.toLowerCase()} deals`,
        cta: 'Explore',
        link: `/search?category=${c.slug}`,
        background: gradientFor(c.slug),
        textColor: '#FFFFFF',
        enabled: true,
        thumbs: subThumbs[c.slug]?.length ? subThumbs[c.slug] : c.imageUrl ? [c.imageUrl] : [],
      });
    }
    return list;
  }, [own, appearance.autoCategoryBanners, products, offers, category, categories, parent, subs, subThumbs, resolved]);

  if (!items.length) return null;
  return (
    <Carousel
      label={`${category.name} offers`}
      className="category-carousel"
      settings={appearance.slider}
      slides={items.map((b, k) => <BannerView key={b.id} b={b} eager={k === 0} />)}
    />
  );
}
