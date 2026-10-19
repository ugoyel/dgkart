import { AdminReminder, festivalHasOffers, isLive, isUpcoming, upcomingFestivals } from '@engine';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Motif } from '../../components/FestivalArt';
import { Icon } from '../../components/Icon';
import { Spinner } from '../../components/ui';
import { config } from '../../config/env';
import { ds } from '../../data';
import { compact, date, money } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { errorText, usePromos, useToast } from '../../state/AppState';
import { AdminLayout, remindersChanged } from './AdminLayout';

function useDraftAction() {
  const toast = useToast();
  const nav = useNavigate();
  const { refresh } = usePromos();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (r: Pick<AdminReminder, 'festivalId' | 'festivalName' | 'year'>) => {
    setBusy(r.festivalId);
    try {
      const drafts = await ds.admin.createDrafts(r.festivalId, r.year);
      toast(`${drafts.length} draft offers created for ${r.festivalName}. Review and activate them.`, 'success');
      await refresh();
      remindersChanged();
      nav(`/admin/offers?festival=${r.festivalId}&status=draft`);
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(null);
    }
  };
  return { busy, run };
}

export function ReminderCard({ r, onDismiss }: { r: AdminReminder; onDismiss?: () => void }) {
  const { busy, run } = useDraftAction();
  return (
    <div id={r.id} className={`card reminder lvl-${r.offersReady ? 'ok' : r.level}`}>
      <div className="reminder-days"><strong>{r.daysLeft}</strong><span>days left</span></div>
      <div className="reminder-body">
        <h3>{r.title}</h3>
        <p>{r.body}</p>
        <div className="row">
          {!r.offersReady && (
            <button className="btn btn-sm" disabled={busy === r.festivalId} onClick={() => run(r)}>
              {busy === r.festivalId ? 'Preparing…' : 'Create draft offers'}
            </button>
          )}
          <Link className="btn btn-outline btn-sm" to={`/admin/offers?festival=${r.festivalId}`}>Review offers</Link>
          <Link className="btn btn-outline btn-sm" to={`/admin/festivals#${r.festivalId}`}>Theme & dates</Link>
          {onDismiss && <button className="link" onClick={onDismiss}>Dismiss</button>}
        </div>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const { data: stats } = useAsync(() => ds.admin.stats(), []);
  const { data: reminders, reload } = useAsync(() => ds.admin.notifications(), []);
  const { resolved, offers, setPreviewDate } = usePromos();
  const now = new Date();
  const live = offers.filter((o) => isLive(o, now)).length;
  const scheduled = offers.filter((o) => isUpcoming(o, now)).length;
  const occ = resolved.occurrence;
  const [perm, setPerm] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);

  return (
    <AdminLayout title="Dashboard">
      <div className="stat-grid">
        {[
          ['Products', stats?.products, 'box'],
          ['Demo products', stats?.dummyProducts, 'box'],
          ['Orders', stats?.orders, 'receipt'],
          ['Revenue', stats ? money(stats.revenue) : undefined, 'bank'],
          ['Customers', stats?.users, 'user'],
          ['Live offers', live, 'tag'],
          ['Scheduled offers', scheduled, 'clock'],
          ['Without images', stats?.productsWithoutImages, 'info'],
        ].map(([label, value, icon]) => (
          <div key={label as string} className="card stat">
            <span className="muted"><Icon name={icon as 'box'} size={18} /> {label}</span>
            <strong>{value === undefined ? '…' : typeof value === 'number' ? compact(value) : value}</strong>
          </div>
        ))}
      </div>

      <div className="two-col admin-cols">
        <section>
          <div className="section-head"><h2>Festival reminders</h2><Link to="/admin/notifications" className="see-all">All reminders</Link></div>
          {!reminders && <Spinner />}
          {reminders?.length === 0 && <p className="muted card">No festival in the reminder window. You’ll be reminded weeks before each one.</p>}
          {reminders?.slice(0, 3).map((r) => <ReminderCard key={r.id} r={r} onDismiss={async () => { await ds.admin.dismiss(r.id); reload(); remindersChanged(); }} />)}
          {perm === 'default' && (
            <button className="btn btn-outline btn-sm" onClick={() => Notification.requestPermission().then(setPerm)}>
              <Icon name="bell" size={16} /> Also alert me with browser notifications
            </button>
          )}
        </section>
        <section className="card theme-card" style={{ background: resolved.theme.bannerBg, color: '#fff' }}>
          <Motif motif={resolved.theme.motif} size={72} />
          <div>
            <span className="small">Website theme right now</span>
            <h2>{occ ? `${occ.festival.name} (${resolved.phase === 'lead-up' ? `starts in ${resolved.daysToStart} days` : resolved.phase === 'live' ? 'live' : 'ending'})` : 'Everyday DGkart'}</h2>
            <p className="small">The header, footer, banner and colours switch automatically from each festival’s calendar and revert afterwards.</p>
            <div className="row">
              <Link to="/admin/festivals" className="btn btn-light btn-sm">Edit festivals</Link>
              {occ && <button className="btn btn-light btn-sm" onClick={() => setPreviewDate(null)}>View site</button>}
            </div>
          </div>
        </section>
      </div>

      <div className="card quick">
        <h2>Quick actions</h2>
        <div className="row wrap">
          <Link className="btn btn-sm" to="/admin/offers?new=LIGHTNING_DEAL">New lightning deal</Link>
          <Link className="btn btn-sm" to="/admin/offers?new=COUPON">New coupon</Link>
          <Link className="btn btn-sm" to="/admin/offers?new=BANK_OFFER">New bank offer</Link>
          <Link className="btn btn-sm" to="/admin/offers?new=CATEGORY_SALE">New category sale</Link>
          <Link className="btn btn-outline btn-sm" to="/admin/import">Upload products</Link>
          <Link className="btn btn-outline btn-sm" to="/admin/orders">Manage orders</Link>
        </div>
        {config.dataMode === 'demo' && <p className="note small">Demo mode: changes are saved in this browser only. Connect the API (VITE_DATA_MODE=api) to save them for everyone.</p>}
      </div>
    </AdminLayout>
  );
}

