import { OFFER_LABELS, Quote } from '@engine';
import { money } from '../lib/format';

/** Amazon-style order summary: items, deal savings, coupon, bank offer, delivery, total. */
export function PriceSummary({ quote, title = 'Price details' }: { quote: Quote | null; title?: string }) {
  if (!quote) return <div className="summary card"><h2>{title}</h2><p className="muted">Calculating…</p></div>;
  const clip = quote.applied.filter((a) => a.kind === 'COUPON' && !a.code);
  const clipTotal = clip.reduce((s, a) => s + a.amount, 0);
  const saved = quote.discount;
  return (
    <div className="summary card">
      <h2>{title}</h2>
      <dl>
        <dt>Items ({quote.lines.reduce((s, l) => s + l.quantity, 0)})</dt><dd>{money(quote.itemsTotal)}</dd>
        {quote.dealDiscount > 0 && <><dt>Deal savings</dt><dd className="save">−{money(quote.dealDiscount)}</dd></>}
        {clipTotal > 0 && <><dt>Coupon savings</dt><dd className="save">−{money(clipTotal)}</dd></>}
        {quote.couponDiscount > 0 && <><dt>Promo code</dt><dd className="save">−{money(quote.couponDiscount)}</dd></>}
        {quote.bankDiscount > 0 && <><dt>Bank offer</dt><dd className="save">−{money(quote.bankDiscount)}</dd></>}
        <dt>Delivery</dt><dd>{quote.shippingFee ? money(quote.shippingFee) : <span className="save">FREE</span>}</dd>
        <dt className="total">Order total</dt><dd className="total">{money(quote.total)}</dd>
      </dl>
      {saved > 0 && <p className="saved-line">You save {money(saved)} on this order</p>}
      {quote.applied.length > 0 && (
        <ul className="applied">
          {quote.applied.map((a) => <li key={a.offerId}><span className="badge badge-sale">{OFFER_LABELS[a.kind]}</span> {a.title} <strong>−{money(a.amount)}</strong></li>)}
        </ul>
      )}
      {quote.messages.map((m) => <p key={m} className="note small">{m}</p>)}
    </div>
  );
}
