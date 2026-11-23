import { Link, useLocation, useParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { lastOrder, orderService } from '../services/shop';
import type { Order } from '../types';
import OrderView from '../components/OrderView';
import ErrorState from '../components/ErrorState';
import { PageSpinner } from '../components/RouteGuards';

const STEPS = [
  ['We confirm your order', 'You will get a call or message on the phone number you gave us if we need anything.'],
  ['We prepare and ship it', 'Your items are packed and handed to the courier.'],
  ['You pay on delivery', 'Pay the courier in cash when your order arrives.'],
];

export default function OrderConfirmation() {
  useDocumentTitle('Order confirmed');
  const { orderNumber = '' } = useParams();
  const nav = (useLocation().state ?? null) as { order?: Order; emailSent?: boolean } | null;
  const { user, loading: authLoading } = useAuth();
  const known = nav?.order?.orderNumber === orderNumber ? { order: nav.order, emailSent: !!nav.emailSent } : lastOrder.read(orderNumber);

  // After a page reload the browser still remembers the order; otherwise only the signed-in owner can load it
  const fetched = useAsync((s) => (known || !user ? Promise.resolve(null) : orderService.get(orderNumber, s)), [orderNumber, user?.id, !!known]);
  const order = known?.order ?? fetched.data;
  const trackHref = user ? `/orders/${orderNumber}` : `/track-order?order=${encodeURIComponent(orderNumber)}`;

  if (!known && (authLoading || fetched.loading)) return <PageSpinner />;
  if (!order) {
    return fetched.error && user ? <div className="container-x"><ErrorState error={fetched.error} onRetry={fetched.reload} /></div> : (
      <div className="container-x py-20 text-center">
        <h1 className="text-5xl font-extrabold">Order {orderNumber}</h1>
        <p className="mx-auto mt-3 max-w-md text-neutral-500">For your privacy we only show an order's details to the person who placed it. Enter your order number and email to see it.</p>
        <Link to={trackHref} className="btn btn-primary mt-8">Track this order</Link>
      </div>
    );
  }

  return (
    <div className="container-x py-8 lg:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-col items-center text-center">
          <CheckCircle2 size={64} className="text-brand" />
          <p className="mt-4 font-display text-lg font-bold uppercase tracking-[0.25em] text-brand">Order placed</p>
          <h1 className="text-5xl font-extrabold sm:text-6xl">Thank you, {order.customer.fullName.split(' ')[0]}!</h1>
          <p className="mt-4 text-sm text-neutral-500">Your order number</p>
          <p className="font-display text-5xl font-extrabold tracking-wide" data-testid="order-number">{order.orderNumber}</p>
          <p className="mt-2 max-w-md text-sm text-neutral-600">Save this number. With the email you used at checkout, it lets you track your order any time.</p>
          {known?.emailSent && <p className="mt-3 bg-green-50 px-4 py-2 text-sm font-semibold text-green-800">A confirmation email was sent to {order.customer.email}.</p>}
        </div>

        <section className="my-10 bg-neutral-100 p-6" aria-labelledby="next">
          <h2 id="next" className="mb-4 text-3xl font-extrabold">What happens next</h2>
          <ol className="space-y-4">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="flex gap-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand font-display text-lg font-bold text-white">{i + 1}</span><div><p className="font-semibold">{title}</p><p className="text-sm text-neutral-600">{text}</p></div></li>
            ))}
          </ol>
        </section>

        <OrderView order={order} compact />

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link to={trackHref} className="btn btn-dark">Track this order</Link>
          <Link to="/shop" className="btn btn-outline">Continue shopping</Link>
        </div>
      </div>
    </div>
  );
}
