import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { useCategories } from '../../components/Layout';
import { Img, Modal, Spinner } from '../../components/ui';
import { ds } from '../../data';
import type { ImageUploadResult, ImportJob, OrderStatus, Product } from '../../data';
import { dateTime, money, statusLabel } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { errorText, useToast } from '../../state/AppState';
import { AdminLayout } from './AdminLayout';

function ProductForm({ initial, onClose, onSaved }: { initial: Partial<Product> | null; onClose: () => void; onSaved: () => void }) {
  const categories = useCategories();
  const toast = useToast();
  const isEdit = !!initial?.id;
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const n = (k: string) => (f.get(k) === '' ? null : Number(f.get(k)));
    const data: Partial<Product> = {
      sku: String(f.get('sku')), title: String(f.get('title')), brand: String(f.get('brand') || '') || null, description: String(f.get('description') || ''),
      price: n('price') ?? 0, mrp: n('mrp'), stock: n('stock') ?? 0, categoryId: String(f.get('categoryId') || '') || null,
      condition: f.get('condition') as Product['condition'], freeShipping: f.get('freeShipping') === 'on', isActive: f.get('isActive') === 'on',
    };
    try {
      if (isEdit) await ds.admin.updateProduct(initial!.id!, data);
      else await ds.admin.createProduct(data);
      toast('Product saved', 'success');
      onSaved();
    } catch (err) {
      toast(errorText(err), 'error');
    }
  };
  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit product' : 'Add product'} wide>
      <form className="form-grid" onSubmit={submit}>
        <label>SKU<input name="sku" required defaultValue={initial?.sku} disabled={isEdit} /></label>
        <label>Brand<input name="brand" defaultValue={initial?.brand ?? ''} /></label>
        <label className="span2">Title<input name="title" required defaultValue={initial?.title} /></label>
        <label>Selling price ₹<input name="price" type="number" step="0.01" min={0} required defaultValue={initial?.price} /></label>
        <label>MRP ₹<input name="mrp" type="number" step="0.01" min={0} defaultValue={initial?.mrp ?? ''} /></label>
        <label>Stock<input name="stock" type="number" min={0} required defaultValue={initial?.stock ?? 0} /></label>
        <label>Category
          <select name="categoryId" defaultValue={initial?.categoryId ?? ''}>
            <option value="">None</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.parentId ? '— ' : ''}{c.name}</option>)}
          </select>
        </label>
        <label>Condition
          <select name="condition" defaultValue={initial?.condition ?? 'NEW'}><option value="NEW">New</option><option value="OPEN_BOX">Open box</option><option value="REFURBISHED">Refurbished</option><option value="USED">Used</option></select>
        </label>
        <label className="check"><input name="freeShipping" type="checkbox" defaultChecked={initial?.freeShipping ?? true} /> Free delivery</label>
        <label className="check"><input name="isActive" type="checkbox" defaultChecked={initial?.isActive ?? true} /> Visible in store</label>
        <label className="span2">Description<textarea name="description" rows={4} defaultValue={initial?.description ?? ''} /></label>
        <div className="span2 row"><button className="btn">Save product</button><button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button></div>
      </form>
    </Modal>
  );
}

