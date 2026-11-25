import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { productService } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { useShopConfig } from '../hooks/useShopConfig';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import type { Gender, ProductFilters, SortOption } from '../types';
import FilterPanel, { PRICE_MAX, PRICE_MIN } from '../components/FilterPanel';
import ProductGrid from '../components/ProductGrid';
import Pagination from '../components/Pagination';
import ErrorState from '../components/ErrorState';

const PAGE_SIZE = 12;
const SORTS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'best', label: 'Best Selling' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
];
const COLLECTION_TITLES = { new: 'New Arrivals', best: 'Best Sellers', sale: 'Sale' } as const;

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const [drawer, setDrawer] = useState(false);
  const gridTop = useRef<HTMLDivElement>(null);
  const { currencySymbol } = useShopConfig();

  const filters: ProductFilters = useMemo(() => {
    const num = (k: string) => (params.get(k) ? Number(params.get(k)) : undefined);
    const col = params.get('collection');
    return {
      q: params.get('q') ?? undefined,
      category: params.get('category') ?? undefined,
      gender: (params.get('gender') as Gender) ?? undefined,
      size: params.get('size') ?? undefined,
      color: params.get('color') ?? undefined,
      minPrice: num('minPrice'),
      maxPrice: num('maxPrice'),
      collection: col === 'new' || col === 'best' || col === 'sale' ? col : undefined,
      sort: (params.get('sort') as SortOption) ?? 'newest',
      page: Math.max(1, num('page') ?? 1),
    };
  }, [params]);

  const [searchText, setSearchText] = useState(filters.q ?? '');
  useEffect(() => setSearchText(filters.q ?? ''), [filters.q]);

  /** Changing any filter, sort or search goes back to page 1; only explicit page changes keep the page. */
  const patch = (p: Partial<ProductFilters>) => {
    const next = new URLSearchParams(params);
    if (!('page' in p)) next.delete('page');
    Object.entries(p).forEach(([k, v]) => (v === undefined || v === '' || (k === 'page' && v === 1) ? next.delete(k) : next.set(k, String(v))));
    setParams(next, { replace: true });
  };
  const clear = () => setParams(new URLSearchParams(), { replace: true });
  const goToPage = (page: number) => {
    patch({ page });
    const top = gridTop.current?.getBoundingClientRect().top;
    if (top !== undefined) window.scrollTo({ top: Math.max(0, top + window.scrollY - 110), behavior: 'instant' });
  };

  // Debounced search so typing does not thrash the URL or the API
  useEffect(() => {
    if (searchText === (filters.q ?? '')) return;
    const t = setTimeout(() => patch({ q: searchText.trim() || undefined }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  const { data, loading, error, reload } = useAsync((signal) => productService.list({ ...filters, limit: PAGE_SIZE }, signal), [params.toString()]);
  const items = data?.items ?? null;
  const meta = data?.meta;

  // A bookmarked page number that no longer exists (e.g. after products were removed): fall back to page 1
  useEffect(() => {
    if (meta && items?.length === 0 && meta.total > 0 && meta.page > 1) patch({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, items]);

  const title = filters.collection ? COLLECTION_TITLES[filters.collection]
    : filters.gender ? `${filters.gender === 'men' ? "Men's" : "Women's"} Gear`
    : filters.q ? `Results for "${filters.q}"` : 'All Products';
  useDocumentTitle(title);

  const total = meta?.total ?? 0;
  const chips: { label: string; clear: Partial<ProductFilters> }[] = [
    filters.gender && { label: filters.gender, clear: { gender: undefined } },
    filters.category && { label: filters.category, clear: { category: undefined } },
    filters.size && { label: `Size ${filters.size}`, clear: { size: undefined } },
    filters.color && { label: filters.color, clear: { color: undefined } },
    (filters.minPrice !== undefined || filters.maxPrice !== undefined) && { label: `${currencySymbol}${filters.minPrice ?? PRICE_MIN} - ${currencySymbol}${filters.maxPrice ?? PRICE_MAX}`, clear: { minPrice: undefined, maxPrice: undefined } },
    filters.collection && { label: COLLECTION_TITLES[filters.collection], clear: { collection: undefined } },
  ].filter(Boolean) as { label: string; clear: Partial<ProductFilters> }[];

  const panel = <FilterPanel filters={filters} onChange={patch} onClear={clear} />;

  return (
    <div className="container-x py-8 lg:py-12">
      <header className="mb-6 border-b border-neutral-200 pb-6">
        <h1 className="text-5xl font-extrabold sm:text-6xl">{title}</h1>
        <p className="mt-1 text-sm text-neutral-500">{loading ? 'Loading products...' : error ? 'Products unavailable' : `${total} ${total === 1 ? 'product' : 'products'}`}</p>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-60">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search products..." aria-label="Search products" maxLength={80} className="input pl-10" />
        </div>
        <button onClick={() => setDrawer(true)} className="btn btn-outline !px-4 !py-3 lg:hidden"><SlidersHorizontal size={18} /> Filters</button>
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only sm:not-sr-only">Sort by</span>
          <select value={filters.sort} onChange={(e) => patch({ sort: e.target.value as SortOption })} className="input !w-auto cursor-pointer pr-8">
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
      </div>

      {chips.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <button key={c.label} onClick={() => patch(c.clear)} className="flex items-center gap-1.5 bg-neutral-100 px-3 py-1.5 text-sm capitalize transition-colors hover:bg-neutral-200">
              {c.label} <X size={14} />
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-10 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block">{panel}</aside>
        <div ref={gridTop}>
          {error ? (
            <ErrorState error={error} onRetry={reload} title="We could not load products" />
          ) : !loading && items?.length === 0 ? (
            <div className="py-20 text-center">
              <p className="font-display text-3xl font-bold uppercase">No products found</p>
              <p className="mt-2 text-neutral-500">Try adjusting your filters or search term.</p>
              <button onClick={clear} className="btn btn-dark mt-6">Clear filters</button>
            </div>
          ) : (
            <>
              <ProductGrid products={items} loading={loading} skeletons={PAGE_SIZE} cols="grid-cols-2 xl:grid-cols-3" />
              {!loading && meta && <Pagination meta={meta} onChange={goToPage} />}
            </>
          )}
        </div>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 animate-fade-in bg-black/60" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[88%] max-w-sm animate-slide-right flex-col bg-white">
            <div className="flex items-center justify-between border-b border-neutral-200 p-4">
              <h2 className="text-2xl font-extrabold">Filters</h2>
              <button onClick={() => setDrawer(false)} aria-label="Close filters"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4">{panel}</div>
            <div className="border-t border-neutral-200 p-4">
              <button onClick={() => setDrawer(false)} className="btn btn-primary w-full">Show {total} {total === 1 ? 'product' : 'products'}</button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
