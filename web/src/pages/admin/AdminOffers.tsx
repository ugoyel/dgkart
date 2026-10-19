import { OFFER_KINDS, OFFER_LABELS, Offer, OfferKind, claimedPercent, isLive, isUpcoming, validateOffer } from '@engine';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { useCategories } from '../../components/Layout';
import { Modal, Spinner } from '../../components/ui';
import { site } from '../../config/site';
import { ds } from '../../data';
import type { Product } from '../../data';
import { dateTime, fromLocalInput, money, toLocalInput } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { errorText, usePromos, useToast } from '../../state/AppState';
import { AdminLayout, remindersChanged } from './AdminLayout';

type Status = 'live' | 'scheduled' | 'draft' | 'ended';

function statusOf(o: Offer, now: Date): Status {
  if (!o.isActive) return 'draft';
  if (isLive(o, now)) return 'live';
  if (isUpcoming(o, now)) return 'scheduled';
  return 'ended';
}

const HELP: Record<OfferKind, string> = {
  DEAL_OF_THE_DAY: 'A big discount on chosen products for one day. Shown with a countdown on the home page.',
  LIGHTNING_DEAL: 'A few hours, limited units. Shows a claimed bar; the price reverts when stock or time runs out.',
  COUPON: 'Either a promo code typed in the cart, or a clip coupon shoppers tick on the product page.',
  BANK_OFFER: 'Instant discount when paying online with the chosen bank’s card. Applied at checkout.',
  CATEGORY_SALE: 'Percent or flat off every product in the chosen categories.',
  FESTIVAL_SALE: 'Sitewide or category sale tied to a festival; shown in the festival banner.',
};

function blank(kind: OfferKind): Omit<Offer, 'id'> {
  const start = new Date(Date.now() + 3_600_000);
  start.setMinutes(0, 0, 0);
  const hours = kind === 'LIGHTNING_DEAL' ? 6 : kind === 'DEAL_OF_THE_DAY' ? 24 : 24 * 7;
  return {
    kind, title: '', description: '', discount: { type: 'PERCENT', value: kind === 'LIGHTNING_DEAL' ? 30 : 10 }, scope: {},
    startsAt: start.toISOString(), endsAt: new Date(start.getTime() + hours * 3_600_000).toISOString(), isActive: true,
    stockLimit: kind === 'LIGHTNING_DEAL' ? 50 : null, claimedCount: 0, perUserLimit: kind === 'COUPON' ? 1 : kind === 'LIGHTNING_DEAL' ? 2 : null,
    code: null, clip: false, minOrder: kind === 'BANK_OFFER' ? 2999 : null, bank: kind === 'BANK_OFFER' ? site.banks[0] : null, cardType: kind === 'BANK_OFFER' ? 'CREDIT' : null, festivalId: null,
  };
}