export function AdminProducts() {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Partial<Product> | null | 'new'>(null);
  const toast = useToast();
  const { data, reload } = useAsync(() => ds.search({ q: query || undefined, page, pageSize: 25, sort: 'newest' }), [query, page]);
  const open = async (p: Product) => setEditing(await ds.product(p.id));
  return (
    <AdminLayout title="Products" actions={<button className="btn btn-sm" onClick={() => setEditing('new')}><Icon name="plus" size={16} /> Add product</button>}>
      <form className="filters-row" onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(q); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title, brand or SKU" />
        <button className="btn btn-sm">Search</button>
        <Link to="/admin/import" className="btn btn-outline btn-sm">Bulk upload from Excel</Link>
      </form>
      {!data && <Spinner />}
      <div className="table-wrap card">
        <table className="table">
          <thead><tr><th /><th>Product</th><th>SKU</th><th>Price</th><th>Stock</th><th>Sold</th><th /></tr></thead>
          <tbody>
            {data?.items.map((p) => (
              <tr key={p.id}>
                <td className="thumb"><Img src={p.thumbnailUrl} alt="" /></td>
                <td><Link to={`/product/${p.id}`}>{p.title}</Link></td>
                <td><code>{p.sku}</code></td>
                <td>{money(p.price)}{p.mrp ? <s className="muted small"> {money(p.mrp)}</s> : null}</td>
                <td className={p.stock < 5 ? 'bad' : ''}>{p.stock}</td>
                <td>{p.soldCount}</td>
                <td className="row nowrap">
                  <button className="icon-btn" onClick={() => open(p)} aria-label="Edit"><Icon name="edit" size={18} /></button>
                  <button className="icon-btn" aria-label="Delete" onClick={async () => { if (confirm(`Delete ${p.title}?`)) { try { await ds.admin.deleteProduct(p.id); reload(); } catch (e) { toast(errorText(e), 'error'); } } }}><Icon name="trash" size={18} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && (
        <nav className="pager">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Previous</button>
          <span>{data.total.toLocaleString('en-IN')} products · page {page}</span>
          <button disabled={!data.hasMore} onClick={() => setPage(page + 1)}>Next ›</button>
        </nav>
      )}
      {editing && <ProductForm initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </AdminLayout>
  );
}

function JobStatus({ job }: { job: ImportJob }) {
  const pct = job.totalRows ? Math.round((job.processedRows / job.totalRows) * 100) : job.status === 'DONE' ? 100 : 0;
  return (
    <div className="job">
      <div className="claim-track"><div className="claim-fill" style={{ width: `${pct}%` }} /></div>
      <p className="small">{job.status === 'DONE' ? 'Finished' : job.status === 'FAILED' ? 'Failed' : 'Working'}: {job.processedRows.toLocaleString('en-IN')} of {job.totalRows.toLocaleString('en-IN')} rows · {job.upsertedRows} saved · {job.failedRows} errors</p>
      {job.errors?.length > 0 && <ul className="errors small">{job.errors.slice(0, 10).map((e) => <li key={e.row}>Row {e.row}: {e.message}</li>)}</ul>}
    </div>
  );
}

function useJob() {
  const [job, setJob] = useState<ImportJob | null>(null);
  useEffect(() => {
    if (!job || job.status === 'DONE' || job.status === 'FAILED') return;
    const t = setTimeout(() => ds.admin.job(job.id).then(setJob).catch(() => {}), 700);
    return () => clearTimeout(t);
  }, [job]);
  return [job, setJob] as const;
}

export function AdminImport() {
  const toast = useToast();
  const [productsJob, setProductsJob] = useJob();
  const [mappingJob, setMappingJob] = useJob();
  const [images, setImages] = useState<ImageUploadResult | null>(null);
  const [busy, setBusy] = useState('');
  const can = ds.admin.canImport;

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy('');
    }
  };
  const uploadImages = (files: File[]) => run('images', async () => {
    const all: ImageUploadResult = { matched: [], unmatched: [] };
    for (let i = 0; i < files.length; i += 10) {
      const r = await ds.admin.uploadImages(files.slice(i, i + 10));
      all.matched.push(...r.matched);
      all.unmatched.push(...r.unmatched);
      setImages({ ...all });
    }
  });

  return (
    <AdminLayout title="Catalogue upload">
      {!can && <p className="note">Catalogue upload runs on the DGkart API. This site is in demo mode; start it with VITE_DATA_MODE=api to upload Excel files and images.</p>}
      <div className="steps">
        <section className="card step">
          <h2><span className="step-n">1</span> Import products from Excel</h2>
          <p className="muted">Upload .xlsx or .csv. Existing SKUs are updated, new ones added. Large files are processed in batches.</p>
          <div className="row wrap">
            <a className="btn btn-outline btn-sm" href={ds.admin.templateUrl('products')} download>Download template</a>
            <label className={`btn btn-sm ${!can ? 'disabled' : ''}`}>
              {busy === 'products' ? 'Uploading…' : 'Choose Excel file'}
              <input type="file" hidden accept=".xlsx,.csv" disabled={!can} onChange={(e) => e.target.files?.[0] && run('products', async () => setProductsJob(await ds.admin.importProducts(e.target.files![0])))} />
            </label>
          </div>
          {productsJob && <JobStatus job={productsJob} />}
        </section>
        <section className="card step">
          <h2><span className="step-n">2</span> Import image mapping sheet</h2>
          <p className="muted">Tells which image file name belongs to which SKU (and its position).</p>
          <div className="row wrap">
            <a className="btn btn-outline btn-sm" href={ds.admin.templateUrl('image-mapping')} download>Download template</a>
            <label className={`btn btn-sm ${!can ? 'disabled' : ''}`}>
              {busy === 'mapping' ? 'Uploading…' : 'Choose mapping sheet'}
              <input type="file" hidden accept=".xlsx,.csv" disabled={!can} onChange={(e) => e.target.files?.[0] && run('mapping', async () => setMappingJob(await ds.admin.importMapping(e.target.files![0])))} />
            </label>
          </div>
          {mappingJob && <JobStatus job={mappingJob} />}
        </section>
        <section className="card step">
          <h2><span className="step-n">3</span> Upload product images</h2>
          <p className="muted">Select many images at once; each is matched by its file name. Sent 10 at a time.</p>
          <label className={`btn btn-sm ${!can ? 'disabled' : ''}`}>
            {busy === 'images' ? 'Uploading…' : 'Choose images'}
            <input type="file" hidden multiple accept="image/*" disabled={!can} onChange={(e) => e.target.files?.length && uploadImages([...e.target.files])} />
          </label>
          {images && (
            <p className="small">{images.matched.length} matched · {images.unmatched.length} not matched{images.unmatched.length ? `: ${images.unmatched.slice(0, 8).map((u) => u.file).join(', ')}` : ''}</p>
          )}
        </section>
        <section className="card step">
          <h2><span className="step-n">4</span> Demo products</h2>
          <p className="muted">Remove the sample catalogue when your real products are in, or add it back.</p>
          <div className="row wrap">
            <button className="btn btn-outline btn-sm" disabled={busy === 'wipe'} onClick={() => confirm('Remove all demo products?') && run('wipe', async () => { const r = await ds.admin.wipeDummy(); toast(`${r.deleted} demo products removed`, 'success'); })}>Remove demo products</button>
            <button className="btn btn-outline btn-sm" disabled={busy === 'seed'} onClick={() => run('seed', async () => { await ds.admin.seed(500); toast('Demo products are being added', 'success'); })}>Add demo products</button>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}

const STATUSES: OrderStatus[] = ['PENDING_PAYMENT', 'PAID', 'CONFIRMED_COD', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'PAYMENT_FAILED'];

export function AdminOrders() {
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [page, setPage] = useState(1);
  const toast = useToast();
  const { data, reload } = useAsync(() => ds.admin.orders(page, status || undefined), [page, status]);
  return (
    <AdminLayout title="Orders">
      <div className="filters-row">
        <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value as OrderStatus); }} aria-label="Status">
          <option value="">All orders</option>
          {STATUSES.map((s) => <option key={s} value={s}>{statusLabel[s]}</option>)}
        </select>
      </div>
      {!data && <Spinner />}
      {data?.items.length === 0 && <p className="card muted">No orders yet.</p>}
      <div className="table-wrap card">
        <table className="table">
          <thead><tr><th>Order</th><th>Placed</th><th>Customer</th><th>Items</th><th>Offers</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>
            {data?.items.map((o) => (
              <tr key={o.id}>
                <td><Link to={`/order/${o.id}`}>{o.orderNumber}</Link><br /><span className="muted small">{o.paymentMethod}</span></td>
                <td className="small">{dateTime(o.createdAt)}</td>
                <td className="small">{o.shippingAddress.name}<br />{o.shippingAddress.city} {o.shippingAddress.pincode}</td>
                <td>{o.items.reduce((s, l) => s + l.quantity, 0)}</td>
                <td className="small">{o.discounts?.length ? o.discounts.map((d) => d.code ?? d.title.split(':')[0]).join(', ') : '–'}</td>
                <td>{money(o.total)}</td>
                <td>
                  <select value={o.status} onChange={async (e) => { try { await ds.admin.setOrderStatus(o.id, e.target.value as OrderStatus); reload(); } catch (err) { toast(errorText(err), 'error'); } }} aria-label="Order status">
                    {STATUSES.map((s) => <option key={s} value={s}>{statusLabel[s]}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && data.total > 20 && (
        <nav className="pager">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Previous</button>
          <span>Page {page}</span>
          <button disabled={!data.hasMore} onClick={() => setPage(page + 1)}>Next ›</button>
        </nav>
      )}
    </AdminLayout>
  );
}
