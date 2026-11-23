import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Pencil, Plus, Search, Star, Trash2 } from 'lucide-react';
import { adminService } from '../../services/admin';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../../context/ToastContext';
import { formatPrice } from '../../utils/format';
import type { Product } from '../../types';
import ErrorState from '../../components/ErrorState';
import Pagination from '../../components/Pagination';
import ConfirmDialog from '../../components/ConfirmDialog';
import Img from '../../components/Img';

const LOW_STOCK = 10;

export default function Products() {
  useDocumentTitle('Admin: products');
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [text, setText] = useState(q);
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useAsync((s) => adminService.products({ q: q || undefined, page, limit: 10 }, s), [q, page]);

  useEffect(() => {
    if (text === q) return;
    const t = setTimeout(() => setParams(text.trim() ? { q: text.trim() } : {}, { replace: true }), 300);
    return () => clearTimeout(t);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  const change = async (p: Product, patch: { isActive?: boolean; isFeatured?: boolean }, msg: string) => {
    try { await adminService.updateProduct(p.id, patch); toast(msg); reload(); } catch (e) { toast((e as Error).message, 'error'); }
  };
  const remove = async () => {
    if (!toDelete) return;
    setBusy(true);
    try { await adminService.deleteProduct(toDelete.id); toast(`"${toDelete.name}" deleted`); setToDelete(null); reload(); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };

  const icon = 'flex h-9 w-9 items-center justify-center border border-neutral-300 transition-colors hover:border-neutral-950';
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-5xl font-extrabold">Products</h1>
        <Link to="/admin/products/new" className="btn btn-primary !px-5 !py-3"><Plus size={18} /> Add product</Link>
      </div>
      <div className="relative mb-5 max-w-md">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search products..." aria-label="Search products" maxLength={80} className="input bg-white pl-10" />
      </div>

      {error ? <ErrorState error={error} onRetry={reload} title="We could not load products" /> : (
        <div className="bg-white">
          {loading ? <div className="space-y-px">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 animate-pulse bg-neutral-100" />)}</div>
            : !data?.items.length ? <p className="py-16 text-center text-neutral-500">{q ? `No products match "${q}".` : 'No products yet. Add your first one.'}</p>
            : (
              <ul className="divide-y divide-neutral-200">
                {data.items.map((p) => {
                  const low = (p.totalStock ?? 0) <= LOW_STOCK;
                  return (
                    <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
                      <Img src={p.images[0]} alt="" className="h-20 w-16 shrink-0 object-cover" />
                      <div className="min-w-0 flex-1 basis-48">
                        <p className="truncate font-semibold">{p.name}</p>
                        <p className="text-xs capitalize text-neutral-500">{p.category} &middot; {p.gender}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {p.isActive === false && <span className="bg-neutral-200 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider">Hidden</span>}
                          {p.isFeatured && <span className="bg-brand px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white">Featured</span>}
                          {low && <span className={`px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${p.totalStock === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>{p.totalStock === 0 ? 'Out of stock' : 'Low stock'}</span>}
                        </div>
                      </div>
                      <div className="w-24 text-sm">
                        <p className="font-bold">{formatPrice(p.salePrice ?? p.price)}</p>
                        {p.salePrice != null && <p className="text-xs text-neutral-400 line-through">{formatPrice(p.price)}</p>}
                      </div>
                      <p className="w-20 text-sm text-neutral-600">{p.totalStock} in stock</p>
                      <div className="flex gap-1.5">
                        <button className={icon} aria-label={p.isFeatured ? `Remove ${p.name} from Best Sellers` : `Feature ${p.name} in Best Sellers`} aria-pressed={!!p.isFeatured} onClick={() => change(p, { isFeatured: !p.isFeatured }, p.isFeatured ? 'Removed from Best Sellers' : 'Featured in Best Sellers')}><Star size={16} className={p.isFeatured ? 'fill-brand text-brand' : ''} /></button>
                        <button className={icon} aria-label={p.isActive === false ? `Show ${p.name} in store` : `Hide ${p.name} from store`} onClick={() => change(p, { isActive: p.isActive === false }, p.isActive === false ? 'Now visible in the store' : 'Hidden from the store')}>{p.isActive === false ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                        <Link to={`/admin/products/${p.id}`} className={icon} aria-label={`Edit ${p.name}`}><Pencil size={16} /></Link>
                        <button className={`${icon} hover:!border-red-600 hover:text-red-600`} aria-label={`Delete ${p.name}`} onClick={() => setToDelete(p)}><Trash2 size={16} /></button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
        </div>
      )}
      {data && !loading && <Pagination meta={data.meta} onChange={(n) => setParams({ ...(q ? { q } : {}), ...(n > 1 ? { page: String(n) } : {}) })} />}
      <ConfirmDialog open={!!toDelete} title="Delete product?" message={`"${toDelete?.name}" and its reviews will be permanently deleted. Past orders keep their own copy of the details.`} busy={busy} onConfirm={remove} onCancel={() => setToDelete(null)} />
    </div>
  );
}
