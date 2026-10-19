import {
  Appearance, BannerSlide, DEFAULT_APPEARANCE, FestivalTheme, MAX_SLIDES, SLIDE_EFFECTS, SlideEasing, mergeAppearance, upcomingFestivals,
  validateAppearance,
} from '@engine';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BannerItem, BannerView, useCategoryThumbs } from '../../components/Banners';
import { Carousel } from '../../components/Carousel';
import { Icon } from '../../components/Icon';
import { useCategories } from '../../components/Layout';
import { Spinner } from '../../components/ui';
import { ds } from '../../data';
import type { Category } from '../../data';
import { date, uid } from '../../lib/format';
import { errorText, usePromos, useToast } from '../../state/AppState';
import { AdminLayout } from './AdminLayout';
import { BackgroundField, ColorField, ImageField } from './fields';

type Tab = 'theme' | 'colours' | 'home' | 'categories' | 'motion';
const TABS: [Tab, string][] = [['theme', 'Theme'], ['colours', 'Colours & background'], ['home', 'Home slider'], ['categories', 'Category banners'], ['motion', 'Transitions']];

/** Ready-made everyday looks. Festivals still take over on their dates. */
const PRESETS: { name: string; base: Partial<FestivalTheme>; pageBg: string }[] = [
  { name: 'Marketplace (light)', pageBg: '#FFFFFF', base: { primary: '#3665F3', primaryDark: '#2A4DC0', accent: '#F97316', headerBg: '#FFFFFF', headerText: '#191919', footerBg: '#F7F7F7', footerText: '#3F3F3F' } },
  { name: 'DGkart blue', pageBg: '#FFFFFF', base: { primary: '#1A56DB', primaryDark: '#0B3BA8', accent: '#F97316', headerBg: '#FFFFFF', headerText: '#191919', footerBg: '#F7F7F7', footerText: '#3F3F3F' } },
  { name: 'Midnight', pageBg: '#F5F6F8', base: { primary: '#1A56DB', primaryDark: '#0B3BA8', accent: '#F59E0B', headerBg: '#0F1E3D', headerText: '#FFFFFF', footerBg: '#0F1E3D', footerText: '#E5E7EB' } },
  { name: 'Saffron', pageBg: '#FFFBF5', base: { primary: '#C2410C', primaryDark: '#9A3412', accent: '#16A34A', headerBg: 'linear-gradient(90deg,#FFF7ED,#FFEDD5)', headerText: '#431407', footerBg: '#431407', footerText: '#FED7AA' } },
];

const EASINGS: [SlideEasing, string][] = [['smooth', 'Smooth (recommended)'], ['ease-in-out', 'Gentle'], ['linear', 'Even'], ['bounce', 'Springy']];

function newSlide(): BannerSlide {
  return { id: uid().slice(0, 8), title: 'New banner', subtitle: '', cta: 'Shop now', link: '/deals', background: 'linear-gradient(120deg,#1A56DB 0%,#60A5FA 100%)', image: null, sideImage: null, textColor: '#FFFFFF', enabled: true };
}

