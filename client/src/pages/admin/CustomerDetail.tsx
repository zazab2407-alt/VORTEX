import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { adminService } from '../../services/admin';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../../context/ToastContext';
import { formatPrice } from '../../utils/format';
import ErrorState from '../../components/ErrorState';
import ConfirmDialog from '../../components/ConfirmDialog';
import StatusBadge from '../../components/StatusBadge';

const dateText = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default function CustomerDetail() {
  useDocumentTitle('Admin: customer');
  const { id = '' } = useParams();
  const { toast } = useToast();
  const { data, loading, error, reload } = useAsync((s) => adminService.customer(id, s), [id]);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const c = data?.customer;

  const toggle = async () => {
    if (!c || c.id !== id) return;
    setBusy(true);
    try {
      await adminService.setCustomerActive(c.id, !c.isActive);
      toast(c.isActive ? `${c.name} deactivated` : `${c.name} activated`);
      setConfirming(false);
      reload();
    } catch (err) {
      toast((err as Error).message, 'error');
      setConfirming(false);
    } finally { setBusy(false); }
  };

  return (
    <div>
      <Link to="/admin/customers" className="mb-4 inline-block text-sm text-neutral-600 hover:text-brand">&larr; Back to customers</Link>

      {loading && (!data || data.customer.id !== id) && <div className="space-y-4" aria-busy="true"><div className="h-10 w-72 animate-pulse bg-neutral-200" /><div className="h-48 animate-pulse bg-neutral-100" /></div>}

      {error && <ErrorState error={error} onRetry={reload} title={error.message === 'Customer not found' ? 'Customer not found' : 'We could not load this customer'} />}

      {!error && c && c.id === id && data && (
        <>
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-5xl font-extrabold">{c.name}</h1>
              <p className="mt-1 text-neutral-600">{c.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`inline-block px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${c.isActive ? 'bg-green-100 text-green-800' : 'bg-neutral-200 text-neutral-700'}`}>{c.isActive ? 'Active' : 'Deactivated'}</span>
              <button className={`btn !px-5 !py-2.5 ${c.isActive ? 'btn-outline' : 'btn-dark'}`} onClick={() => setConfirming(true)} disabled={busy}>
                {c.isActive ? 'Deactivate account' : 'Activate account'}
              </button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <section className="bg-white p-5" aria-labelledby="profile-heading">
              <h2 id="profile-heading" className="mb-4 text-3xl font-extrabold">Profile</h2>
              <dl className="grid grid-cols-[110px_1fr] gap-y-3 text-sm">
                <dt className="text-neutral-500">Phone</dt><dd>{c.phone || '—'}</dd>
                <dt className="text-neutral-500">Address</dt><dd>{c.address || '—'}</dd>
                <dt className="text-neutral-500">City</dt><dd>{c.city || '—'}</dd>
                <dt className="text-neutral-500">Joined</dt><dd>{dateText(c.createdAt)}</dd>
              </dl>
            </section>

            <section className="bg-white p-5" aria-labelledby="stats-heading">
              <h2 id="stats-heading" className="mb-4 text-3xl font-extrabold">Activity</h2>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div><dt className="text-xs uppercase tracking-wider text-neutral-500">Orders</dt><dd className="mt-1 text-3xl font-extrabold">{c.orderCount}</dd></div>
                <div><dt className="text-xs uppercase tracking-wider text-neutral-500">Total spent</dt><dd className="mt-1 text-3xl font-extrabold">{formatPrice(c.totalSpent)}</dd></div>
                <div><dt className="text-xs uppercase tracking-wider text-neutral-500">Last order</dt><dd className="mt-1 text-lg font-bold">{c.lastOrderAt ? dateText(c.lastOrderAt) : 'None'}</dd></div>
              </dl>
              <p className="mt-4 text-xs text-neutral-500">Total spent leaves out cancelled orders.</p>
            </section>
          </div>

          <section className="mt-6 bg-white" aria-labelledby="orders-heading">
            <h2 id="orders-heading" className="border-b border-neutral-200 p-5 text-3xl font-extrabold">Order history</h2>
            {!data.orders.length ? <p className="p-10 text-center text-neutral-500">This customer has not placed any orders.</p> : (
              <ul className="divide-y divide-neutral-200">
                {data.orders.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                    <div className="min-w-0 flex-1 basis-44">
                      <Link to={`/admin/orders/${o.id}`} className="font-semibold hover:text-brand">{o.orderNumber}</Link>
                      <p className="text-xs text-neutral-500">{dateText(o.createdAt)} &middot; {o.itemCount} {o.itemCount === 1 ? 'item' : 'items'}</p>
                    </div>
                    <div className="w-28"><StatusBadge status={o.status} /></div>
                    <p className="w-24 font-bold">{formatPrice(o.total)}</p>
                  </li>
                ))}
              </ul>
            )}
            {data.ordersTotal > data.ordersShown && (
              <p className="border-t border-neutral-200 p-4 text-sm text-neutral-500">Showing the {data.ordersShown} most recent of {data.ordersTotal} orders. Open an order to see its details.</p>
            )}
          </section>
        </>
      )}

      <ConfirmDialog
        open={confirming && !!c && c.id === id}
        title={c?.isActive ? 'Deactivate this account?' : 'Activate this account?'}
        message={c?.isActive
          ? `${c?.name} will no longer be able to use this account until it is activated again. Their existing orders are not changed.`
          : `${c?.name} will be able to log in again.`}
        confirmLabel={c?.isActive ? 'Deactivate' : 'Activate'}
        busy={busy}
        onConfirm={toggle}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
