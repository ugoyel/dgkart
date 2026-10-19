import { FREE_SHIPPING_THRESHOLD } from '@engine';
import { useState } from 'react';
import { ds } from '../data';
import { money } from '../lib/format';
import { store } from '../lib/storage';
import { useAsync } from '../lib/useAsync';
import { Icon } from './Icon';
import { ProductCard, Rail } from './ui';

// ---------------------------------------------------------------- recently viewed

const RECENT_KEY = 'dg.recent';
const RECENT_MAX = 12;

/** Remember a product the shopper opened (newest first, kept in this browser). */
export function recordView(id: string) {
  const ids = (store.get<string[]>(RECENT_KEY) ?? []).filter((x) => x !== id);
  store.set(RECENT_KEY, [id, ...ids].slice(0, RECENT_MAX));
}

/** "Your recently viewed items" rail, as on eBay's home and item pages. */
export function RecentlyViewed({ exclude }: { exclude?: string }) {
  const [all, setAll] = useState(() => store.get<string[]>(RECENT_KEY) ?? []);
  const ids = all.filter((x) => x !== exclude);
  const key = ids.join(',');
  const { data } = useAsync(() => (ids.length ? ds.productsByIds(ids) : Promise.resolve([])), [key]);
  if (!data?.length) return null;
  const byId = new Map(data.map((p) => [p.id, p]));
  const items = ids.map((id) => byId.get(id)).filter((p) => !!p);
  return (
    <Rail
      title="Your recently viewed items"
      action={<button className="link small" onClick={() => { store.remove(RECENT_KEY); setAll([]); }}>Clear</button>}
    >
      {items.map((p) => <div key={p.id} className="rail-item"><ProductCard product={p} /></div>)}
    </Rail>
  );
}

// ---------------------------------------------------------------- delivery by PIN code

const PIN_KEY = 'dg.pin';

/**
 * Estimated delivery date for an Indian PIN code. Demo rules: metro PINs
 * (Delhi, Mumbai, Bengaluru, Chennai, Kolkata, Hyderabad) arrive in 2 days,
 * the north-east and islands (78-79, 74) in 6, everywhere else in 4.
 */
export function deliveryEstimate(pin: string, from = new Date()) {
  const metro = /^(11|40|56|60|70|50)/.test(pin);
  const remote = /^(7[89]|74)/.test(pin);
  const days = metro ? 2 : remote ? 6 : 4;
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1); // no Sunday deliveries
  return { date: d, days, cod: !remote };
}

export function DeliveryCheck() {
  const [pin, setPin] = useState(() => store.get<string>(PIN_KEY) ?? '');
  const [checked, setChecked] = useState(() => /^[1-9]\d{5}$/.test(store.get<string>(PIN_KEY) ?? ''));
  const valid = /^[1-9]\d{5}$/.test(pin);
  const est = valid ? deliveryEstimate(pin) : null;
  return (
    <form
      className="pin-check"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        store.set(PIN_KEY, pin);
        setChecked(true);
      }}
    >
      <label htmlFor="pin"><Icon name="location" size={16} /> Deliver to</label>
      <div className="row">
        <input id="pin" inputMode="numeric" maxLength={6} placeholder="Enter PIN code" value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setChecked(false); }} />
        <button className="btn btn-outline btn-sm" disabled={!valid}>Check</button>
      </div>
      {checked && est && (
        <p className="pin-result">
          Arrives by <strong>{est.date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</strong>
          {est.cod ? ' · Cash on delivery available' : ' · Prepaid only'}
        </p>
      )}
    </form>
  );
}

// ---------------------------------------------------------------- free delivery progress

export function FreeDeliveryBar({ subtotal }: { subtotal: number }) {
  const left = FREE_SHIPPING_THRESHOLD - subtotal;
  const pct = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100));
  return (
    <div className="card free-bar" role="status">
      <p>{left > 0 ? <>Add <strong>{money(left)}</strong> more for <strong>FREE delivery</strong></> : <><Icon name="truck" size={18} /> Your order gets <strong>FREE delivery</strong></>}</p>
      <div className="free-track"><div className="free-fill" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
