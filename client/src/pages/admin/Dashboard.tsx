import { Link } from 'react-router-dom';
import { AlertTriangle, DollarSign, Package, ShoppingBag, Users } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import { adminService } from '../../services/admin';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatPrice } from '../../utils/format';
import ErrorState from '../../components/ErrorState';
import Img from '../../components/Img';

export default function Dashboard() {
  useDocumentTitle('Admin dashboard');
  const { data, loading, error, reload } = useAsync((s) => adminService.stats(s), []);
  if (error) return <ErrorState error={error} onRetry={reload} title="We could not load the dashboard" />;

  const cards = data ? [
    { label: 'Total orders', value: String(data.totals.orders), icon: ShoppingBag },
    { label: 'Revenue', value: formatPrice(data.totals.revenue), icon: DollarSign },
    { label: 'Products', value: String(data.totals.products), icon: Package },
    { label: 'Customers', value: String(data.totals.customers), icon: Users },
  ] : [];

  return (
    <div>
      <h1 className="mb-6 text-5xl font-extrabold">Dashboard</h1>
      {data && data.totals.pendingOrders > 0 && (
        <Link to="/admin/orders?status=pending" className="mb-5 flex items-center justify-between bg-brand px-5 py-4 text-white transition-colors hover:bg-brand-dark">
          <span className="font-semibold">{data.totals.pendingOrders} {data.totals.pendingOrders === 1 ? 'order is' : 'orders are'} waiting to be confirmed</span><span className="font-display text-lg font-bold uppercase tracking-wider">Review &rarr;</span>
        </Link>
      )}
      <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
        {loading ? [0, 1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse bg-white" />) : cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white p-5">
            <div className="flex items-center justify-between text-neutral-500"><span className="text-sm font-semibold uppercase tracking-wider">{label}</span><Icon size={20} className="text-brand" /></div>
            <p className="mt-3 truncate font-display text-4xl font-extrabold sm:text-5xl">{value}</p>
          </div>
        ))}
      </div>

      {data && data.lowStock.total > 0 && (
        <section className="mt-8 bg-white p-5" aria-labelledby="low">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 id="low" className="flex items-center gap-2 text-3xl font-extrabold"><AlertTriangle size={22} className="text-amber-600" /> Low stock</h2>
            <p className="text-sm text-neutral-500">{data.lowStock.total} {data.lowStock.total === 1 ? 'variant has' : 'variants have'} {data.lowStock.threshold} or fewer in stock</p>
          </div>
          <ul className="grid gap-x-8 sm:grid-cols-2">
            {data.lowStock.items.map((i) => (
              <li key={`${i.id}-${i.size}-${i.color}`} className="flex items-center justify-between gap-3 border-t border-neutral-100 py-2.5 text-sm">
                <Link to={`/admin/products/${i.id}`} className="min-w-0 truncate font-semibold hover:text-brand">{i.name} <span className="font-normal text-neutral-500">{i.color} / {i.size}</span></Link>
                <span className={`shrink-0 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${i.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>{i.stock === 0 ? 'Out of stock' : `${i.stock} left`}</span>
              </li>
            ))}
          </ul>
          {data.lowStock.total > data.lowStock.items.length && <p className="mt-3 text-xs text-neutral-500">Showing the {data.lowStock.items.length} lowest. Open Products to see everything.</p>}
        </section>
      )}

      <div className="mt-8 grid gap-5 xl:grid-cols-5">
        <section className="bg-white p-5 xl:col-span-3" aria-labelledby="recent">
          <h2 id="recent" className="mb-4 text-3xl font-extrabold">Recent orders</h2>
          {loading ? <div className="h-40 animate-pulse bg-neutral-100" /> : !data?.recentOrders.length ? (
            <p className="py-8 text-center text-sm text-neutral-500">No orders yet. They will appear here once customers check out.</p>
          ) : (
            <ul className="divide-y divide-neutral-200">
              {data.recentOrders.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div><Link to={`/admin/orders/${o.id}`} className="font-semibold hover:text-brand">{o.orderNumber}</Link><p className="text-neutral-500">{o.customerName} &middot; {new Date(o.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p></div>
                  <StatusBadge status={o.status} />
                  <span className="font-bold">{formatPrice(o.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white p-5 xl:col-span-2" aria-labelledby="best">
          <h2 id="best" className="mb-4 text-3xl font-extrabold">Best sellers</h2>
          {loading ? <div className="h-40 animate-pulse bg-neutral-100" /> : !data?.bestSellers.length ? (
            <p className="py-8 text-center text-sm text-neutral-500">No sales yet.</p>
          ) : (
            <ol className="divide-y divide-neutral-200">
              {data.bestSellers.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  <span className="w-5 font-display text-xl font-bold text-neutral-400">{i + 1}</span>
                  <Img src={p.image} alt="" className="h-12 w-10 shrink-0 object-cover" />
                  <Link to={`/product/${p.slug}`} className="min-w-0 flex-1 truncate text-sm font-semibold hover:text-brand">{p.name}</Link>
                  <span className="text-sm text-neutral-500">{p.sold} sold</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
