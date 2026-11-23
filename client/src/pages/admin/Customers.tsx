import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { adminService } from '../../services/admin';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatPrice } from '../../utils/format';
import ErrorState from '../../components/ErrorState';
import Pagination from '../../components/Pagination';

const PAGE_SIZE = 20;

export default function Customers() {
  useDocumentTitle('Admin: customers');
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const status = params.get('status') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [text, setText] = useState(q);
  const { data, loading, error, reload } = useAsync(
    (s) => adminService.customers({ q: q || undefined, status: status || undefined, page, limit: PAGE_SIZE }, s),
    [q, status, page],
  );

  /** Changing a filter goes back to page 1. Empty values are removed from the URL. */
  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries({ ...patch, page: patch.page ?? '' }).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next);
  };
  // Typing is debounced into the URL. While the admin is typing, a URL change does not overwrite the search box.
  const typing = useRef(false);
  useEffect(() => {
    if (text === q) { typing.current = false; return; }
    const t = setTimeout(() => { typing.current = false; update({ q: text.trim() }); }, 300);
    return () => clearTimeout(t);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  // Back and forward (or any other URL change) brings the search box in line with the URL.
  useEffect(() => { if (!typing.current) setText(q); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = !!(q || status);
  return (
    <div>
      <h1 className="mb-6 text-5xl font-extrabold">Customers</h1>
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_200px_auto]">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input value={text} onChange={(e) => { typing.current = true; setText(e.target.value); }} placeholder="Name, email or phone" aria-label="Search customers" maxLength={80} className="input bg-white pl-10" />
        </div>
        <select aria-label="Filter by account status" className="input bg-white" value={status} onChange={(e) => update({ status: e.target.value })}>
          <option value="">All accounts</option>
          <option value="active">Active</option>
          <option value="inactive">Deactivated</option>
        </select>
        {filtered && <button className="btn btn-outline !px-4 !py-2.5" onClick={() => { setText(''); setParams({}); }}>Clear</button>}
      </div>

      {error ? <ErrorState error={error} onRetry={reload} title="We could not load customers" /> : (
        <div className="bg-white">
          {loading ? <div className="space-y-px">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 animate-pulse bg-neutral-100" />)}</div>
            : !data?.items.length ? <p className="py-16 text-center text-neutral-500">{filtered ? 'No customers match these filters.' : page > 1 ? <>No customers on this page. <button className="underline hover:text-brand" onClick={() => update({ page: '' })}>Back to page 1</button></> : 'No customers yet. They appear here after they create an account.'}</p>
            : (
              <ul className="divide-y divide-neutral-200">
                {data.items.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                    <div className="min-w-0 flex-1 basis-56">
                      <Link to={`/admin/customers/${c.id}`} className="font-semibold hover:text-brand">{c.name}</Link>
                      <p className="truncate text-sm text-neutral-600">{c.email}</p>
                      <p className="truncate text-xs text-neutral-500">{[c.phone, c.city].filter(Boolean).join(' · ') || 'No phone or city on file'}</p>
                    </div>
                    <p className="w-28 text-sm text-neutral-600">{c.orderCount} {c.orderCount === 1 ? 'order' : 'orders'}<br /><span className="text-xs">{formatPrice(c.totalSpent)} spent</span></p>
                    <p className="w-32 text-sm text-neutral-600">{c.lastOrderAt ? `Last order ${new Date(c.lastOrderAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'No orders yet'}</p>
                    <span className={`inline-block px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${c.isActive ? 'bg-green-100 text-green-800' : 'bg-neutral-200 text-neutral-700'}`}>{c.isActive ? 'Active' : 'Deactivated'}</span>
                    <Link to={`/admin/customers/${c.id}`} className="btn btn-outline !px-4 !py-2 !text-base">View</Link>
                  </li>
                ))}
              </ul>
            )}
        </div>
      )}
      {data && !loading && <Pagination meta={data.meta} onChange={(n) => update({ page: n > 1 ? String(n) : '' })} />}
    </div>
  );
}
