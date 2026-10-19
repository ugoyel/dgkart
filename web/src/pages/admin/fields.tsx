import { useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { ds } from '../../data';
import { prepareImage } from '../../lib/image';
import { cssUrl, errorText, useToast } from '../../state/AppState';

/** Upload (or paste a link to) an image; shows a thumbnail with Replace / Remove. */
export function ImageField({ label, value, onChange, hint }: { label: string; value?: string | null; onChange: (url: string | null) => void; hint?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [linking, setLinking] = useState(false);
  const toast = useToast();
  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const demo = ds.mode === 'demo';
      const { blob, name } = await prepareImage(file, demo ? 1400 : 1920, demo ? 0.8 : 0.85);
      onChange(await ds.admin.uploadMedia(blob, name));
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  return (
    <div className="image-field">
      <span className="label">{label}</span>
      <div className="image-field-row">
        <button
          type="button"
          className={`image-drop${value ? ' has' : ''}`}
          style={value ? { backgroundImage: cssUrl(value) } : undefined}
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pick(e.dataTransfer.files[0]);
          }}
          aria-label={value ? `Replace ${label}` : `Upload ${label}`}
        >
          {busy ? <span className="spinner-dot small-spin" /> : !value && <><Icon name="image" size={26} /><span>Upload or drop</span></>}
        </button>
        <div className="image-field-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => input.current?.click()} disabled={busy}><Icon name="upload" size={16} /> {value ? 'Replace' : 'Upload'}</button>
          <button type="button" className="link small" onClick={() => setLinking((l) => !l)}>Use a link instead</button>
          {value && <button type="button" className="link small bad" onClick={() => onChange(null)}>Remove</button>}
        </div>
      </div>
      {linking && (
        <input
          className="image-link"
          placeholder="https://…"
          defaultValue={value && !value.startsWith('data:') ? value : ''}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (!v) return;
            if (!/^https:\/\//.test(v)) return toast('Image links must start with https://', 'error');
            onChange(v);
            setLinking(false);
          }}
        />
      )}
      {hint && <span className="muted small">{hint}</span>}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Colour picker plus the value as text (so "#fff" or "white" also work). */
export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="color-field">
      <span>{label}</span>
      <span className="color-field-row">
        <input type="color" value={HEX.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value.toUpperCase())} aria-label={`${label} colour`} />
        <input value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} />
      </span>
    </label>
  );
}

/** Solid colour or a 2–3 colour gradient, built with pickers. */
export function BackgroundField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const stops = value.match(/#[0-9a-f]{6}/gi) ?? [];
  const isGradient = /gradient/.test(value);
  const angle = Number(value.match(/(\d+)deg/)?.[1] ?? 120);
  const build = (s: string[], a = angle) => (s.length === 1 ? s[0] : `linear-gradient(${a}deg,${s.map((c, i) => `${c} ${Math.round((i / (s.length - 1)) * 100)}%`).join(',')})`);
  const colours = stops.length ? stops : ['#1A56DB'];
  return (
    <div className="bg-field">
      <span className="label">{label}</span>
      <div className="bg-field-swatch" style={{ background: value }} />
      <div className="bg-field-row">
        {colours.map((c, i) => (
          <input key={i} type="color" value={c} aria-label={`${label} colour ${i + 1}`} onChange={(e) => onChange(build(colours.map((x, k) => (k === i ? e.target.value.toUpperCase() : x))))} />
        ))}
        {colours.length < 3 && <button type="button" className="btn btn-outline btn-sm" onClick={() => onChange(build([...colours, colours.length ? colours[colours.length - 1] : '#FFFFFF']))}>+ Colour</button>}
        {colours.length > 1 && <button type="button" className="link small" onClick={() => onChange(build(colours.slice(0, -1)))}>Remove colour</button>}
        {isGradient && (
          <select value={[90, 120, 135, 180].includes(angle) ? angle : 120} onChange={(e) => onChange(build(colours, Number(e.target.value)))} aria-label="Gradient direction">
            <option value={90}>Left → right</option>
            <option value={120}>Diagonal</option>
            <option value={135}>Diagonal (steep)</option>
            <option value={180}>Top → bottom</option>
          </select>
        )}
      </div>
      <details className="small">
        <summary>Edit as CSS</summary>
        <input value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} />
      </details>
    </div>
  );
}
