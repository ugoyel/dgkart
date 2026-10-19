import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PriceSummary } from '../components/PriceSummary';
import { Empty, Img, QtyStepper, Spinner, useTitle } from '../components/ui';
import { ds } from '../data';
import type { Quote } from '../data';
import { money } from '../lib/format';
import { store } from '../lib/storage';
import { useAuth, useCart, usePromos } from '../state/AppState';

export const COUPON_KEY = 'dg.coupon';

export function CartPage() {
  useTitle('Shopping cart');
  const { items, setQty, remove, loading } = useCart();
  const { clipped, offers } = usePromos();
  const { user } = useAuth();
  const nav = useNavigate();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [code, setCode] = useState(() => store.get<string>(COUPON_KEY) ?? '');
  const [applied, setApplied] = useState(code);

  const key = items.map((i) => `${i.productId}:${i.quantity}`).join(',') + clipped.join(',') + applied + offers.length;
  useEffect(() => {
    if (!items.length) return setQuote(null);
    ds.quote({ items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })), clippedCouponIds: clipped, couponCode: applied || undefined })
      .then(setQuote)
      .catch(() => setQuote(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const apply = (e: FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    setApplied(c);
    if (c) store.set(COUPON_KEY, c);
    else store.remove(COUPON_KEY);
  };

  if (loading && !items.length) return <div className="container"><Spinner /></div>;
  if (!items.length) {
    return (
      <div className="container">
        <Empty title="Your cart is empty" icon="cart">
          <p>Find something you love in today’s deals.</p>
          <Link to="/deals" className="btn">See today’s deals</Link>
        </Empty>
      </div>
    );
  }

  return (
    <div className="container cart-page">
      <h1 className="page-title">Shopping cart</h1>
      <div className="two-col">
        <section className="card cart-list">
          {items.map((i) => {
            const line = quote?.lines.find((l) => l.productId === i.productId);
            return (
              <div key={i.productId} className="cart-row">
                <Link to={`/product/${i.productId}`} className="cart-img"><Img src={i.product.thumbnailUrl} alt={i.product.title} /></Link>
                <div className="cart-info">
                  <Link to={`/product/${i.productId}`} className="cart-title">{i.product.title}</Link>
                  <span className={i.product.stock > 0 ? 'ok small' : 'bad small'}>{i.product.stock > 0 ? 'In stock' : 'Out of stock'}</span>
                  {line?.deal && <span className="badge badge-lightning">{line.deal.title.split(':')[0]}</span>}
                  {line && line.clipDiscount > 0 && <span className="save small">Coupon saves {money(line.clipDiscount)}</span>}
                  <div className="cart-actions">
                    <QtyStepper value={i.quantity} max={i.product.stock} onChange={(n) => (n <= 0 ? remove(i.productId) : setQty(i.productId, n))} />
                    <button className="link" onClick={() => remove(i.productId)}>Delete</button>
                  </div>
                </div>
                <div className="cart-price">
                  <strong>{money(line?.lineTotal ?? i.product.price * i.quantity)}</strong>
                  {line && line.unitPrice < line.listPrice && <s className="muted small">{money(line.listPrice * i.quantity)}</s>}
                </div>
              </div>
            );
          })}
        </section>
        <aside>
          <PriceSummary quote={quote} />
          <form className="card coupon-form" onSubmit={apply}>
            <label htmlFor="coupon">Have a promo code?</label>
            <div className="row">
              <input id="coupon" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. WELCOME100" />
              <button className="btn btn-sm">{applied && applied === code ? 'Applied' : 'Apply'}</button>
            </div>
            {applied && quote?.couponError && <p className="bad small">{quote.couponError}</p>}
            {applied && quote && !quote.couponError && quote.couponDiscount > 0 && <p className="ok small">{applied} saves you {money(quote.couponDiscount)}</p>}
            <p className="muted small">Bank offers are applied at checkout when you pick your card.</p>
          </form>
          <button className="btn btn-accent btn-block" onClick={() => nav(user ? '/checkout' : '/login?next=/checkout')}>
            Proceed to buy ({items.reduce((s, i) => s + i.quantity, 0)} items)
          </button>
        </aside>
      </div>
    </div>
  );
}
