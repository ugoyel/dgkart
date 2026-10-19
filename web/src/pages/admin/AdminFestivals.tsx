import { BASE_THEME, Festival, FestivalDecor, FestivalMotif, istStart, validateFestival } from '@engine';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DecorStrip, Motif } from '../../components/FestivalArt';
import { Icon } from '../../components/Icon';
import { Modal, Spinner } from '../../components/ui';
import { ds } from '../../data';
import { date } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { errorText, usePromos, useToast } from '../../state/AppState';
import { AdminLayout, remindersChanged } from './AdminLayout';

const MOTIFS: FestivalMotif[] = ['diya', 'rangoli', 'colors', 'crescent', 'star', 'kite', 'pookalam', 'tricolor', 'rakhi', 'dandiya', 'lotus', 'bow', 'sparkle'];
const DECORS: FestivalDecor[] = ['toran', 'lights', 'tricolor', 'bunting', 'none'];
const COLORS: [keyof Festival['theme'], string][] = [
  ['primary', 'Buttons & links'], ['primaryDark', 'Button hover'], ['accent', 'Highlights'], ['headerText', 'Header text'], ['footerText', 'Footer text'],
];
const GRADIENTS: [keyof Festival['theme'], string][] = [['headerBg', 'Header background'], ['footerBg', 'Footer background'], ['bannerBg', 'Banner background']];

function newFestival(): Festival {
  const y = String(new Date().getFullYear());
  return {
    id: '', name: '', greeting: '', tagline: '', dates: { [y]: { start: `${y}-12-01`, end: `${y}-12-03` } }, priority: 40, themeLeadDays: 5,
    themeTrailDays: 1, reminderWeeks: [4, 2, 1], enabled: true, theme: { ...BASE_THEME, decor: 'bunting' },
    offerTemplate: { salePercent: 15, categories: [], couponPercent: 10, couponMaxDiscount: 300, couponMinOrder: 799, bankPercent: 10, bankMaxDiscount: 1000, bankMinOrder: 2999, lightningDeals: 6, lightningPercent: 30 },
  };
}

function ThemePreview({ f }: { f: Festival }) {
  const t = f.theme;
  return (
    <div className="theme-preview">
      <div className="tp-header" style={{ background: t.headerImage ? `center/cover url(${t.headerImage})` : t.headerBg, color: t.headerText }}>
        <strong>DGkart</strong><span className="tp-search" /><span style={{ background: t.accent }} className="tp-dot" />
      </div>
      <DecorStrip decor={t.decor} />
      <div className="tp-banner" style={{ background: t.bannerImage ? `center/cover url(${t.bannerImage})` : t.bannerBg }}>
        <Motif motif={t.motif} size={56} />
        <div><small>{f.greeting || 'Greeting'}</small><strong>{f.name || 'Festival'} Sale</strong></div>
        <span className="tp-btn" style={{ background: t.primary }}>Shop now</span>
      </div>
      <div className="tp-footer" style={{ background: t.footerImage ? `center/cover url(${t.footerImage})` : t.footerBg, color: t.footerText }}>Footer · {f.greeting}</div>
    </div>
  );
}

