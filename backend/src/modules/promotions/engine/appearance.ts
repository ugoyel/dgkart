import { BASE_THEME } from './festival-calendar';
import { ResolvedTheme, istStart, occurrences, resolveTheme } from './festivals';
import { Festival, FestivalTheme } from './types';

/** How one banner slide changes to the next. */
export type SlideEffect = 'slide' | 'fade' | 'zoom';
export const SLIDE_EFFECTS: SlideEffect[] = ['slide', 'fade', 'zoom'];
export type SlideEasing = 'smooth' | 'ease-in-out' | 'linear' | 'bounce';
export const SLIDE_EASINGS: Record<SlideEasing, string> = {
  smooth: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
  'ease-in-out': 'ease-in-out',
  linear: 'linear',
  bounce: 'cubic-bezier(0.34, 1.4, 0.64, 1)',
};

/** One banner in the home slider or a category's slider. */
export interface BannerSlide {
  id: string;
  title: string;
  subtitle?: string;
  /** Button label; empty hides the button. */
  cta?: string;
  /** Where the banner goes (site path such as /search?category=fashion, or a full URL). */
  link: string;
  /** CSS colour or gradient behind the text. */
  background: string;
  /** Photo or artwork that fills the banner (drawn over the background). */
  image?: string | null;
  /** Picture shown on the right of the text (product shot, logo, sticker). */
  sideImage?: string | null;
  textColor: string;
  enabled: boolean;
}

export interface SliderSettings {
  effect: SlideEffect;
  /** Length of one transition. */
  speedMs: number;
  /** Time each slide stays before the next one (autoplay). */
  intervalMs: number;
  autoplay: boolean;
  easing: SlideEasing;
}

export type ShadeDepth = 'flat' | 'soft' | 'deep';
export type ThemeMode = 'auto' | 'everyday' | 'festival';

/** Everything an admin can change about the website's look without code. */
export interface Appearance {
  /**
   * auto     = follow the festival calendar (default)
   * everyday = always the everyday look
   * festival = keep one festival's look on (until `forcedUntil`, then back to auto)
   */
  themeMode: ThemeMode;
  forcedFestivalId: string | null;
  /** YYYY-MM-DD (IST); the forced theme switches off at the end of this day. */
  forcedUntil: string | null;
  /** Everyday colours, header and footer. Festivals override these while they are on. */
  base: FestivalTheme;
  pageBg: string;
  pageBgImage: string | null;
  /** Corner roundness of cards, banners and images, in px. */
  radius: number;
  shade: ShadeDepth;
  heroSlides: BannerSlide[];
  /** Put the current festival's banner first in the home slider. */
  festivalSlide: boolean;
  /** Add a banner for each live category or festival sale. */
  saleSlides: boolean;
  /** Banner slides per category slug. Subcategories fall back to their parent's. */
  categoryBanners: Record<string, BannerSlide[]>;
  /** Build banners from a category's products and offers when it has none of its own. */
  autoCategoryBanners: boolean;
  slider: SliderSettings;
}

export const MAX_SLIDES = 12;

const slide = (id: string, title: string, subtitle: string, link: string, background: string): BannerSlide => ({
  id, title, subtitle, cta: 'Shop now', link, background, image: null, sideImage: null, textColor: '#FFFFFF', enabled: true,
});

export const DEFAULT_APPEARANCE: Appearance = {
  themeMode: 'auto',
  forcedFestivalId: null,
  forcedUntil: null,
  base: BASE_THEME,
  pageBg: '#FFFFFF',
  pageBgImage: null,
  radius: 16,
  shade: 'soft',
  heroSlides: [
    slide('mobiles', 'Big savings on mobiles', 'Latest 5G phones with bank offers', '/search?category=electronics', 'linear-gradient(120deg,#0B3BA8,#1A56DB 60%,#60A5FA)'),
    slide('fashion', 'Fashion for every occasion', 'Up to 60% off top brands', '/search?category=fashion', 'linear-gradient(120deg,#9D174D,#DB2777 60%,#F9A8D4)'),
    slide('home', 'Home makeover', 'Kitchen, decor and furniture deals', '/search?category=home-garden', 'linear-gradient(120deg,#065F46,#059669 60%,#6EE7B7)'),
    slide('sports', 'Gear up for the game', 'Cricket, fitness and cycling', '/search?category=sports', 'linear-gradient(120deg,#7C2D12,#EA580C 60%,#FDBA74)'),
  ],
  festivalSlide: true,
  saleSlides: true,
  categoryBanners: {},
  autoCategoryBanners: true,
  slider: { effect: 'slide', speedMs: 650, intervalMs: 5000, autoplay: true, easing: 'smooth' },
};

/** Saved settings laid over the defaults (so new settings get sensible values). */
export function mergeAppearance(saved?: Partial<Appearance> | null): Appearance {
  const s = (saved ?? {}) as Partial<Appearance>;
  const d = DEFAULT_APPEARANCE;
  // Only known settings are kept, so stray fields never reach storage.
  const pick = <K extends keyof Appearance>(k: K): Appearance[K] => (s[k] === undefined ? d[k] : s[k]) as Appearance[K];
  return {
    themeMode: pick('themeMode'),
    forcedFestivalId: pick('forcedFestivalId'),
    forcedUntil: pick('forcedUntil'),
    base: { ...d.base, ...(s.base ?? {}) },
    pageBg: pick('pageBg'),
    pageBgImage: pick('pageBgImage'),
    radius: pick('radius'),
    shade: pick('shade'),
    heroSlides: pick('heroSlides'),
    festivalSlide: pick('festivalSlide'),
    saleSlides: pick('saleSlides'),
    categoryBanners: pick('categoryBanners') ?? {},
    autoCategoryBanners: pick('autoCategoryBanners'),
    slider: { ...d.slider, ...(s.slider ?? {}) },
  };
}