function LinkField({ value, onChange, categories }: { value: string; onChange: (v: string) => void; categories: Category[] }) {
  const options: [string, string][] = [
    ['/deals', 'Today’s deals'], ['/deals?tab=lightning', 'Lightning deals'], ['/deals?tab=offers', 'Coupons & bank offers'], ['/search?sort=newest', 'New arrivals'],
    ...categories.map((c): [string, string] => [`/search?category=${c.slug}`, `${c.parentId ? '— ' : ''}${c.name}`]),
  ];
  const known = options.some(([v]) => v === value);
  return (
    <label>Opens
      <select value={known ? value : 'custom'} onChange={(e) => e.target.value !== 'custom' && onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        <option value="custom">Custom link…</option>
      </select>
      {!known && <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="/search?q=saree or https://…" />}
    </label>
  );
}

function SlideEditor({ s, index, count, onChange, onMove, onRemove, onCopy, categories, thumbs, startOpen }: {
  s: BannerSlide; index: number; count: number; categories: Category[]; thumbs?: string[]; startOpen: boolean;
  onChange: (s: BannerSlide) => void; onMove: (d: number) => void; onRemove: () => void; onCopy: () => void;
}) {
  const [open, setOpen] = useState(startOpen);
  const set = (p: Partial<BannerSlide>) => onChange({ ...s, ...p });
  return (
    <div className={`card slide-editor${s.enabled ? '' : ' off'}`}>
      <div className="slide-editor-head">
        <div className="slide-mini"><BannerView b={{ ...s, thumbs } as BannerItem} /></div>
        <div className="slide-editor-title">
          <strong>{index + 1}. {s.title || 'Untitled'}</strong>
          <span className="muted small">{s.enabled ? 'Showing' : 'Hidden'}</span>
        </div>
        <div className="slide-editor-tools">
          <label className="check small"><input type="checkbox" checked={s.enabled} onChange={(e) => set({ enabled: e.target.checked })} /> Show</label>
          <button className="icon-btn" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move up"><Icon name="arrowUp" size={18} /></button>
          <button className="icon-btn" onClick={() => onMove(1)} disabled={index === count - 1} aria-label="Move down"><Icon name="arrowDown" size={18} /></button>
          <button className="btn btn-outline btn-sm" onClick={() => setOpen((o) => !o)}>{open ? 'Close' : 'Edit'}</button>
        </div>
      </div>
      {open && (
        <div className="form-grid slide-form">
          <label className="span2">Heading<input value={s.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} /></label>
          <label className="span2">Text under the heading<input value={s.subtitle ?? ''} maxLength={200} onChange={(e) => set({ subtitle: e.target.value })} /></label>
          <label>Button text (empty hides it)<input value={s.cta ?? ''} maxLength={40} onChange={(e) => set({ cta: e.target.value })} /></label>
          <LinkField value={s.link} onChange={(link) => set({ link })} categories={categories} />
          <BackgroundField label="Background colour" value={s.background} onChange={(background) => set({ background })} />
          <ColorField label="Text colour" value={s.textColor} onChange={(textColor) => set({ textColor })} />
          <ImageField label="Background photo" value={s.image} onChange={(image) => set({ image })} hint="Wide photo, about 1600 × 500. Covers the colour." />
          <ImageField label="Picture on the right" value={s.sideImage} onChange={(sideImage) => set({ sideImage })} hint="Product shot or sticker; PNG with a clear background looks best. Left empty, best-selling products from the linked category are shown." />
          <div className="span2 row wrap">
            <button className="btn btn-outline btn-sm" onClick={onCopy}>Duplicate</button>
            <button className="link bad" onClick={onRemove}><Icon name="trash" size={16} /> Delete banner</button>
          </div>
        </div>
      )}
    </div>
  );
}

function SlideList({ slides, onChange, categories }: { slides: BannerSlide[]; onChange: (s: BannerSlide[]) => void; categories: Category[] }) {
  const [added, setAdded] = useState<string | null>(null);
  const thumbs = useCategoryThumbs(slides.filter((s) => !s.image && !s.sideImage).map((s) => s.link.match(/category=([a-z0-9-]+)/)?.[1] ?? null));
  const move = (i: number, d: number) => {
    const next = [...slides];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div className="slide-list">
      {slides.map((s, i) => (
        <SlideEditor
          key={s.id}
          s={s}
          index={i}
          count={slides.length}
          categories={categories}
          startOpen={s.id === added}
          thumbs={thumbs[s.link.match(/category=([a-z0-9-]+)/)?.[1] ?? '']}
          onChange={(x) => onChange(slides.map((y, k) => (k === i ? x : y)))}
          onMove={(d) => move(i, d)}
          onRemove={() => onChange(slides.filter((_, k) => k !== i))}
          onCopy={() => onChange([...slides.slice(0, i + 1), { ...s, id: uid().slice(0, 8), title: `${s.title} (copy)` }, ...slides.slice(i + 1)])}
        />
      ))}
      {slides.length < MAX_SLIDES && <button className="btn btn-outline" onClick={() => {
        const n = newSlide();
        setAdded(n.id);
        onChange([...slides, n]);
      }}><Icon name="plus" size={18} /> Add a banner</button>}
    </div>
  );
}

export function AdminAppearance() {
  const { setAppearanceDraft, festivals, resolved } = usePromos();
  const categories = useCategories();
  const toast = useToast();
  const [saved, setSaved] = useState<Appearance | null>(null);
  const [a, setA] = useState<Appearance | null>(null);
  const [tab, setTab] = useState<Tab>(() => (location.hash.slice(1) as Tab) || 'theme');
  const [saving, setSaving] = useState(false);
  const [catSlug, setCatSlug] = useState('');

  useEffect(() => {
    ds.admin.appearance().then((x) => {
      setSaved(x);
      setA(x);
    }).catch((e) => toast(errorText(e), 'error'));
  }, [toast]);
  // The whole site previews unsaved changes while this page is open.
  const [everydayPreview, setEverydayPreview] = useState(false);
  useEffect(() => {
    if (a) setAppearanceDraft(everydayPreview ? { ...a, themeMode: 'everyday' } : a);
  }, [a, everydayPreview, setAppearanceDraft]);
  useEffect(() => () => setAppearanceDraft(null), [setAppearanceDraft]);
  useEffect(() => {
    history.replaceState(null, '', `#${tab}`);
  }, [tab]);

  const dirty = useMemo(() => !!a && !!saved && JSON.stringify(a) !== JSON.stringify(saved), [a, saved]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (!a) return <AdminLayout title="Appearance"><Spinner /></AdminLayout>;
  const set = (p: Partial<Appearance>) => setA({ ...a, ...p });
  const setBase = (p: Partial<FestivalTheme>) => setA({ ...a, base: { ...a.base, ...p } });
  const errors = validateAppearance(a);

  const save = async () => {
    if (errors.length) return toast(errors[0], 'error');
    setSaving(true);
    try {
      const x = await ds.admin.saveAppearance(a);
      setSaved(x);
      setA(x);
      toast('Published. Shoppers see the new look now.', 'success');
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setSaving(false);
    }
  };
  const reset = async () => {
    if (!confirm('Reset every appearance setting (banners, colours, transitions) to the defaults?')) return;
    const x = await ds.admin.resetAppearance();
    setSaved(x);
    setA(x);
    toast('Back to the default look', 'success');
  };

  const upcoming = upcomingFestivals(festivals, new Date(), 400);
  const festivalIds = [...new Map(upcoming.map((o) => [o.festival.id, o])).values()];
  const roots = categories.filter((c) => !c.parentId);
  const cat = categories.find((c) => c.slug === catSlug);
  const sampleSlides = (a.heroSlides.filter((s) => s.enabled).length ? a.heroSlides.filter((s) => s.enabled) : DEFAULT_APPEARANCE.heroSlides);

  return (
    <AdminLayout
      title="Appearance"
      actions={<button className="btn btn-outline btn-sm" onClick={reset}>Reset to defaults</button>}
    >
      <p className="muted">Change how the website looks: theme, colours, background, banners and how they slide. Changes show on this page straight away (header and footer included); press <strong>Publish</strong> to make them live for shoppers.</p>
      <div className="tabs" role="tablist">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === 'theme' && (
        <section className="card look-section">
          <h2>Which theme is on</h2>
          <p className="muted">Right now: <strong>{resolved.occurrence ? `${resolved.occurrence.festival.name} theme` : 'Everyday look'}</strong>{resolved.occurrence && ` (${resolved.phase === 'lead-up' ? `starts ${date(resolved.occurrence.start)}` : resolved.phase === 'live' ? 'on now' : 'ending'})`}.</p>
          <label className={`choice ${a.themeMode === 'auto' ? 'on' : ''}`}>
            <input type="radio" name="mode" checked={a.themeMode === 'auto'} onChange={() => set({ themeMode: 'auto' })} />
            <span><strong>Automatic (recommended)</strong><br /><span className="muted small">Each festival’s theme switches on before it and off afterwards, from the festival calendar.</span></span>
          </label>
          <label className={`choice ${a.themeMode === 'festival' ? 'on' : ''}`}>
            <input type="radio" name="mode" checked={a.themeMode === 'festival'} onChange={() => set({ themeMode: 'festival', forcedFestivalId: a.forcedFestivalId ?? resolved.occurrence?.festival.id ?? festivalIds[0]?.festival.id ?? null })} />
            <span><strong>Keep one festival’s theme on</strong><br /><span className="muted small">For an early sale or a longer celebration. Goes back to automatic after the date you pick.</span></span>
          </label>
          {a.themeMode === 'festival' && (
            <div className="form-grid indent">
              <label>Festival
                <select value={a.forcedFestivalId ?? ''} onChange={(e) => set({ forcedFestivalId: e.target.value })}>
                  {festivals.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </label>
              <label>Keep it on until (optional)<input type="date" value={a.forcedUntil ?? ''} onChange={(e) => set({ forcedUntil: e.target.value || null })} /></label>
            </div>
          )}
          <label className={`choice ${a.themeMode === 'everyday' ? 'on' : ''}`}>
            <input type="radio" name="mode" checked={a.themeMode === 'everyday'} onChange={() => set({ themeMode: 'everyday' })} />
            <span><strong>Always the everyday look</strong><br /><span className="muted small">No festival themes, even during festivals (offers still run).</span></span>
          </label>
          <p className="small">Each festival’s own colours, art, header, banner and footer pictures are set in <Link to="/admin/festivals">Festivals &amp; themes</Link>.</p>
        </section>
      )}

      {tab === 'colours' && (
        <section className="card look-section">
          <h2>Everyday colours</h2>
          <p className="muted small">Used when no festival theme is on.</p>
          {resolved.occurrence && !everydayPreview && <p className="note small">The {resolved.occurrence.festival.name} theme is on now, so the header and footer show its colours. <button className="link" onClick={() => setEverydayPreview(true)}>Preview the everyday look</button></p>}
          {everydayPreview && <p className="note small">Previewing the everyday look on this page. <button className="link" onClick={() => setEverydayPreview(false)}>Show the festival theme again</button></p>}
          <div className="preset-row">
            {PRESETS.map((p) => (
              <button key={p.name} className="preset" onClick={() => setA({ ...a, pageBg: p.pageBg, base: { ...a.base, ...p.base } })}>
                <span className="preset-swatch" style={{ background: p.base.headerBg }}><span style={{ background: p.base.primary }} /><span style={{ background: p.base.accent }} /></span>
                {p.name}
              </button>
            ))}
          </div>
          <div className="form-grid">
            <ColorField label="Buttons & links" value={a.base.primary} onChange={(primary) => setBase({ primary })} />
            <ColorField label="Button hover (darker shade)" value={a.base.primaryDark} onChange={(primaryDark) => setBase({ primaryDark })} />
            <ColorField label="Highlights & badges" value={a.base.accent} onChange={(accent) => setBase({ accent })} />
            <ColorField label="Header text" value={a.base.headerText} onChange={(headerText) => setBase({ headerText })} />
            <BackgroundField label="Header background" value={a.base.headerBg} onChange={(headerBg) => setBase({ headerBg })} />
            <ImageField label="Header picture (optional)" value={a.base.headerImage} onChange={(v) => setBase({ headerImage: v ?? undefined })} hint="Wide strip, about 1600 × 160. Replaces the header colour." />
            <ColorField label="Footer text" value={a.base.footerText} onChange={(footerText) => setBase({ footerText })} />
            <BackgroundField label="Footer background" value={a.base.footerBg} onChange={(footerBg) => setBase({ footerBg })} />
            <ImageField label="Footer picture (optional)" value={a.base.footerImage} onChange={(v) => setBase({ footerImage: v ?? undefined })} />
            <BackgroundField label="Sale banner colour" value={a.base.bannerBg} onChange={(bannerBg) => setBase({ bannerBg })} />
          </div>
          <h2>Page background &amp; shape</h2>
          <div className="form-grid">
            <ColorField label="Page background" value={a.pageBg} onChange={(pageBg) => set({ pageBg })} />
            <ImageField label="Page background picture (optional)" value={a.pageBgImage} onChange={(pageBgImage) => set({ pageBgImage })} hint="A light, subtle texture works best behind products." />
            <label>Corner roundness: {a.radius}px
              <input type="range" min={0} max={28} value={a.radius} onChange={(e) => set({ radius: Number(e.target.value) })} />
            </label>
            <label>Shadows
              <select value={a.shade} onChange={(e) => set({ shade: e.target.value as Appearance['shade'] })}>
                <option value="flat">Flat (no shadows)</option>
                <option value="soft">Soft</option>
                <option value="deep">Deep</option>
              </select>
            </label>
          </div>
        </section>
      )}

      {tab === 'home' && (
        <section className="look-section">
          <div className="card">
            <h2>Home page slider</h2>
            <label className="check"><input type="checkbox" checked={a.festivalSlide} onChange={(e) => set({ festivalSlide: e.target.checked })} /> Show the festival banner first while a festival theme is on</label>
            <label className="check"><input type="checkbox" checked={a.saleSlides} onChange={(e) => set({ saleSlides: e.target.checked })} /> Add a banner for each live category or festival sale</label>
          </div>
          <h3>Your banners</h3>
          <SlideList slides={a.heroSlides} onChange={(heroSlides) => set({ heroSlides })} categories={categories} />
        </section>
      )}

      {tab === 'categories' && (
        <section className="look-section">
          <div className="card">
            <h2>Category banners</h2>
            <p className="muted small">Every category page opens with a banner slider. Leave a category empty and it gets automatic banners (best sellers, new arrivals, sales, subcategories). Subcategories use their parent’s banners.</p>
            <label className="check"><input type="checkbox" checked={a.autoCategoryBanners} onChange={(e) => set({ autoCategoryBanners: e.target.checked })} /> Make automatic banners for categories without their own</label>
            <label>Category
              <select value={catSlug} onChange={(e) => setCatSlug(e.target.value)}>
                <option value="">Choose a category…</option>
                {roots.map((r) => (
                  <optgroup key={r.id} label={r.name}>
                    <option value={r.slug}>{r.name}{a.categoryBanners[r.slug]?.length ? ` (${a.categoryBanners[r.slug].length} banners)` : ''}</option>
                    {categories.filter((c) => c.parentId === r.id).map((c) => <option key={c.id} value={c.slug}>— {c.name}{a.categoryBanners[c.slug]?.length ? ` (${a.categoryBanners[c.slug].length})` : ''}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
          </div>
          {cat && (
            <>
              <h3>{cat.name} banners {(a.categoryBanners[cat.slug] ?? []).length === 0 && <span className="muted small">(automatic until you add one)</span>}</h3>
              <SlideList
                slides={a.categoryBanners[cat.slug] ?? []}
                categories={categories}
                onChange={(slides) => {
                  const next = { ...a.categoryBanners };
                  if (slides.length) next[cat.slug] = slides;
                  else delete next[cat.slug];
                  set({ categoryBanners: next });
                }}
              />
              <Link to={`/search?category=${cat.slug}`} className="small">Open the {cat.name} page</Link>
            </>
          )}
        </section>
      )}

      {tab === 'motion' && (
        <section className="look-section">
          <div className="card">
            <h2>How banners slide</h2>
            <div className="form-grid">
              <label>Effect
                <select value={a.slider.effect} onChange={(e) => set({ slider: { ...a.slider, effect: e.target.value as Appearance['slider']['effect'] } })}>
                  {SLIDE_EFFECTS.map((x) => <option key={x} value={x}>{x === 'slide' ? 'Slide sideways' : x === 'fade' ? 'Cross-fade' : 'Fade and zoom'}</option>)}
                </select>
              </label>
              <label>Motion
                <select value={a.slider.easing} onChange={(e) => set({ slider: { ...a.slider, easing: e.target.value as SlideEasing } })}>
                  {EASINGS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </label>
              <label>Transition speed: {(a.slider.speedMs / 1000).toFixed(2)} s
                <input type="range" min={200} max={1500} step={50} value={a.slider.speedMs} onChange={(e) => set({ slider: { ...a.slider, speedMs: Number(e.target.value) } })} />
              </label>
              <label>Each banner stays: {(a.slider.intervalMs / 1000).toFixed(1)} s
                <input type="range" min={2000} max={15000} step={500} value={a.slider.intervalMs} onChange={(e) => set({ slider: { ...a.slider, intervalMs: Number(e.target.value) } })} />
              </label>
              <label className="check span2"><input type="checkbox" checked={a.slider.autoplay} onChange={(e) => set({ slider: { ...a.slider, autoplay: e.target.checked } })} /> Move to the next banner on its own (shoppers can always swipe)</label>
            </div>
          </div>
          <h3>Preview</h3>
          <Carousel key={a.slider.effect} label="Preview" className="hero-carousel preview-only" settings={a.slider} slides={sampleSlides.map((s) => <BannerView key={s.id} b={s} />)} />
        </section>
      )}

      <div className={`save-bar${dirty ? ' dirty' : ''}`}>
        <span>{dirty ? (errors.length ? errors[0] : 'Unsaved changes, previewing on this page only') : 'All changes published'}</span>
        <button className="btn btn-outline btn-sm" disabled={!dirty} onClick={() => setA(saved ?? mergeAppearance(null))}>Discard</button>
        <button className="btn btn-sm" disabled={!dirty || saving || errors.length > 0} onClick={save}>{saving ? 'Publishing…' : 'Publish'}</button>
      </div>
    </AdminLayout>
  );
}
