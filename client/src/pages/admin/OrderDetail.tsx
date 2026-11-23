import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { adminService } from '../../services/admin';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../../context/ToastContext';
import { ApiClientError } from '../../services/http';
import { formatPrice } from '../../utils/format';
import type { Order, OrderStatus } from '../../types';
import ErrorState from '../../components/ErrorState';
import ConfirmDialog from '../../components/ConfirmDialog';
import StatusBadge from '../../components/StatusBadge';
import Img from '../../components/Img';
import { OrderProgress } from '../../components/OrderView';

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const EMAIL_NOTE = { not_configured: 'No confirmation email was sent (email is not configured).', sent: 'Confirmation email sent to the customer.', failed: 'Confirmation email could not be sent.' } as const;
const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => <section className="bg-white p-5"><h2 className="mb-3 text-3xl font-extrabold">{title}</h2>{children}</section>;

export default function OrderDetail() {
  const { id = '' } = useParams();
  useDocumentTitle('Admin: order');
  const { toast } = useToast();
  const { data, loading, error, reload } = useAsync((s) => adminService.order(id, s), [id]);
  const [updated, setUpdated] = useState<Order | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const o = updated ?? data;

  const move = async (status: OrderStatus) => {
    setBusy(true);
    try { setUpdated(await adminService.updateOrderStatus(id, status, note.trim() || undefined)); setNote(''); toast(status === 'cancelled' ? 'Order cancelled and stock returned' : `Order marked as ${status}`); }
    catch (e) { toast((e as Error).message, 'error'); setUpdated(null); reload(); } finally { setBusy(false); setConfirmCancel(false); }
  };

  if (loading) return <div className="space-y-4">{[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse bg-white" />)}</div>;
  if (error) return error instanceof ApiClientError && error.status === 404
    ? <p className="py-20 text-center text-neutral-500">Order not found. <Link to="/admin/orders" className="font-semibold text-brand underline">Back to orders</Link></p>
    : <ErrorState error={error} onRetry={reload} title="We could not load this order" />;
  if (!o) return null;
  const forward = (o.nextStatuses ?? []).filter((s) => s !== 'cancelled');
  const canCancel = (o.nextStatuses ?? []).includes('cancelled');

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <Link to="/admin/orders" className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-600 hover:text-brand"><ArrowLeft size={16} /> Orders</Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h1 className="font-display text-5xl font-extrabold tracking-wide">{o.orderNumber}</h1><p className="text-sm text-neutral-500">Placed {when(o.createdAt)} &middot; {o.isGuest ? 'Guest checkout' : 'Customer account'}</p></div>
          <StatusBadge status={o.status} />
        </div>
      </div>

      <section className="bg-white p-5"><OrderProgress status={o.status} /></section>

      {(forward.length > 0 || canCancel) && (
        <Panel title="Update status">
          <label htmlFor="note" className="mb-1.5 block text-sm font-semibold">Internal note (optional, shown in the history)</label>
          <input id="note" className="input mb-4 max-w-xl" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="e.g. Courier: Aramex, tracking 123" />
          <div className="flex flex-wrap gap-3">
            {forward.map((s) => <button key={s} className="btn btn-primary !px-6 !py-3" disabled={busy} onClick={() => move(s)}>Mark as {s}</button>)}
            {canCancel && <button className="btn btn-outline !px-6 !py-3 hover:!border-red-600 hover:!bg-red-600" disabled={busy} onClick={() => setConfirmCancel(true)}>Cancel order</button>}
          </div>
        </Panel>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Panel title="Customer">
          <p className="font-semibold">{o.customer.fullName}</p>
          <p className="text-sm text-neutral-600">{o.customer.email}<br />{o.customer.phone}</p>
        </Panel>
        <Panel title="Shipping address">
          <p className="text-sm text-neutral-700">{o.shippingAddress.address}<br />{o.shippingAddress.city}</p>
          {o.shippingAddress.notes && <p className="mt-2 bg-neutral-100 p-3 text-sm"><strong>Customer note:</strong> {o.shippingAddress.notes}</p>}
        </Panel>
      </div>

      <Panel title="Items">
        <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
          {o.items.map((i, idx) => (
            <li key={idx} className="flex gap-4 py-3">
              <div className="h-20 w-16 shrink-0 overflow-hidden bg-neutral-100"><Img src={i.image} alt={i.name} className="h-full w-full object-cover" /></div>
              <div className="min-w-0 flex-1 text-sm"><p className="font-semibold">{i.name}</p><p className="text-neutral-500">{i.color} / {i.size}</p><p className="text-neutral-500">{i.quantity} &times; {formatPrice(i.unitPrice)}</p></div>
              <p className="font-bold">{formatPrice(i.lineTotal)}</p>
            </li>
          ))}
        </ul>
        <dl className="ml-auto mt-4 max-w-xs space-y-2 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPrice(o.subtotal)}</dd></div>
          {o.discount > 0 && <div className="flex justify-between text-green-700"><dt>Discount{o.couponCode ? ` (${o.couponCode})` : ''}</dt><dd>-{formatPrice(o.discount)}</dd></div>}
          <div className="flex justify-between"><dt>Shipping</dt><dd>{o.shippingCost === 0 ? 'Free' : formatPrice(o.shippingCost)}</dd></div>
          <div className="flex justify-between border-t border-neutral-300 pt-3 text-lg font-bold"><dt>Total</dt><dd>{formatPrice(o.total)}</dd></div>
        </dl>
      </Panel>

      <div className="grid gap-5 md:grid-cols-2">
        <Panel title="Payment">
          <p className="font-semibold">{o.paymentMethod === 'cod' ? 'Cash on Delivery' : o.paymentMethod}</p>
          <p className="text-sm text-neutral-600">Status: <strong className="capitalize">{o.paymentStatus}</strong></p>
          {o.confirmationEmail && <p className="mt-3 text-xs text-neutral-500">{EMAIL_NOTE[o.confirmationEmail as keyof typeof EMAIL_NOTE]}</p>}
          {o.status === 'cancelled' && <p className={`mt-3 text-xs font-semibold ${o.stockRestoredAt ? 'text-green-700' : 'text-red-600'}`}>{o.stockRestoredAt ? 'Stock returned to inventory.' : 'Stock was NOT fully returned. Please check the inventory.'}</p>}
        </Panel>
        <Panel title="History">
          <ol className="space-y-3 border-l-2 border-neutral-200 pl-5">
            {[...o.statusHistory].reverse().map((h, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full bg-brand" aria-hidden="true" />
                <p className="text-sm font-semibold capitalize">{h.status}{h.by && <span className="ml-2 font-normal text-neutral-500">by {h.by}</span>}</p>
                <p className="text-xs text-neutral-500">{when(h.at)}</p>
                {h.note && <p className="text-sm text-neutral-600">{h.note}</p>}
              </li>
            ))}
          </ol>
        </Panel>
      </div>
      <ConfirmDialog open={confirmCancel} title="Cancel this order?" message="The customer's items go back into stock and any coupon use is given back. This cannot be undone." confirmLabel="Cancel order" busy={busy} onConfirm={() => move('cancelled')} onCancel={() => setConfirmCancel(false)} />
    </div>
  );
}
