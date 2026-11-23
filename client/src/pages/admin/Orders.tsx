import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { adminService } from '../../services/admin';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatPrice } from '../../utils/format';
import ErrorState from '../../components/ErrorState';
import Pagination from '../../components/Pagination';
import StatusBadge from '../../components/StatusBadge';

const STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

export default function Orders() {
  useDocumentTitle('Admin: orders');
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? ''; const status = params.get('status') ?? ''; const from = params.get('from') ?? ''; const to = params.get('to') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [text, setText] = useState(q);
  const { data, loading, error, reload } = useAsync((s) => adminService.orders({ q: q || undefined, status: status || undefined, from: from || undefined, to: to || undefined, page, limit: 10 }, s), [q, status, from, to, page]);

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries({ ...patch, page: patch.page ?? '' }).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next);
  };
  useEffect(() => {
    if (text === q) return;
    const t = setTimeout(() => update({ q: text.trim() }), 300);
    return () => clearTimeout(t);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = !!(q || status || from || to);
  return (
    <div>
      <h1 className="mb-6 text-5xl font-extrabold">Orders</h1>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_180px_170px_170px_auto]">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Order number, name, email or phone" aria-label="Search orders" maxLength={80} className="input bg-white pl-10" />
        </div>
        <select aria-label="Filter by status" className="input bg-white capitalize" value={status} onChange={(e) => update({ status: e.target.value })}>
          <option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm"><span className="shrink-0 text-neutral-500">From</span><input type="date" aria-label="From date" className="input bg-white" value={from} max={to || undefined} onChange={(e) => update({ from: e.target.value })} /></label>
        <label className="flex items-center gap-2 text-sm"><span className="shrink-0 text-neutral-500">To</span><input type="date" aria-label="To date" className="input bg-white" value={to} min={from || undefined} onChange={(e) => update({ to: e.target.value })} /></label>
        {filtered && <button className="btn btn-outline !px-4 !py-2.5" onClick={() => { setText(''); setParams({}); }}>Clear</button>}
      </div>

      {error ? <ErrorState error={error} onRetry={reload} title="We could not load orders" /> : (
        <div className="bg-white">
          {loading ? <div className="space-y-px">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 animate-pulse bg-neutral-100" />)}</div>
            : !data?.items.length ? <p className="py-16 text-center text-neutral-500">{filtered ? 'No orders match these filters.' : 'No orders yet. They will appear here when customers check out.'}</p>
            : (
              <ul className="divide-y divide-neutral-200">
                {data.items.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                    <div className="min-w-0 flex-1 basis-52">
                      <Link to={`/admin/orders/${o.id}`} className="font-semibold hover:text-brand">{o.orderNumber}</Link>
                      <p className="truncate text-sm text-neutral-600">{o.customer.fullName}{o.isGuest && <span className="ml-2 bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">Guest</span>}</p>
                      <p className="text-xs text-neutral-500">{o.city} &middot; {o.customer.phone}</p>
                    </div>
                    <p className="w-28 text-sm text-neutral-600">{new Date(o.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}<br /><span className="text-xs">{o.itemCount} {o.itemCount === 1 ? 'item' : 'items'}</span></p>
                    <p className="w-20 text-sm uppercase text-neutral-500">{o.paymentMethod}</p>
                    <p className="w-24 font-bold">{formatPrice(o.total)}</p>
                    <div className="w-28"><StatusBadge status={o.status} /></div>
                    <Link to={`/admin/orders/${o.id}`} className="btn btn-outline !px-4 !py-2 !text-base">View</Link>
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
