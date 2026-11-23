import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToast } from '../context/ToastContext';
import { orderService } from '../services/shop';
import type { Order } from '../types';
import Field from '../components/Field';
import OrderView from '../components/OrderView';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';

/** Guests (and anyone else) can follow an order with the order number plus the email used at checkout. */
export default function TrackOrder() {
  useDocumentTitle('Track your order');
  const { toast } = useToast();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ orderNumber: params.get('order') ?? '', email: '' });
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try { setOrder(await orderService.lookup(form.orderNumber.trim().toUpperCase(), form.email.trim())); }
    catch (err) { setOrder(null); setError((err as Error).message); } finally { setBusy(false); }
  };
  const cancel = async () => {
    if (!order) return;
    setBusy(true);
    try { setOrder(await orderService.cancelLookup(order.orderNumber, form.email.trim())); toast('Your order has been cancelled'); }
    catch (err) { toast((err as Error).message, 'error'); } finally { setBusy(false); setConfirm(false); }
  };

  return (
    <div className="container-x py-10 lg:py-16">
      <div className={`mx-auto ${order ? 'max-w-3xl' : 'max-w-md'}`}>
        <p className="font-display text-lg font-bold uppercase tracking-[0.25em] text-brand">Where is my order?</p>
        <h1 className="mb-6 text-5xl font-extrabold">Track order</h1>
        {!order ? (
          <form onSubmit={submit} className="space-y-5" noValidate>
            {error && <div role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            <Field label="Order number" placeholder="VTX-261111-ABCD2345" value={form.orderNumber} onChange={(e) => setForm({ ...form, orderNumber: e.target.value })} autoComplete="off" required />
            <Field label="Email used at checkout" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" required />
            <button className="btn btn-primary w-full" disabled={busy || !form.orderNumber || !form.email}>{busy ? 'Looking...' : 'Track order'}</button>
          </form>
        ) : (
          <div>
            <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-sm text-neutral-500">Order</p><p className="font-display text-4xl font-extrabold tracking-wide">{order.orderNumber}</p></div>
              <StatusBadge status={order.status} />
            </div>
            <OrderView order={order} compact onCancel={() => setConfirm(true)} cancelling={busy} />
            <button className="mt-8 text-sm font-semibold underline underline-offset-4" onClick={() => { setOrder(null); setError(null); }}>Track another order</button>
          </div>
        )}
      </div>
      <ConfirmDialog open={confirm} title="Cancel this order?" message="Your items will go back into stock and you will not be charged. This cannot be undone." confirmLabel="Cancel order" busy={busy} onConfirm={cancel} onCancel={() => setConfirm(false)} />
    </div>
  );
}
