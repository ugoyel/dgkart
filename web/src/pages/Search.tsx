import { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useCategories } from '../components/Layout';
import { Empty, ProductCard, SkeletonGrid, useTitle } from '../components/ui';
import { ds } from '../data';
import type { Condition, SearchQuery, SortKey } from '../data';
import { compact, conditionLabel } from '../lib/format';
import { useAsync } from '../lib/useAsync';

const PAGE = 24;

export function Search() {
  const [params, setParams] = useSearchParams();
  const categories = useCategories();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const q: SearchQuery = {
    q: params.get('q') ?? undefined,
    category: params.get('category') ?? undefined,
    minPrice: params.get('min') ? Number(params.get('min')) : undefined,
    maxPrice: params.get('max') ? Number(params.get('max')) : undefined,
    condition: (params.get('condition') as Condition) ?? undefined,
    freeShipping: params.get('free') === '1' || undefined,
    sort: (params.get('sort') as SortKey) ?? 'best',
    page: Number(params.get('page') ?? 1),
    pageSize: PAGE,
  };
  const key = params.toString();
  const { data, error, loading } = useAsync(() => ds.search(q), [key]);
  const cat = categories.find((c) => c.slug === q.category);
  const parent = cat?.parentId ? categories.find((c) => c.id === cat.parentId) : null;
  const children = cat ? categories.filter((c) => c.parentId === cat.id) : [];
  useTitle(q.q ? `Results for "${q.q}"` : cat?.name ?? 'All products');

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    if (!('page' in patch)) next.delete('page');
    setParams(next);
  };

  const applyPrice = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    set({ min: (f.get('min') as string) || null, max: (f.get('max') as string) || null });
  };

  const filters = (
    <div className="filters">
      <div className="filter-group">
        <h3>Category</h3>
        {cat ? (
          <>
            <button className="link" onClick={() => set({ category: parent?.slug ?? null })}>‹ {parent ? parent.name : 'All categories'}</button>
            <strong className="filter-current">{cat.name}</strong>
            {children.map((c) => <button key={c.id} className="link sub" onClick={() => set({ category: c.slug })}>{c.name}</button>)}
          </>
        ) : (
          categories.filter((c) => !c.parentId).map((c) => <button key={c.id} className="link" onClick={() => set({ category: c.slug })}>{c.name}</button>)
        )}
      </div>
      <div className="filter-group">
        <h3>Price</h3>
        {[[0, 499], [500, 999], [1000, 4999], [5000, 19999], [20000, null]].map(([a, b]) => (
          <button key={a} className="link" onClick={() => set({ min: a ? String(a) : null, max: b ? String(b) : null })}>
            {b ? `₹${compact(a!)} – ₹${compact(b)}` : `Over ₹${compact(a!)}`}
          </button>
        ))}
        <form className="price-form" onSubmit={applyPrice} key={key}>
          <input name="min" type="number" min={0} placeholder="Min" defaultValue={q.minPrice} aria-label="Minimum price" />
          <input name="max" type="number" min={0} placeholder="Max" defaultValue={q.maxPrice} aria-label="Maximum price" />
          <button className="btn btn-sm">Go</button>
        </form>
      </div>
      <div className="filter-group">
        <h3>Condition</h3>
        {(['NEW', 'OPEN_BOX', 'REFURBISHED', 'USED'] as Condition[]).map((c) => (
          <label key={c} className="check">
            <input type="radio" name="cond" checked={q.condition === c} onChange={() => set({ condition: c })} /> {conditionLabel[c]}
          </label>
        ))}
        {q.condition && <button className="link" onClick={() => set({ condition: null })}>Any condition</button>}
      </div>
      <div className="filter-group">
        <h3>Delivery</h3>
        <label className="check"><input type="checkbox" checked={!!q.freeShipping} onChange={(e) => set({ free: e.target.checked ? '1' : null })} /> Free delivery</label>
      </div>
      {(q.category || q.minPrice || q.maxPrice || q.condition || q.freeShipping) && (
        <button className="btn btn-outline btn-sm" onClick={() => setParams(q.q ? { q: q.q } : {})}>Clear all filters</button>
      )}
    </div>
  );

  const pages = data ? Math.ceil(data.total / PAGE) : 0;
  return (
    <div className="container search-page">
      <div className="breadcrumbs">
        <Link to="/">Home</Link> › {parent && <><Link to={`/search?category=${parent.slug}`}>{parent.name}</Link> › </>}
        <span>{cat?.name ?? (q.q ? `“${q.q}”` : 'All products')}</span>
      </div>
      <div className="search-layout">
        <aside className="only-desktop">{filters}</aside>
        <section>
          <div className="results-bar">
            <span>{data ? `${data.total.toLocaleString('en-IN')} results${q.q ? ` for “${q.q}”` : ''}` : 'Searching…'}</span>
            <button className="btn btn-outline btn-sm only-mobile" onClick={() => setFiltersOpen(true)}><Icon name="filter" size={18} /> Filters</button>
            <label className="sort">
              Sort by
              <select value={q.sort} onChange={(e) => set({ sort: e.target.value })}>
                <option value="best">Best match</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
                <option value="newest">Newest arrivals</option>
              </select>
            </label>
          </div>
          {error && <Empty title="Search failed">{error}</Empty>}
          {loading && !data && <SkeletonGrid />}
          {data && data.items.length === 0 && (
            <Empty title="No matching products" icon="search">
              <p>Try fewer words or remove some filters.</p>
            </Empty>
          )}
          {data && (
            <div className={`grid ${loading ? 'dim' : ''}`}>
              {data.items.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
          {pages > 1 && (
            <nav className="pager" aria-label="Pages">
              <button disabled={q.page! <= 1} onClick={() => set({ page: String(q.page! - 1) })}>‹ Previous</button>
              <span>Page {q.page} of {pages}</span>
              <button disabled={q.page! >= pages} onClick={() => set({ page: String(q.page! + 1) })}>Next ›</button>
            </nav>
          )}
        </section>
      </div>
      {filtersOpen && (
        <div className="drawer-backdrop" onClick={() => setFiltersOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head"><strong>Filters</strong><button className="btn btn-sm" onClick={() => setFiltersOpen(false)}>Show results</button></div>
            {filters}
          </div>
        </div>
      )}
    </div>
  );
}

export function Categories() {
  useTitle('All categories');
  const categories = useCategories();
  const roots = categories.filter((c) => !c.parentId);
  return (
    <div className="container">
      <h1 className="page-title">Shop by category</h1>
      <div className="cat-grid">
        {roots.map((r) => (
          <div key={r.id} className="card cat-card">
            <Link to={`/search?category=${r.slug}`} className="cat-card-head">
              {r.imageUrl && <img src={r.imageUrl} alt="" loading="lazy" />}
              <h2>{r.name}</h2>
            </Link>
            <ul>
              {categories.filter((c) => c.parentId === r.id).map((c) => <li key={c.id}><Link to={`/search?category=${c.slug}`}>{c.name}</Link></li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
