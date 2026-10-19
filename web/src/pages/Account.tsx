import { FormEvent, Fragment, ReactElement, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Empty, Img, ProductCard, Spinner, useTitle } from '../components/ui';
import { config } from '../config/env';
import { site } from '../config/site';
import { ds } from '../data';
import type { Address, Order } from '../data';
import { confirmFirebaseOtp, firebaseConfigured, sendFirebaseOtp } from '../lib/firebaseOtp';
import { dateTime, money, statusLabel } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { errorText, useAuth, useToast } from '../state/AppState';
import { AddressForm } from './Checkout';

export function Login() {
  useTitle('Sign in');
  const { user, signIn, signInWithFirebase } = useAuth();
  const [params] = useSearchParams();
  const next = params.get('next') ?? '/';
  const nav = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'dev' | 'firebase' | 'demo'>('demo');
  useEffect(() => {
    ds.authMode().then(setMode).catch(() => {});
  }, []);
  if (user) return <Navigate to={next} replace />;

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'firebase') {
        if (!firebaseConfigured()) throw new Error('Firebase web config is missing (VITE_FIREBASE_* settings).');
        await sendFirebaseOtp(phone, 'otp-send');
        setHint('We sent a 6 digit code by SMS.');
      } else {
        const r = await ds.requestOtp(phone);
        setHint(r.hint ?? '');
      }
      setStep('otp');
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = mode === 'firebase' ? await signInWithFirebase(await confirmFirebaseOtp(code)) : await signIn(phone, code);
      toast(`Welcome${u.name ? `, ${u.name}` : ''}!`, 'success');
      nav(u.role === 'ADMIN' && next === '/' ? '/admin' : next, { replace: true });
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container auth-page">
      <div className="card auth-card">
        <h1>Sign in or create account</h1>
        {step === 'phone' ? (
          <form onSubmit={send}>
            <label>Mobile number
              <div className="phone-input"><span>+91</span><input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" autoComplete="tel-national" required pattern="[6-9][0-9]{9}" title="10 digit Indian mobile number" autoFocus /></div>
            </label>
            <button id="otp-send" className="btn btn-block" disabled={busy}>{busy ? 'Sending…' : 'Continue'}</button>
            <p className="muted small">We’ll send a one-time password (OTP) to verify your number. By continuing you agree to {site.name}’s <Link to="/terms">terms</Link> and <Link to="/privacy">privacy policy</Link>.</p>
          </form>
        ) : (
          <form onSubmit={verify}>
            <p>Enter the code sent to <strong>+91 {phone}</strong> <button type="button" className="link" onClick={() => setStep('phone')}>Change</button></p>
            <label>OTP<input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" required minLength={4} autoFocus className="otp" /></label>
            {hint && <p className="note small">{hint}</p>}
            <button className="btn btn-block" disabled={busy}>{busy ? 'Verifying…' : 'Verify & sign in'}</button>
          </form>
        )}
        {config.dataMode === 'demo' && <p className="muted small center">Demo: any mobile number works with OTP {site.demoOtp}. Use {site.adminPhone} for the admin panel.</p>}
      </div>
    </div>
  );
}

