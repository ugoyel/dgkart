import { site } from '../config/site';

const inr = new Intl.NumberFormat(site.locale, { style: 'currency', currency: site.currency, maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat(site.locale, { style: 'currency', currency: site.currency, minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** ₹1,299 (paise shown only when present). */
export const money = (n: number) => (Number.isInteger(n) ? inr.format(n) : inr2.format(n));

/** 2.9K, 1.2L style compact counts. */
export const compact = (n: number) => new Intl.NumberFormat(site.locale, { notation: 'compact', maximumFractionDigits: 1 }).format(n);

export const percentOff = (price: number, mrp?: number | null) => (mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0);

export const dateTime = (iso: string | Date) =>
  new Date(iso).toLocaleString(site.locale, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

export const date = (iso: string | Date) =>
  new Date(iso).toLocaleDateString(site.locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

/** 02:14:09 or 3d 04h for countdowns. */
export function countdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (x: number) => String(x).padStart(2, '0');
  return d > 0 ? `${d}d ${p(h)}h ${p(m)}m` : `${p(h)}:${p(m)}:${p(sec)}`;
}

/** Date input value (YYYY-MM-DDTHH:mm) in IST for <input type="datetime-local">. */
export function toLocalInput(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 5.5 * 3_600_000);
  return d.toISOString().slice(0, 16);
}
export function fromLocalInput(v: string): string {
  return new Date(`${v}:00+05:30`).toISOString();
}

export const conditionLabel: Record<string, string> = { NEW: 'Brand New', OPEN_BOX: 'Open box', REFURBISHED: 'Refurbished', USED: 'Pre-owned' };

export const statusLabel: Record<string, string> = {
  PENDING_PAYMENT: 'Awaiting payment', PAID: 'Paid', PAYMENT_FAILED: 'Payment failed', CONFIRMED_COD: 'Confirmed (COD)',
  SHIPPED: 'Shipped', DELIVERED: 'Delivered', CANCELLED: 'Cancelled',
};

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
  const r = (Math.random() * 16) | 0;
  return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
}));
