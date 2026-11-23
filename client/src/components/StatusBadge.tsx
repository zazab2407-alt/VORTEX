import type { OrderStatus } from '../types';

const STYLES: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-800', confirmed: 'bg-sky-100 text-sky-800', processing: 'bg-indigo-100 text-indigo-800',
  shipped: 'bg-violet-100 text-violet-800', delivered: 'bg-green-100 text-green-800', cancelled: 'bg-neutral-200 text-neutral-700',
};
export default function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`inline-block px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${STYLES[status] ?? 'bg-neutral-100'}`}>{status}</span>;
}
