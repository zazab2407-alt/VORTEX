import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import type { Order, OrderStatus } from '../types';
import { formatPrice } from '../utils/format';
import Img from './Img';
import StatusBadge from './StatusBadge';

const STEPS: OrderStatus[] = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Progress bar for the happy path, or a clear "cancelled" notice. */
export function OrderProgress({ status }: { status: OrderStatus }) {
  if (status === 'cancelled') return <p className="bg-neutral-100 px-4 py-3 text-sm font-semibold">This order was cancelled.</p>;
  const current = STEPS.indexOf(status);
  return (
    <ol className="flex items-start" aria-label="Order progress">
      {STEPS.map((s, i) => (
        <li key={s} className="relative flex flex-1 flex-col items-center text-center" aria-current={i === current ? 'step' : undefined}>
          {i > 0 && <span className={`absolute right-1/2 top-3.5 h-0.5 w-full ${i <= current ? 'bg-brand' : 'bg-neutral-200'}`} aria-hidden="true" />}
          <span className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold ${i < current ? 'border-brand bg-brand text-white' : i === current ? 'border-brand bg-white text-brand' : 'border-neutral-300 bg-white text-neutral-400'}`}>
            {i < current ? <Check size={14} /> : i + 1}
          </span>
          <span className={`mt-1.5 text-[11px] font-semibold uppercase tracking-wide sm:text-xs ${i <= current ? 'text-neutral-950' : 'text-neutral-400'}`}>{s}</span>
        </li>
      ))}
    </ol>
  );
}

interface Props { order: Order; onCancel?: () => void; cancelling?: boolean; compact?: boolean }

/** Everything about one order: status, items, totals, shipping and payment. Shared by confirmation, account and tracking pages. */
export default function OrderView({ order: o, onCancel, cancelling, compact }: Props) {
  return (
    <div className="space-y-8">
      {!compact && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-sm text-neutral-500">Order number</p><p className="font-display text-4xl font-extrabold tracking-wide">{o.orderNumber}</p><p className="text-sm text-neutral-500">Placed {when(o.createdAt)}</p></div>
          <StatusBadge status={o.status} />
        </div>
      )}
      <OrderProgress status={o.status} />

      <section aria-label="Items">
        <h2 className="mb-3 text-3xl font-extrabold">Items</h2>
        <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
          {o.items.map((i, idx) => (
            <li key={`${i.productId}-${i.size}-${i.color}-${idx}`} className="flex gap-4 py-4">
              <div className="h-24 w-20 shrink-0 overflow-hidden bg-neutral-100"><Img src={i.image} alt={i.name} className="h-full w-full object-cover" /></div>
              <div className="min-w-0 flex-1">
                {i.slug ? <Link to={`/product/${i.slug}`} className="font-semibold hover:text-brand">{i.name}</Link> : <p className="font-semibold">{i.name}</p>}
                <p className="text-sm text-neutral-500">{i.color} / {i.size}</p>
                <p className="text-sm text-neutral-500">{i.quantity} &times; {formatPrice(i.unitPrice)}</p>
              </div>
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
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <section aria-label="Shipping">
          <h2 className="mb-2 text-3xl font-extrabold">Shipping to</h2>
          <p className="font-semibold">{o.customer.fullName}</p>
          <p className="text-sm text-neutral-600">{o.shippingAddress.address}<br />{o.shippingAddress.city}</p>
          <p className="mt-2 text-sm text-neutral-600">{o.customer.phone}<br />{o.customer.email}</p>
          {o.shippingAddress.notes && <p className="mt-2 text-sm text-neutral-500">Note: {o.shippingAddress.notes}</p>}
        </section>
        <section aria-label="Payment">
          <h2 className="mb-2 text-3xl font-extrabold">Payment</h2>
          <p className="font-semibold">{o.paymentMethod === 'cod' ? 'Cash on Delivery' : o.paymentMethod}</p>
          <p className="text-sm text-neutral-600">{o.paymentStatus === 'paid' ? 'Paid' : o.status === 'cancelled' ? 'No payment due' : `Pay ${formatPrice(o.total)} in cash when your order arrives.`}</p>
        </section>
      </div>

      <section aria-label="History">
        <h2 className="mb-3 text-3xl font-extrabold">Order history</h2>
        <ol className="space-y-3 border-l-2 border-neutral-200 pl-5">
          {[...o.statusHistory].reverse().map((h, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full bg-brand" aria-hidden="true" />
              <p className="text-sm font-semibold capitalize">{h.status}</p>
              <p className="text-xs text-neutral-500">{when(h.at)}</p>
              {h.note && <p className="text-sm text-neutral-600">{h.note}</p>}
            </li>
          ))}
        </ol>
      </section>

      {onCancel && o.canCancel && (
        <div className="border-t border-neutral-200 pt-6">
          <button className="btn btn-outline !px-6 !py-3" onClick={onCancel} disabled={cancelling}>{cancelling ? 'Cancelling...' : 'Cancel order'}</button>
          <p className="mt-2 text-xs text-neutral-500">Orders can be cancelled until we start processing them.</p>
        </div>
      )}
    </div>
  );
}