export function AdminNotifications() {
  const { data: reminders, reload } = useAsync(() => ds.admin.notifications(), []);
  const { festivals, offers, setPreviewDate } = usePromos();
  const { data: allOffers } = useAsync(() => ds.admin.offers(), []);
  const { busy, run } = useDraftAction();
  const nav = useNavigate();
  const now = new Date();
  const coming = upcomingFestivals(festivals, now, 200);
  return (
    <AdminLayout title="Festival reminders">
      <p className="muted">Reminders appear weeks before each festival (set per festival), with a ready-made set of draft offers. Dismissed reminders come back at the next reminder step.</p>
      {!reminders && <Spinner />}
      {reminders?.length === 0 && <p className="card muted">Nothing due right now.</p>}
      {reminders?.map((r) => <ReminderCard key={r.id} r={r} onDismiss={async () => { await ds.admin.dismiss(r.id); reload(); remindersChanged(); }} />)}

      <h2>Upcoming festivals</h2>
      <div className="table-wrap card">
        <table className="table">
          <thead><tr><th>Festival</th><th>Dates</th><th>Theme switches</th><th>Reminders</th><th>Offers</th><th /></tr></thead>
          <tbody>
            {coming.map((o) => {
              const ready = festivalHasOffers(o, allOffers ?? offers);
              return (
                <tr key={o.festival.id + o.year}>
                  <td><span className="swatch" style={{ background: o.festival.theme.bannerBg }} /> <strong>{o.festival.name}</strong>{o.festival.approximate && <span className="muted small"> (verify date)</span>}</td>
                  <td>{date(o.start)}{o.end.toDateString() !== o.start.toDateString() ? ` – ${date(o.end)}` : ''}</td>
                  <td>{date(o.themeFrom)}</td>
                  <td>{o.festival.reminderWeeks.map((w) => `${w}w`).join(', ')} before</td>
                  <td>{ready ? <span className="ok">Ready</span> : <span className="bad">Not set up</span>}</td>
                  <td className="row">
                    {!ready && <button className="btn btn-sm" disabled={busy === o.festival.id} onClick={() => run({ festivalId: o.festival.id, festivalName: o.festival.name, year: o.year })}>Draft offers</button>}
                    <button className="link" onClick={() => { setPreviewDate(new Date(o.start.getTime() + 12 * 3_600_000)); nav('/'); }}>Preview theme</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