/** The website's theme at `now`, honouring the admin's manual choice. */
export function resolveSiteTheme(festivals: Festival[], appearance: Appearance, now: Date): ResolvedTheme {
  const base = appearance.base;
  if (appearance.themeMode === 'everyday') return { theme: base, occurrence: null, phase: null, daysToStart: 0, base };
  if (appearance.themeMode === 'festival' && appearance.forcedFestivalId) {
    const until = appearance.forcedUntil ? istStart(appearance.forcedUntil).getTime() + 86_400_000 : Infinity;
    if (now.getTime() < until) {
      const t = now.getTime();
      const occ = occurrences(festivals.filter((f) => f.id === appearance.forcedFestivalId))
        .sort((a, b) => Number(b.end.getTime() >= t) - Number(a.end.getTime() >= t) || Math.abs(a.start.getTime() - t) - Math.abs(b.start.getTime() - t))[0];
      if (occ) {
        const phase = t < occ.start.getTime() ? 'lead-up' : t <= occ.end.getTime() ? 'live' : 'wind-down';
        const daysToStart = Math.max(0, Math.ceil((occ.start.getTime() - t) / 86_400_000));
        return { theme: { ...base, ...occ.festival.theme }, occurrence: occ, phase, daysToStart, base };
      }
    }
  }
  return resolveTheme(festivals, now, base);
}

const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|[a-z]+)$/i;
const CSS_BG = /^[#(),.%\s\w-]+$/;
/** Uploaded files, site paths or https URLs; demo mode stores small data: images. */
const isImage = (v: unknown) => v == null || v === '' || (typeof v === 'string' && /^(https?:\/\/|\/|data:image\/(png|jpe?g|webp|gif);base64,)/.test(v));

function slideErrors(s: BannerSlide, where: string): string[] {
  const e: string[] = [];
  if (!s.id || s.id.length > 40) e.push(`${where}: id is required`);
  if (!s.title?.trim() || s.title.length > 120) e.push(`${where}: title is required (up to 120 characters)`);
  if ((s.subtitle ?? '').length > 200) e.push(`${where}: subtitle is too long`);
  if ((s.cta ?? '').length > 40) e.push(`${where}: button text is too long`);
  if (!/^(\/|https?:\/\/)/.test(s.link ?? '') || s.link.length > 500) e.push(`${where}: link must start with / or https://`);
  if (!CSS_BG.test(s.background ?? '') || s.background.length > 300) e.push(`${where}: background is not a colour or gradient`);
  if (!COLOR.test(s.textColor ?? '')) e.push(`${where}: text colour is not a colour`);
  if (!isImage(s.image) || !isImage(s.sideImage)) e.push(`${where}: images must be uploaded files or https links`);
  return e;
}

export function validateAppearance(a: Appearance): string[] {
  const e: string[] = [];
  if (!['auto', 'everyday', 'festival'].includes(a.themeMode)) e.push('Theme mode must be auto, everyday or festival');
  if (a.themeMode === 'festival' && !a.forcedFestivalId) e.push('Pick the festival to keep on');
  if (a.forcedUntil && !/^\d{4}-\d{2}-\d{2}$/.test(a.forcedUntil)) e.push('"Keep until" must be a date');
  for (const k of ['primary', 'primaryDark', 'accent', 'headerText', 'footerText'] as const) {
    if (!COLOR.test(a.base[k] ?? '')) e.push(`Everyday ${k} is not a colour`);
  }
  for (const k of ['headerBg', 'footerBg', 'bannerBg'] as const) {
    if (!CSS_BG.test(a.base[k] ?? '') || a.base[k].length > 300) e.push(`Everyday ${k} is not a colour or gradient`);
  }
  if (!isImage(a.base.headerImage) || !isImage(a.base.footerImage) || !isImage(a.pageBgImage)) e.push('Images must be uploaded files or https links');
  if (!CSS_BG.test(a.pageBg ?? '')) e.push('Page background is not a colour');
  if (!(a.radius >= 0 && a.radius <= 32)) e.push('Roundness must be 0-32 px');
  if (!['flat', 'soft', 'deep'].includes(a.shade)) e.push('Shadow must be flat, soft or deep');
  if (a.heroSlides.length > MAX_SLIDES) e.push(`Up to ${MAX_SLIDES} home slides`);
  a.heroSlides.forEach((s, i) => e.push(...slideErrors(s, `Home slide ${i + 1}`)));
  const cats = Object.entries(a.categoryBanners ?? {});
  if (cats.length > 200) e.push('Too many category banner sets');
  for (const [slug, slides] of cats) {
    if (!/^[a-z0-9-]{1,80}$/.test(slug)) e.push(`"${slug}" is not a category`);
    if (slides.length > MAX_SLIDES) e.push(`${slug}: up to ${MAX_SLIDES} slides`);
    slides.forEach((s, i) => e.push(...slideErrors(s, `${slug} slide ${i + 1}`)));
  }
  const sl = a.slider;
  if (!SLIDE_EFFECTS.includes(sl.effect)) e.push('Unknown slide effect');
  if (!(sl.speedMs >= 150 && sl.speedMs <= 3000)) e.push('Transition speed must be 150-3000 ms');
  if (!(sl.intervalMs >= 1500 && sl.intervalMs <= 30000)) e.push('Slide time must be 1.5-30 seconds');
  if (!(sl.easing in SLIDE_EASINGS)) e.push('Unknown easing');
  return e;
}
