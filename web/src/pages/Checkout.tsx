import { CardType, isLive } from '@engine';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { PriceSummary } from '../components/PriceSummary';
import { Img, Modal, Spinner, useTitle } from '../components/ui';
import { site } from '../config/site';
import { ds } from '../data';
import type { Address, Order, PaymentMethod, Product, Quote } from '../data';
import { money, uid } from '../lib/format';
import { store } from '../lib/storage';
import { errorText, useAuth, useCart, usePromos, useToast } from '../state/AppState';
import { COUPON_KEY } from './Cart';

const STATES = ['Andhra Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu & Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'];

export function AddressForm({ initial, onSave, onCancel }: { initial?: Address; onSave: (a: Address) => void; onCancel?: () => void }) {
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    onSave({ id: initial?.id ?? uid(), name: f.name, phone: f.phone, line1: f.line1, line2: f.line2 || undefined, city: f.city, state: f.state, pincode: f.pincode, isDefault: initial?.isDefault });
  };
  return (
    <form className="form-grid" onSubmit={submit}>
      <label>Full name<input name="name" required defaultValue={initial?.name} autoComplete="name" /></label>
      <label>Mobile number<input name="phone" required pattern="[6-9][0-9]{9}" title="10 digit mobile number" defaultValue={initial?.phone} inputMode="numeric" autoComplete="tel-national" /></label>
      <label className="span2">Flat, house no., building, street<input name="line1" required defaultValue={initial?.line1} autoComplete="address-line1" /></label>
      <label className="span2">Area, landmark (optional)<input name="line2" defaultValue={initial?.line2} autoComplete="address-line2" /></label>
      <label>Town / city<input name="city" required defaultValue={initial?.city} autoComplete="address-level2" /></label>
      <label>Pincode<input name="pincode" required pattern="[0-9]{6}" title="6 digit pincode" defaultValue={initial?.pincode} inputMode="numeric" autoComplete="postal-code" /></label>
      <label className="span2">State
        <select name="state" required defaultValue={initial?.state ?? ''}>
          <option value="" disabled>Choose a state</option>
          {STATES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </label>
      <div className="span2 row">
        <button className="btn">Save address</button>
        {onCancel && <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

type SimResult = 'success' | 'failure' | 'cancel';

export function Checkout() {
  useTitle('Checkout');
  const { user, setUser, ready } = useAuth();
  const cart = useCart();
  const { clipped, offers } = usePromos();
  const toast = useToast();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const buyId = params.get('buy');
  const buyQty = Number(params.get('qty') ?? 1);
  const [buyProduct, setBuyProduct] = useState<Product | null>(null);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [placedId, setPlacedId] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('ONLINE');
  const [bank, setBank] = useState('');
  const [cardType, setCardType] = useState<CardType>('CREDIT');
  const [code, setCode] = useState(() => store.get<string>(COUPON_KEY) ?? '');
  const [applied, setApplied] = useState(code);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [placing, setPlacing] = useState(false);
  const [sim, setSim] = useState<Order | null>(null);
  const simResolve = useRef<(r: SimResult) => void>(() => {});

  useEffect(() => {
    if (buyId) ds.product(buyId).then(setBuyProduct).catch(() => toast('That product is no longer available', 'error'));
  }, [buyId, toast]);
  useEffect(() => {
    if (user && !addressId) setAddressId(user.addresses.find((a) => a.isDefault)?.id ?? user.addresses[0]?.id ?? null);
  }, [user, addressId]);

  const lines = useMemo(
    () => (buyId ? (buyProduct ? [{ productId: buyProduct.id, quantity: buyQty, product: buyProduct }] : []) : cart.items),
    [buyId, buyProduct, buyQty, cart.items],
  );
  const bankOffers = offers.filter((o) => o.kind === 'BANK_OFFER' && isLive(o, new Date()));
  const banks = [...new Set([...bankOffers.map((o) => o.bank!).filter(Boolean), ...site.banks])];
  const payment = { method, bank: method === 'ONLINE' && bank ? bank : undefined, cardType: method === 'ONLINE' && bank ? cardType : undefined };

  const key = JSON.stringify([lines.map((l) => [l.productId, l.quantity]), clipped, applied, payment, offers.length]);
  useEffect(() => {
    if (!lines.length) return;
    ds.quote({ items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })), clippedCouponIds: clipped, couponCode: applied || undefined, payment })
      .then(setQuote)
      .catch((e) => toast(errorText(e), 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!ready) return <div className="container"><Spinner /></div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent('/checkout' + (buyId ? `?buy=${buyId}&qty=${buyQty}` : ''))}`} replace />;
  // After an order is placed the cart is empty; stay here until payment finishes.
  if (!buyId && !cart.items.length && !cart.loading && !placedId) return <Navigate to="/cart" replace />;

  const address = user.addresses.find((a) => a.id === addressId);

  const saveAddress = async (a: Address) => {
    try {
      const list = [...user.addresses, { ...a, isDefault: user.addresses.length === 0 }];
      setUser(await ds.saveAddresses(list));
      setAddressId(a.id);
      setAdding(false);
    } catch (e) {
      toast(errorText(e), 'error');
    }
  };

  const ui = {
    simulate: (o: Order) => new Promise<SimResult>((resolve) => {
      simResolve.current = (r) => {
        setSim(null);
        resolve(r);
      };
      setSim(o);
    }),
  };

  const place = async () => {
    if (!address) return toast('Choose a delivery address', 'error');
    setPlacing(true);
    let placed: string | null = null;
    try {
      let order = await ds.placeOrder({
        address,
        paymentMethod: method,
        items: buyId ? lines.map((l) => ({ productId: l.productId, quantity: l.quantity })) : undefined,
        couponCode: applied && !quote?.couponError ? applied : undefined,
        clippedCouponIds: clipped,
        bank: payment.bank,
        cardType: payment.cardType,
      });
      placed = order.id;
      setPlacedId(order.id);
      if (!buyId) cart.clearLocal();
      store.remove(COUPON_KEY);
      if (method === 'ONLINE') order = await ds.pay(order, ui);
      nav(`/order/${order.id}?placed=1`, { replace: true });
    } catch (e) {
      toast(errorText(e), 'error');
      // The order exists even if payment failed or was cancelled: show it so the buyer can retry.
      if (placed) nav(`/order/${placed}?placed=1`, { replace: true });
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="container checkout">
      <h1 className="page-title">Checkout</h1>
      <div className="two-col">
        <div className="steps">
          <section className="card step">
            <h2><span className="step-n">1</span> Delivery address</h2>
            {user.addresses.map((a) => (
              <label key={a.id} className={`choice ${a.id === addressId ? 'on' : ''}`}>
                <input type="radio" name="addr" checked={a.id === addressId} onChange={() => setAddressId(a.id)} />
                <span><strong>{a.name}</strong>, {a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} {a.pincode} · {a.phone}</span>
              </label>
            ))}
            {adding || !user.addresses.length ? (
              <AddressForm onSave={saveAddress} onCancel={user.addresses.length ? () => setAdding(false) : undefined} />
            ) : (
              <button className="link" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> Add a new address</button>
            )}
          </section>

          <section className="card step">
            <h2><span className="step-n">2</span> Payment method</h2>
            <label className={`choice ${method === 'ONLINE' ? 'on' : ''}`}>
              <input type="radio" name="pay" checked={method === 'ONLINE'} onChange={() => setMethod('ONLINE')} />
              <span><strong>Pay online</strong> · UPI, credit / debit card, net banking, wallets (Razorpay)</span>
            </label>
            {method === 'ONLINE' && (
              <div className="bank-pick">
                <label>Paying with a bank card? Pick it for bank offers
                  <select value={bank} onChange={(e) => setBank(e.target.value)}>
                    <option value="">UPI / other</option>
                    {banks.map((b) => <option key={b} value={b}>{b}{bankOffers.some((o) => o.bank === b) ? ' (offer)' : ''}</option>)}
                  </select>
                </label>
                {bank && (
                  <div className="row">
                    {(['CREDIT', 'DEBIT'] as CardType[]).map((t) => (
                      <label key={t} className="check"><input type="radio" name="ct" checked={cardType === t} onChange={() => setCardType(t)} /> {t === 'CREDIT' ? 'Credit card' : 'Debit card'}</label>
                    ))}
                  </div>
                )}
                {bankOffers.length > 0 && (
                  <ul className="bank-offers">
                    {bankOffers.map((o) => <li key={o.id}><Icon name="bank" size={16} /> {o.title}{o.minOrder ? ` (min ${money(o.minOrder)})` : ''}</li>)}
                  </ul>
                )}
              </div>
            )}
            <label className={`choice ${method === 'COD' ? 'on' : ''}`}>
              <input type="radio" name="pay" checked={method === 'COD'} onChange={() => setMethod('COD')} />
              <span><strong>Cash on Delivery</strong> · pay when your order arrives (bank offers don’t apply)</span>
            </label>
          </section>

          <section className="card step">
            <h2><span className="step-n">3</span> Review items</h2>
            {lines.map((l) => {
              const q = quote?.lines.find((x) => x.productId === l.productId);
              return (
                <div key={l.productId} className="review-row">
                  <Img src={l.product.thumbnailUrl} alt="" />
                  <div><Link to={`/product/${l.productId}`}>{l.product.title}</Link><span className="muted small">Qty {l.quantity}{q?.deal ? ` · ${q.deal.title.split(':')[0]}` : ''}</span></div>
                  <strong>{money(q?.lineTotal ?? l.product.price * l.quantity)}</strong>
                </div>
              );
            })}
            <p className="muted small"><Icon name="truck" size={16} /> Delivery in {site.delivery.standardDays} days</p>
          </section>
        </div>

        <aside>
          <form className="card coupon-form" onSubmit={(e) => { e.preventDefault(); setApplied(code.trim().toUpperCase()); }}>
            <label htmlFor="ccode">Promo code</label>
            <div className="row">
              <input id="ccode" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Enter code" />
              <button className="btn btn-sm">Apply</button>
            </div>
            {applied && quote?.couponError && <p className="bad small">{quote.couponError}</p>}
            {applied && quote && !quote.couponError && quote.couponDiscount > 0 && <p className="ok small">{applied} applied</p>}
          </form>
          <PriceSummary quote={quote} title="Order summary" />
          <button className="btn btn-accent btn-block" disabled={placing || !address || !quote} onClick={place}>
            {placing ? 'Placing order…' : method === 'COD' ? `Place order · ${quote ? money(quote.total) : ''}` : `Pay ${quote ? money(quote.total) : ''}`}
          </button>
          <p className="muted small center">By placing your order you agree to {site.name}’s <Link to="/terms">terms</Link>.</p>
        </aside>
      </div>

      <Modal open={!!sim} onClose={() => simResolve.current('cancel')} title="Test payment">
        {sim && (
          <div className="sim-pay">
            <p>This store is in test mode, so no money moves. Choose what the payment gateway should report.</p>
            <p className="sim-amount">{money(sim.total)}</p>
            <p className="muted small">Order {sim.orderNumber}</p>
            <button className="btn btn-block" onClick={() => simResolve.current('success')}>Pay successfully</button>
            <button className="btn btn-outline btn-block" onClick={() => simResolve.current('failure')}>Simulate a failed payment</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
