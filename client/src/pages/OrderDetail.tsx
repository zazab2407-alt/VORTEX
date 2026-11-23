import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToast } from '../context/ToastContext';
import { orderService } from '../services/shop';
import { ApiClientError } from '../services/http';
import type { Order } from '../types';
import OrderView from '../components/OrderView';
import StatusBadge from '../components/StatusBadge';
import ErrorState from '../components/ErrorState';
import ConfirmDialog from '../components/ConfirmDialog';

export default function OrderDetail() {
  const { orderNumber = '' } = useParams();
  useDocumentTitle(`Order ${orderNumber}`);
  const { toast } = useToast();
  const { data, loading, error, reload } = useAsync((s) => orderService.get(orderNumber, s), [orderNumber]);
  const [updated, setUpdated] = useState<Order | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const order = updated ?? data;

  const cancel = async () => {
    setBusy(true);
    try { setUpdated(await orderService.cancel(orderNumber)); toast('Your order has been cancelled'); }
    catch (e) { toast((e as Error).message, 'error'); reload(); } finally { setBusy(false); setConfirm(false); }
  };

  return (
    <div className="container-x py-8 lg:py-12">
      <Link to="/account" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-600 hover:text-brand"><ArrowLeft size={16} /> My orders</Link>
      {loading ? <div className="space-y-4">{[0, 1, 2].map((i) => <div key={i} className="h-32 animate-pulse bg-neutral-100" />)}</div>
        : error ? (error instanceof ApiClientError && error.status === 404
          ? <div className="py-16 text-center"><h1 className="text-5xl font-extrabold">Order not found</h1><p className="mt-2 text-neutral-500">We could not find that order in your account.</p><Link to="/account" className="btn btn-dark mt-6">Back to my orders</Link></div>
          : <ErrorState error={error} onRetry={reload} />)
        : order && (
          <div className="max-w-3xl">
            <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-sm text-neutral-500">Order</p><h1 className="font-display text-5xl font-extrabold tracking-wide">{order.orderNumber}</h1><p className="text-sm text-neutral-500">Placed {new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
              <StatusBadge status={order.status} />
            </div>
            <OrderView order={order} compact onCancel={() => setConfirm(true)} cancelling={busy} />
          </div>
        )}
      <ConfirmDialog open={confirm} title="Cancel this order?" message="Your items will go back into stock and you will not be charged. This cannot be undone." confirmLabel="Cancel order" busy={busy} onConfirm={cancel} onCancel={() => setConfirm(false)} />
    </div>
  );
}