function RequireUser({ children }: { children: (u: NonNullable<ReturnType<typeof useAuth>['user']>) => ReactElement }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="container"><Spinner /></div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(window.location.pathname)}`} replace />;
  return children(user);
}

export function AccountPage() {
  useTitle('Your account');
  const { setUser, signOut, isAdmin } = useAuth();
  const toast = useToast();
  return (
    <RequireUser>
      {(user) => (
        <div className="container">
          <h1 className="page-title">Your account</h1>
          <div className="account-tiles">
            <Link to="/orders" className="card tile"><Icon name="receipt" size={32} /><div><strong>Your orders</strong><span>Track, cancel or buy again</span></div></Link>
            <Link to="/account/addresses" className="card tile"><Icon name="location" size={32} /><div><strong>Your addresses</strong><span>{user.addresses.length} saved</span></div></Link>
            <Link to="/watchlist" className="card tile"><Icon name="heart" size={32} /><div><strong>Watchlist</strong><span>Items you’re watching</span></div></Link>
            <Link to="/deals?tab=offers" className="card tile"><Icon name="tag" size={32} /><div><strong>Coupons & offers</strong><span>Codes and bank offers</span></div></Link>
            {isAdmin && <Link to="/admin" className="card tile"><Icon name="admin" size={32} /><div><strong>Admin panel</strong><span>Offers, festivals, catalogue</span></div></Link>}
          </div>
          <form
            className="card profile-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                setUser(await ds.updateProfile({ name: String(f.get('name') || '') || undefined, email: String(f.get('email') || '') || undefined }));
                toast('Profile saved', 'success');
              } catch (err) {
                toast(errorText(err), 'error');
              }
            }}
          >
            <h2>Login & security</h2>
            <label>Name<input name="name" defaultValue={user.name ?? ''} autoComplete="name" /></label>
            <label>Email<input name="email" type="email" defaultValue={user.email ?? ''} autoComplete="email" /></label>
            <label>Mobile number<input value={user.phone} disabled /></label>
            <div className="row">
              <button className="btn">Save</button>
              <button type="button" className="btn btn-outline" onClick={signOut}><Icon name="logout" size={18} /> Sign out</button>
            </div>
          </form>
        </div>
      )}
    </RequireUser>
  );
}

export function AddressesPage() {
  useTitle('Your addresses');
  const { setUser } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState<Address | 'new' | null>(null);
  return (
    <RequireUser>
      {(user) => {
        const save = async (list: Address[]) => {
          try {
            setUser(await ds.saveAddresses(list));
            setEditing(null);
          } catch (e) {
            toast(errorText(e), 'error');
          }
        };
        return (
          <div className="container">
            <h1 className="page-title">Your addresses</h1>
            {editing ? (
              <div className="card"><AddressForm initial={editing === 'new' ? undefined : editing} onCancel={() => setEditing(null)} onSave={(a) => save(editing === 'new' ? [...user.addresses, { ...a, isDefault: !user.addresses.length }] : user.addresses.map((x) => (x.id === a.id ? a : x)))} /></div>
            ) : (
              <div className="address-grid">
                <button className="card address-add" onClick={() => setEditing('new')}><Icon name="plus" size={36} />Add address</button>
                {user.addresses.map((a) => (
                  <div key={a.id} className="card address">
                    {a.isDefault && <span className="badge badge-sale">Default</span>}
                    <strong>{a.name}</strong>
                    <span>{a.line1}</span>{a.line2 && <span>{a.line2}</span>}
                    <span>{a.city}, {a.state} {a.pincode}</span>
                    <span>Phone: {a.phone}</span>
                    <div className="row">
                      <button className="link" onClick={() => setEditing(a)}>Edit</button>
                      <button className="link" onClick={() => save(user.addresses.filter((x) => x.id !== a.id))}>Remove</button>
                      {!a.isDefault && <button className="link" onClick={() => save(user.addresses.map((x) => ({ ...x, isDefault: x.id === a.id })))}>Set as default</button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }}
    </RequireUser>
  );
}

export function OrderCard({ o }: { o: Order }) {
  return (
    <Link to={`/order/${o.id}`} className="card order-card">
      <div className="order-head">
        <span><small>Order placed</small>{dateTime(o.createdAt)}</span>
        <span><small>Total</small>{money(o.total)}</span>
        <span><small>Order #</small>{o.orderNumber}</span>
        <span className={`status status-${o.status}`}>{statusLabel[o.status]}</span>
      </div>
      <div className="order-items">
        {o.items.slice(0, 4).map((l) => <div key={l.productId} className="order-thumb"><Img src={l.imageUrl} alt={l.title} /><span>{l.title}</span></div>)}
        {o.items.length > 4 && <span className="muted">+{o.items.length - 4} more</span>}
      </div>
    </Link>
  );
}

export function OrdersPage() {
  useTitle('Your orders');
  const { user } = useAuth();
  const { data, error } = useAsync(() => (user ? ds.orders() : Promise.resolve(null)), [user?.id]);
  return (
    <RequireUser>
      {() => (
        <div className="container">
          <h1 className="page-title">Your orders</h1>
          {error && <Empty title="Could not load orders">{error}</Empty>}
          {!data && !error && <Spinner />}
          {data?.items.length === 0 && <Empty title="No orders yet" icon="receipt"><Link to="/deals" className="btn">Start shopping</Link></Empty>}
          <div className="orders">{data?.items.map((o) => <OrderCard key={o.id} o={o} />)}</div>
        </div>
      )}
    </RequireUser>
  );
}

export function OrderPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const { data: o, error } = useAsync(() => (user ? ds.order(id) : Promise.resolve(null)), [id, user?.id]);
  useTitle(o ? `Order ${o.orderNumber}` : 'Order');
  return (
    <RequireUser>
      {() => (
        <div className="container order-page">
          {error && <Empty title="Order not found">{error}</Empty>}
          {!o && !error && <Spinner />}
          {o && (
            <>
              {params.get('placed') && (
                <div className={`card placed ${o.status === 'PAYMENT_FAILED' ? 'failed' : ''}`}>
                  <Icon name={o.status === 'PAYMENT_FAILED' ? 'info' : 'check'} size={36} />
                  <div>
                    <h1>{o.status === 'PAYMENT_FAILED' ? 'Payment failed' : o.status === 'PENDING_PAYMENT' ? 'Order placed, payment pending' : 'Order placed, thank you!'}</h1>
                    <p>{o.status === 'PAYMENT_FAILED' ? 'No money was taken. The items are back in stock; you can try again from your cart.' : `Confirmation will be sent to ${o.shippingAddress.phone}.`}</p>
                  </div>
                </div>
              )}
              <h1 className="page-title">Order #{o.orderNumber}</h1>
              <div className="two-col">
                <section className="card">
                  <p><span className={`status status-${o.status}`}>{statusLabel[o.status]}</span> · placed {dateTime(o.createdAt)} · {o.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Paid online'}</p>
                  {o.items.map((l) => (
                    <div key={l.productId} className="review-row">
                      <Img src={l.imageUrl} alt="" />
                      <div><Link to={`/product/${l.productId}`}>{l.title}</Link><span className="muted small">Qty {l.quantity} · {money(l.unitPrice)} each{l.listPrice && l.listPrice > l.unitPrice ? ` (was ${money(l.listPrice)})` : ''}</span></div>
                      <strong>{money(l.lineTotal ?? l.unitPrice * l.quantity)}</strong>
                    </div>
                  ))}
                  <h3>Delivering to</h3>
                  <p>{o.shippingAddress.name}, {o.shippingAddress.line1}{o.shippingAddress.line2 ? `, ${o.shippingAddress.line2}` : ''}, {o.shippingAddress.city}, {o.shippingAddress.state} {o.shippingAddress.pincode}</p>
                </section>
                <aside className="card summary">
                  <h2>Payment summary</h2>
                  <dl>
                    <dt>Items</dt><dd>{money(o.subtotal)}</dd>
                    {o.discounts.map((d) => <Fragment key={d.offerId}><dt>{d.title}</dt><dd className="save">−{money(d.amount)}</dd></Fragment>)}
                    <dt>Delivery</dt><dd>{o.shippingFee ? money(o.shippingFee) : 'FREE'}</dd>
                    <dt className="total">Total</dt><dd className="total">{money(o.total)}</dd>
                  </dl>
                  <p className="muted small">Deal savings are already included in item prices.</p>
                </aside>
              </div>
            </>
          )}
        </div>
      )}
    </RequireUser>
  );
}

export function WatchlistPage() {
  useTitle('Watchlist');
  const { user } = useAuth();
  const { data } = useAsync(() => (user ? ds.watchlist() : Promise.resolve([])), [user?.id]);
  return (
    <RequireUser>
      {() => (
        <div className="container">
          <h1 className="page-title">Watchlist</h1>
          {data && !data.length && <Empty title="You’re not watching anything yet" icon="heart"><p>Tap the heart on a product to get back to it later.</p></Empty>}
          <div className="grid">{data?.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        </div>
      )}
    </RequireUser>
  );
}