function FestivalEditor({ initial, isNew, onClose, onSaved }: { initial: Festival; isNew: boolean; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Festival>(initial);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const set = (p: Partial<Festival>) => setF((x) => ({ ...x, ...p }));
  const setTheme = (p: Partial<Festival['theme']>) => setF((x) => ({ ...x, theme: { ...x.theme, ...p } }));
  const setTpl = (p: Partial<Festival['offerTemplate']>) => setF((x) => ({ ...x, offerTemplate: { ...x.offerTemplate, ...p } }));
  const errors = validateFestival(f);
  const years = Object.keys(f.dates).sort();
  const save = async () => {
    if (errors.length) return toast(errors[0], 'error');
    setSaving(true);
    try {
      await ds.admin.saveFestival(f);
      toast(`${f.name} saved`, 'success');
      onSaved();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={isNew ? 'Add festival' : `Edit ${initial.name}`} wide>
      <div className="festival-editor">
        <div className="form-grid">
          <label>Name<input value={f.name} onChange={(e) => set({ name: e.target.value, ...(isNew ? { id: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') } : {}) })} /></label>
          <label>Key<input value={f.id} disabled={!isNew} onChange={(e) => set({ id: e.target.value })} /></label>
          <label>Greeting<input value={f.greeting} onChange={(e) => set({ greeting: e.target.value })} placeholder="Happy Diwali" /></label>
          <label>Tagline<input value={f.tagline} onChange={(e) => set({ tagline: e.target.value })} /></label>

          <div className="span2">
            <span className="label">Dates (update lunar festivals every year)</span>
            {years.map((y) => (
              <div key={y} className="row date-row">
                <strong>{y}</strong>
                <input type="date" value={f.dates[y].start} onChange={(e) => set({ dates: { ...f.dates, [y]: { ...f.dates[y], start: e.target.value } } })} aria-label={`${y} start`} />
                <span>to</span>
                <input type="date" value={f.dates[y].end} onChange={(e) => set({ dates: { ...f.dates, [y]: { ...f.dates[y], end: e.target.value } } })} aria-label={`${y} end`} />
                <button type="button" className="icon-btn" onClick={() => { const d = { ...f.dates }; delete d[y]; set({ dates: d }); }} aria-label={`Remove ${y}`}><Icon name="trash" size={18} /></button>
              </div>
            ))}
            <button type="button" className="link" onClick={() => {
              const y = String(Number(years[years.length - 1] ?? new Date().getFullYear()) + 1);
              const last = years.length ? f.dates[years[years.length - 1]] : { start: `${y}-01-01`, end: `${y}-01-01` };
              set({ dates: { ...f.dates, [y]: { start: y + last.start.slice(4), end: y + last.end.slice(4) } } });
            }}><Icon name="plus" size={16} /> Add next year</button>
          </div>

          <label>Theme on, days before<input type="number" min={0} max={60} value={f.themeLeadDays} onChange={(e) => set({ themeLeadDays: Number(e.target.value) })} /></label>
          <label>Theme off, days after<input type="number" min={0} max={30} value={f.themeTrailDays} onChange={(e) => set({ themeTrailDays: Number(e.target.value) })} /></label>
          <label>Remind me, weeks before<input value={f.reminderWeeks.join(', ')} onChange={(e) => set({ reminderWeeks: e.target.value.split(/[,\s]+/).filter(Boolean).map(Number).filter((n) => !isNaN(n)) })} placeholder="6, 4, 2, 1" /></label>
          <label>Priority (overlaps)<input type="number" min={0} value={f.priority} onChange={(e) => set({ priority: Number(e.target.value) })} /></label>
          <label className="check"><input type="checkbox" checked={f.enabled} onChange={(e) => set({ enabled: e.target.checked })} /> Enabled</label>
          <label className="check"><input type="checkbox" checked={!!f.approximate} onChange={(e) => set({ approximate: e.target.checked })} /> Date moves every year</label>

          <h3 className="span2">Theme</h3>
          {COLORS.map(([k, label]) => (
            <label key={k} className="color">{label}<input type="color" value={String(f.theme[k])} onChange={(e) => setTheme({ [k]: e.target.value })} /></label>
          ))}
          {GRADIENTS.map(([k, label]) => (
            <label key={k} className="span2">{label} (colour or CSS gradient)<input value={String(f.theme[k])} onChange={(e) => setTheme({ [k]: e.target.value })} /></label>
          ))}
          <label>Artwork<select value={f.theme.motif} onChange={(e) => setTheme({ motif: e.target.value as FestivalMotif })}>{MOTIFS.map((m) => <option key={m}>{m}</option>)}</select></label>
          <label>Header & footer decoration<select value={f.theme.decor} onChange={(e) => setTheme({ decor: e.target.value as FestivalDecor })}>{DECORS.map((m) => <option key={m}>{m}</option>)}</select></label>
          <label className="span2">Header image URL (optional, replaces the colour)<input value={f.theme.headerImage ?? ''} onChange={(e) => setTheme({ headerImage: e.target.value || undefined })} /></label>
          <label className="span2">Banner image URL (optional)<input value={f.theme.bannerImage ?? ''} onChange={(e) => setTheme({ bannerImage: e.target.value || undefined })} /></label>
          <label className="span2">Footer image URL (optional)<input value={f.theme.footerImage ?? ''} onChange={(e) => setTheme({ footerImage: e.target.value || undefined })} /></label>

          <h3 className="span2">Draft offer template</h3>
          <p className="muted small span2">Used by “Create draft offers” on this festival’s reminder.</p>
          <label>Festival sale %<input type="number" value={f.offerTemplate.salePercent} onChange={(e) => setTpl({ salePercent: Number(e.target.value) })} /></label>
          <label>Sale categories (slugs)<input value={f.offerTemplate.categories.join(', ')} onChange={(e) => setTpl({ categories: e.target.value.split(/[,\s]+/).filter(Boolean) })} placeholder="fashion, electronics" /></label>
          <label>Coupon %<input type="number" value={f.offerTemplate.couponPercent} onChange={(e) => setTpl({ couponPercent: Number(e.target.value) })} /></label>
          <label>Coupon max ₹<input type="number" value={f.offerTemplate.couponMaxDiscount} onChange={(e) => setTpl({ couponMaxDiscount: Number(e.target.value) })} /></label>
          <label>Coupon min order ₹<input type="number" value={f.offerTemplate.couponMinOrder} onChange={(e) => setTpl({ couponMinOrder: Number(e.target.value) })} /></label>
          <label>Bank offer %<input type="number" value={f.offerTemplate.bankPercent} onChange={(e) => setTpl({ bankPercent: Number(e.target.value) })} /></label>
          <label>Bank offer max ₹<input type="number" value={f.offerTemplate.bankMaxDiscount} onChange={(e) => setTpl({ bankMaxDiscount: Number(e.target.value) })} /></label>
          <label>Bank offer min order ₹<input type="number" value={f.offerTemplate.bankMinOrder} onChange={(e) => setTpl({ bankMinOrder: Number(e.target.value) })} /></label>
          <label>Lightning deals<input type="number" value={f.offerTemplate.lightningDeals} onChange={(e) => setTpl({ lightningDeals: Number(e.target.value) })} /></label>
          <label>Lightning deal %<input type="number" value={f.offerTemplate.lightningPercent} onChange={(e) => setTpl({ lightningPercent: Number(e.target.value) })} /></label>
        </div>
        <aside><span className="label">Preview</span><ThemePreview f={f} /></aside>
      </div>
      {errors.length > 0 && <ul className="errors">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      <div className="row modal-actions">
        <button className="btn" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save festival'}</button>
        <button className="btn btn-outline" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

export function AdminFestivals() {
  const { data, reload } = useAsync(() => ds.admin.festivals(), []);
  const { refresh, setPreviewDate, resolved } = usePromos();
  const toast = useToast();
  const nav = useNavigate();
  const [editing, setEditing] = useState<{ f: Festival; isNew: boolean } | null>(null);
  const year = String(new Date().getFullYear());
  const after = async () => {
    setEditing(null);
    reload();
    await refresh();
    remindersChanged();
  };
  const sorted = [...(data ?? [])].sort((a, b) => (a.dates[year]?.start ?? a.dates[String(+year + 1)]?.start ?? '9').localeCompare(b.dates[year]?.start ?? b.dates[String(+year + 1)]?.start ?? '9'));
  return (
    <AdminLayout
      title="Festivals & themes"
      actions={
        <>
          <button className="btn btn-sm" onClick={() => setEditing({ f: newFestival(), isNew: true })}><Icon name="plus" size={16} /> Add festival</button>
          <button className="btn btn-outline btn-sm" onClick={async () => { if (confirm('Undo all festival edits and go back to the built-in calendar?')) { await ds.admin.resetFestivals(); after(); } }}>Reset to defaults</button>
        </>
      }
    >
      <p className="muted">Each festival switches the website’s header, footer, banner and colours on automatically before it starts and back afterwards. Lunar festival dates move every year: add next year’s dates here once they are announced.</p>
      {!data && <Spinner />}
      <div className="festival-grid">
        {sorted.map((f) => {
          const next = Object.entries(f.dates).map(([y, d]) => ({ y, ...d })).filter((d) => istStart(d.end) >= new Date(Date.now() - 86_400_000)).sort((a, b) => a.start.localeCompare(b.start))[0];
          const live = resolved.occurrence?.festival.id === f.id;
          return (
            <div key={f.id} id={f.id} className={`card festival-card ${f.enabled ? '' : 'off'}`}>
              <div className="fc-banner" style={{ background: f.theme.bannerBg }}><Motif motif={f.theme.motif} size={48} />{live && <span className="badge badge-lightning">Live now</span>}</div>
              <div className="fc-body">
                <strong>{f.name}</strong>
                <span className="small">{next ? `${date(istStart(next.start))}${next.end !== next.start ? ` – ${date(istStart(next.end))}` : ''}` : <span className="bad">No upcoming dates. Add them.</span>}</span>
                <span className="muted small">Theme {f.themeLeadDays}d before · reminders {f.reminderWeeks.join('/')}w before{f.approximate ? ' · verify date yearly' : ''}</span>
                <div className="row">
                  <button className="btn btn-sm btn-outline" onClick={() => setEditing({ f, isNew: false })}><Icon name="edit" size={16} /> Edit</button>
                  {next && <button className="link" onClick={() => { setPreviewDate(new Date(istStart(next.start).getTime() + 12 * 3_600_000)); nav('/'); }}>Preview</button>}
                  <button className="link" onClick={async () => { try { await ds.admin.saveFestival({ ...f, enabled: !f.enabled }); after(); } catch (e) { toast(errorText(e), 'error'); } }}>{f.enabled ? 'Disable' : 'Enable'}</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {editing && <FestivalEditor initial={editing.f} isNew={editing.isNew} onClose={() => setEditing(null)} onSaved={after} />}
    </AdminLayout>
  );
}