function ProductPicker({ ids, onChange }: { ids: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState('');
  const { data: chosen } = useAsync(() => ds.productsByIds(ids), [ids.join(',')]);
  const { data: results } = useAsync(() => (q.trim().length > 1 ? ds.search({ q, pageSize: 8 }) : Promise.resolve(null)), [q]);
  return (
    <div className="picker">
      <div className="chips">
        {(chosen ?? []).map((p) => (
          <span key={p.id} className="chip">{p.title.slice(0, 40)} <button type="button" onClick={() => onChange(ids.filter((x) => x !== p.id))} aria-label="Remove"><Icon name="close" size={14} /></button></span>
        ))}
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products by name, brand or SKU" />
      {results && (
        <ul className="picker-results">
          {results.items.map((p: Product) => (
            <li key={p.id}>
              <button type="button" disabled={ids.includes(p.id)} onClick={() => onChange([...ids, p.id])}>{p.title} <span className="muted">{money(p.price)} · {p.stock} in stock</span></button>
            </li>
          ))}
          {results.items.length === 0 && <li className="muted">No products match</li>}
        </ul>
      )}
    </div>
  );
}

function OfferEditor({ initial, onClose, onSaved }: { initial: Offer | Omit<Offer, 'id'>; onClose: () => void; onSaved: () => void }) {
  const [o, setO] = useState(initial);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const categories = useCategories();
  const { festivals } = usePromos();
  const set = (patch: Partial<Offer>) => setO((x) => ({ ...x, ...patch }));
  const errors = validateOffer(o);
  const isEdit = 'id' in o;
  const k = o.kind;
  const save = async () => {
    if (errors.length) return toast(errors[0], 'error');
    setSaving(true);
    try {
      if (isEdit) await ds.admin.updateOffer((o as Offer).id, o);
      else await ds.admin.createOffer(o);
      toast('Offer saved', 'success');
      onSaved();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setSaving(false);
    }
  };
  const num = (v: string) => (v === '' ? null : Number(v));
  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit offer' : `New ${OFFER_LABELS[k].toLowerCase()}`} wide>
      <div className="form-grid">
        <label>Type
          <select value={k} onChange={(e) => setO({ ...blank(e.target.value as OfferKind), title: o.title })} disabled={isEdit}>
            {OFFER_KINDS.map((x) => <option key={x} value={x}>{OFFER_LABELS[x]}</option>)}
          </select>
        </label>
        <p className="muted small span1">{HELP[k]}</p>
        <label className="span2">Title shoppers see<input value={o.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. 10% off with HDFC Bank credit cards" /></label>
        <label className="span2">Description (optional)<input value={o.description ?? ''} onChange={(e) => set({ description: e.target.value })} /></label>
        <label>Discount
          <div className="row">
            <select value={o.discount.type} onChange={(e) => set({ discount: { ...o.discount, type: e.target.value as 'PERCENT' | 'FLAT' } })}>
              <option value="PERCENT">% off</option><option value="FLAT">₹ off</option>
            </select>
            <input type="number" min={0} step="0.5" value={o.discount.value} onChange={(e) => set({ discount: { ...o.discount, value: Number(e.target.value) } })} />
          </div>
        </label>
        {o.discount.type === 'PERCENT' && (
          <label>Maximum discount ₹ (optional)<input type="number" min={0} value={o.discount.maxDiscount ?? ''} onChange={(e) => set({ discount: { ...o.discount, maxDiscount: num(e.target.value) ?? undefined } })} /></label>
        )}
        <label>Starts<input type="datetime-local" value={toLocalInput(o.startsAt)} onChange={(e) => set({ startsAt: fromLocalInput(e.target.value) })} /></label>
        <label>Ends<input type="datetime-local" value={toLocalInput(o.endsAt)} onChange={(e) => set({ endsAt: fromLocalInput(e.target.value) })} /></label>

        {(k === 'LIGHTNING_DEAL' || k === 'DEAL_OF_THE_DAY' || k === 'COUPON' || k === 'FESTIVAL_SALE') && (
          <div className="span2">
            <span className="label">Products {k === 'COUPON' || k === 'FESTIVAL_SALE' ? '(optional)' : ''}</span>
            <ProductPicker ids={o.scope.productIds ?? []} onChange={(productIds) => set({ scope: { ...o.scope, productIds } })} />
          </div>
        )}
        {(k === 'CATEGORY_SALE' || k === 'COUPON' || k === 'FESTIVAL_SALE') && (
          <label className="span2">Categories {k !== 'CATEGORY_SALE' ? '(empty = everything)' : ''}
            <select multiple size={6} value={o.scope.categoryIds ?? []} onChange={(e) => set({ scope: { ...o.scope, categoryIds: [...e.target.selectedOptions].map((x) => x.value) } })}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.parentId ? '— ' : ''}{c.name}</option>)}
            </select>
          </label>
        )}
        {k === 'COUPON' && (
          <>
            <label className="check"><input type="checkbox" checked={!!o.clip} onChange={(e) => set({ clip: e.target.checked, code: e.target.checked ? null : o.code })} /> Clip coupon (ticked on the product page, no code)</label>
            {!o.clip && <label>Code<input value={o.code ?? ''} onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} placeholder="DIWALI26" /></label>}
          </>
        )}
        {k === 'BANK_OFFER' && (
          <>
            <label>Bank
              <input list="banks" value={o.bank ?? ''} onChange={(e) => set({ bank: e.target.value })} />
              <datalist id="banks">{site.banks.map((b) => <option key={b} value={b} />)}</datalist>
            </label>
            <label>Card type
              <select value={o.cardType ?? 'ANY'} onChange={(e) => set({ cardType: e.target.value as 'ANY' })}>
                <option value="ANY">Credit and debit</option><option value="CREDIT">Credit cards</option><option value="DEBIT">Debit cards</option>
              </select>
            </label>
          </>
        )}
        {(k === 'COUPON' || k === 'BANK_OFFER') && (
          <label>Minimum order ₹<input type="number" min={0} value={o.minOrder ?? ''} onChange={(e) => set({ minOrder: num(e.target.value) })} /></label>
        )}
        <label>{k === 'LIGHTNING_DEAL' ? 'Units available' : 'Total redemptions (optional)'}<input type="number" min={1} value={o.stockLimit ?? ''} onChange={(e) => set({ stockLimit: num(e.target.value) })} /></label>
        <label>Limit per customer (optional)<input type="number" min={1} value={o.perUserLimit ?? ''} onChange={(e) => set({ perUserLimit: num(e.target.value) })} /></label>
        <label>Festival
          <select value={o.festivalId ?? ''} onChange={(e) => set({ festivalId: e.target.value || null })}>
            <option value="">None</option>
            {festivals.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
        {(k === 'CATEGORY_SALE' || k === 'FESTIVAL_SALE') && (
          <label>Banner image URL (optional)<input value={o.bannerImage ?? ''} onChange={(e) => set({ bannerImage: e.target.value || null })} placeholder="https://…" /></label>
        )}
        <label className="check span2"><input type="checkbox" checked={o.isActive} onChange={(e) => set({ isActive: e.target.checked })} /> Active (unticked = draft, never shown)</label>
      </div>
      {errors.length > 0 && <ul className="errors">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      <div className="row modal-actions">
        <button className="btn" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save offer'}</button>
        <button className="btn btn-outline" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

export function AdminOffers() {
  const [params, setParams] = useSearchParams();
  const { data, reload, error } = useAsync(() => ds.admin.offers(), []);
  const { festivals, refresh } = usePromos();
  const toast = useToast();
  const [editing, setEditing] = useState<Offer | Omit<Offer, 'id'> | null>(null);
  const kind = params.get('kind') ?? '';
  const status = params.get('status') ?? '';
  const festival = params.get('festival') ?? '';
  const now = new Date();

  useEffect(() => {
    const n = params.get('new') as OfferKind | null;
    if (n && OFFER_KINDS.includes(n)) {
      setEditing(blank(n));
      params.delete('new');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const list = useMemo(
    () => (data ?? []).filter((o) => (!kind || o.kind === kind) && (!status || statusOf(o, now) === status) && (!festival || o.festivalId === festival)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, kind, status, festival],
  );
  const drafts = list.filter((o) => !o.isActive);
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    setParams(p);
  };
  const after = async () => {
    setEditing(null);
    reload();
    await refresh();
    remindersChanged();
  };
  const toggle = async (o: Offer) => {
    try {
      await ds.admin.updateOffer(o.id, { isActive: !o.isActive });
      after();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  };
  const remove = async (o: Offer) => {
    if (!confirm(`Delete "${o.title}"?`)) return;
    await ds.admin.deleteOffer(o.id);
    after();
  };
  const activateAll = async () => {
    try {
      for (const o of drafts) await ds.admin.updateOffer(o.id, { isActive: true });
      toast(`${drafts.length} offers activated`, 'success');
      after();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  };

  return (
    <AdminLayout title="Offers & deals" actions={<button className="btn btn-sm" onClick={() => setEditing(blank('LIGHTNING_DEAL'))}><Icon name="plus" size={16} /> New offer</button>}>
      <div className="filters-row">
        <select value={kind} onChange={(e) => set('kind', e.target.value)} aria-label="Type"><option value="">All types</option>{OFFER_KINDS.map((k) => <option key={k} value={k}>{OFFER_LABELS[k]}</option>)}</select>
        <select value={status} onChange={(e) => set('status', e.target.value)} aria-label="Status"><option value="">Any status</option><option value="live">Live</option><option value="scheduled">Scheduled</option><option value="draft">Draft</option><option value="ended">Ended</option></select>
        <select value={festival} onChange={(e) => set('festival', e.target.value)} aria-label="Festival"><option value="">Any festival</option>{festivals.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
        {drafts.length > 0 && <button className="btn btn-sm btn-accent" onClick={activateAll}>Activate {drafts.length} draft{drafts.length > 1 ? 's' : ''}</button>}
      </div>
      {error && <p className="bad">{error}</p>}
      {!data && <Spinner />}
      {data && list.length === 0 && <p className="card muted">No offers match. Create one, or use “Create draft offers” on a festival reminder.</p>}
      {list.length > 0 && <div className="table-wrap card">
        <table className="table offers-table">
          <thead><tr><th>Offer</th><th>Discount</th><th>Runs</th><th>Status</th><th>Claimed</th><th /></tr></thead>
          <tbody>
            {list.map((o) => {
              const s = statusOf(o, now);
              return (
                <tr key={o.id}>
                  <td><span className="badge badge-sale">{OFFER_LABELS[o.kind]}</span> <strong>{o.title}</strong>{o.code && <code> {o.code}</code>}{o.bank && <span className="muted"> · {o.bank}</span>}{o.festivalId && <span className="muted"> · {festivals.find((f) => f.id === o.festivalId)?.name}</span>}</td>
                  <td>{o.discount.type === 'PERCENT' ? `${o.discount.value}%` : money(o.discount.value)}{o.discount.maxDiscount ? ` (max ${money(o.discount.maxDiscount)})` : ''}{o.minOrder ? ` · min ${money(o.minOrder)}` : ''}</td>
                  <td className="small">{dateTime(o.startsAt)} → {dateTime(o.endsAt)}</td>
                  <td><span className={`status st-${s}`}>{s}</span></td>
                  <td>{o.stockLimit ? `${o.claimedCount ?? 0}/${o.stockLimit} (${claimedPercent(o)}%)` : o.claimedCount ?? 0}</td>
                  <td className="row nowrap">
                    <button className="icon-btn" onClick={() => setEditing(o)} aria-label="Edit"><Icon name="edit" size={18} /></button>
                    <button className="link" onClick={() => toggle(o)}>{o.isActive ? 'Pause' : 'Activate'}</button>
                    <button className="icon-btn" onClick={() => remove(o)} aria-label="Delete"><Icon name="trash" size={18} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>}
      {editing && <OfferEditor initial={editing} onClose={() => setEditing(null)} onSaved={after} />}
    </AdminLayout>
  );
}
