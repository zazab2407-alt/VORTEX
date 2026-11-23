import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AlertTriangle, Banknote, CreditCard, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { useCartQuote } from '../hooks/useCartQuote';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { ApiClientError } from '../services/http';
import { ACCOUNT_DEACTIVATED_MESSAGE } from '../services/auth';
import { lastOrder, orderService } from '../services/shop';
import { formatPrice } from '../utils/format';
import Field from '../components/Field';
import Img from '../components/Img';
import ErrorState from '../components/ErrorState';

const PHONE = /^[0-9+()\-\s.]{6,30}$/;
type Form = { fullName: string; email: string; phone: string; city: string; address: string; notes: string };
const FIELD_MAP: Record<string, keyof Form> = { 'customer.fullName': 'fullName', 'customer.email': 'email', 'customer.phone': 'phone', 'shippingAddress.city': 'city', 'shippingAddress.address': 'address', 'shippingAddress.notes': 'notes' };

/** Same rules the server enforces; the server checks them again, so these are only for instant feedback. */
function validate(f: Form) {
  const e: Partial<Record<keyof Form, string>> = {};
  if (f.fullName.trim().length < 2) e.fullName = 'Please enter your full name';
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'Please enter a valid email address';
  if (!PHONE.test(f.phone.trim()) || (f.phone.match(/\d/g) ?? []).length < 6) e.phone = 'Please enter a valid phone number';
  if (f.city.trim().length < 2) e.city = 'Please enter your city';
  if (f.address.trim().length < 5) e.address = 'Please enter your full shipping address';
  if (f.notes.length > 500) e.notes = 'Notes are too long (max 500 characters)';
  return e;
}

/** One key per checkout visit: a retry or double click can only ever create a single order. */
const newKey = () => `co_${Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('')}`;

export default function Checkout() {
  useDocumentTitle('Checkout');
  const { items, couponCode, clear } = useCart();
  const { user, refreshSession } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { quote, loading, error, reload } = useCartQuote();

  const [form, setForm] = useState<Form>({ fullName: '', email: '', phone: '', city: '', address: '', notes: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [issues, setIssues] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);   // blocks a second click before React re-renders
  const done = useRef(false);       // set once the order exists, so emptying the cart does not bounce us to /cart
  const key = useRef(newKey());
  const prefilled = useRef(false);

  // Logged-in customers: fill in what we already know (never overwrites anything they typed)
  useEffect(() => {
    if (!user || prefilled.current) return;
    prefilled.current = true;
    setForm((f) => ({ ...f, fullName: f.fullName || user.name, email: f.email || user.email, phone: f.phone || user.phone, city: f.city || user.city, address: f.address || user.address }));
  }, [user]);

  if (items.length === 0 && !done.current) return <Navigate to="/cart" replace />;

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); };
  const blocked = !quote || quote.hasIssues || !!error;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return;
    const errs = validate(form);
    setErrors(errs); setIssues([]);
    if (Object.keys(errs).length) {
      toast('Please check the highlighted fields', 'error');
      document.getElementById(`co-${Object.keys(errs)[0]}`)?.focus();
      return;
    }
    if (blocked) return;

    inFlight.current = true; setSubmitting(true);
    try {
      const res = await orderService.create({
        items: items.map(({ productId, size, color, quantity }) => ({ productId, size, color, quantity })), couponCode,
        customer: { fullName: form.fullName.trim(), email: form.email.trim(), phone: form.phone.trim() },
        shippingAddress: { address: form.address.trim(), city: form.city.trim(), ...(form.notes.trim() && { notes: form.notes.trim() }) },
        paymentMethod: 'cod', idempotencyKey: key.current,
      });
      done.current = true;
      lastOrder.save(res.order, res.emailSent);
      clear();
      navigate(`/order-confirmation/${res.order.orderNumber}`, { replace: true, state: { order: res.order, emailSent: res.emailSent } });
    } catch (err) {
      const fe = err instanceof ApiClientError ? err.fieldErrors : undefined;
      if (err instanceof ApiClientError && err.status === 403 && err.message === ACCOUNT_DEACTIVATED_MESSAGE) {
        // The server has cleared the stale login cookie. Refresh so the page shows the guest state, which matches it. Form values are kept.
        await refreshSession();
        toast(err.message, 'error');
      } else if (err instanceof ApiClientError && err.status === 409) {
        setIssues(fe?.length ? fe.map((x) => x.message) : [err.message]);
        reload(); // refresh prices and stock so the cart shows what is really available
      } else if (fe?.length) {
        const mapped: Partial<Record<keyof Form, string>> = {};
        fe.forEach((x) => { const k = FIELD_MAP[x.field]; if (k) mapped[k] = x.message; });
        setErrors(mapped);
        if (!Object.keys(mapped).length) toast((err as Error).message, 'error');
      } else toast((err as Error).message, 'error');
      inFlight.current = false; setSubmitting(false);
    }
  };

  const lines = quote?.lines ?? [];
  return (
    <div className="container-x py-8 lg:py-12">
      <h1 className="mb-8 text-5xl font-extrabold sm:text-6xl">Checkout</h1>
      <form onSubmit={submit} noValidate className="grid gap-10 lg:grid-cols-[1fr_420px]">
        <div className="space-y-10">
          {issues.length > 0 && (
            <div role="alert" className="border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p className="flex items-center gap-2 font-semibold"><AlertTriangle size={18} /> Some items changed while you were checking out</p>
              <ul className="mt-2 list-disc pl-6">{issues.map((m, i) => <li key={i}>{m}</li>)}</ul>
              <Link to="/cart" className="mt-3 inline-block font-semibold underline underline-offset-4">Review your cart</Link>
            </div>
          )}

          <section aria-labelledby="contact">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="contact" className="text-3xl font-extrabold">Contact</h2>
              <p className="text-sm text-neutral-500">{user ? <>Signed in as <strong>{user.email}</strong></> : <>Checking out as a guest. <Link to="/login?next=/checkout" className="font-semibold text-brand underline underline-offset-4">Log in</Link> to use your saved details.</>}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><Field id="co-fullName" label="Full name" autoComplete="name" value={form.fullName} onChange={set('fullName')} error={errors.fullName} maxLength={100} /></div>
              <Field id="co-email" label="Email" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} hint="Used to track your order." />
              <Field id="co-phone" label="Phone number" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} error={errors.phone} hint="The courier will call this number." />
            </div>
          </section>

          <section aria-labelledby="shipping">
            <h2 id="shipping" className="mb-4 text-3xl font-extrabold">Shipping address</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="co-city" label="City" autoComplete="address-level2" value={form.city} onChange={set('city')} error={errors.city} maxLength={80} />
              <div className="sm:col-span-2"><Field id="co-address" label="Full address" autoComplete="street-address" value={form.address} onChange={set('address')} error={errors.address} maxLength={300} hint="Street, building, floor and apartment." /></div>
              <div className="sm:col-span-2"><Field id="co-notes" multiline label="Order notes (optional)" rows={3} value={form.notes} onChange={set('notes')} error={errors.notes} maxLength={500} /></div>
            </div>
          </section>

          <section aria-labelledby="payment">
            <h2 id="payment" className="mb-4 text-3xl font-extrabold">Payment</h2>
            <div className="space-y-3">
              <label className="flex cursor-pointer items-start gap-3 border-2 border-neutral-950 p-4">
                <input type="radio" name="payment" value="cod" checked readOnly className="mt-1 accent-[#FF5A1F]" />
                <span><span className="flex items-center gap-2 font-semibold"><Banknote size={18} /> Cash on Delivery</span><span className="block text-sm text-neutral-600">Pay in cash when your order arrives.</span></span>
              </label>
              <label className="flex items-start gap-3 border border-neutral-200 p-4 opacity-60">
                <input type="radio" name="payment" value="online" disabled className="mt-1" />
                <span><span className="flex items-center gap-2 font-semibold"><CreditCard size={18} /> Online payment</span><span className="block text-sm text-neutral-600">Not available yet.</span></span>
              </label>
            </div>
          </section>
        </div>

        <aside className="h-fit bg-neutral-100 p-6 lg:sticky lg:top-28" aria-labelledby="summary">
          <h2 id="summary" className="mb-5 text-3xl font-extrabold">Order summary</h2>
          {error && <ErrorState error={error} onRetry={reload} compact title="We could not check your cart" />}
          <ul className="divide-y divide-neutral-300">
            {(lines.length ? lines : items.map((i) => ({ productId: i.productId, size: i.size, color: i.color, quantity: i.quantity, name: i.name, image: i.image, unitPrice: i.unitPrice, lineTotal: i.unitPrice * i.quantity, status: 'ok' as const, available: i.maxStock }))).map((l) => (
              <li key={`${l.productId}-${l.size}-${l.color}`} className="flex gap-3 py-3">
                <div className="h-16 w-14 shrink-0 overflow-hidden bg-neutral-200"><Img src={l.image} alt={l.name} className="h-full w-full object-cover" /></div>
                <div className="min-w-0 flex-1 text-sm"><p className="truncate font-semibold">{l.name}</p><p className="text-neutral-500">{l.color} / {l.size} &times; {l.quantity}</p>{l.status !== 'ok' && <p className="font-semibold text-red-600">{l.message}</p>}</div>
                <p className="text-sm font-bold">{formatPrice(l.lineTotal ?? 0)}</p>
              </li>
            ))}
          </ul>
          <dl className={`mt-4 space-y-2 border-t border-neutral-300 pt-4 text-sm transition-opacity ${loading ? 'opacity-60' : ''}`}>
            <div className="flex justify-between"><dt>Subtotal</dt><dd className="font-semibold">{quote ? formatPrice(quote.subtotal) : '-'}</dd></div>
            {quote && quote.discount > 0 && <div className="flex justify-between text-green-700"><dt>Discount ({couponCode})</dt><dd className="font-semibold">-{formatPrice(quote.discount)}</dd></div>}
            <div className="flex justify-between"><dt>Shipping</dt><dd className="font-semibold">{quote ? (quote.shipping === 0 ? 'Free' : formatPrice(quote.shipping)) : '-'}</dd></div>
            <div className="flex justify-between border-t border-neutral-300 pt-3 text-xl font-bold"><dt>Total</dt><dd>{quote ? formatPrice(quote.total) : '-'}</dd></div>
          </dl>
          <button className="btn btn-primary mt-6 w-full" disabled={submitting || blocked}>{submitting ? 'Placing your order...' : <><Lock size={16} /> Place order{quote ? ` · ${formatPrice(quote.total)}` : ''}</>}</button>
          {quote?.hasIssues && <p className="mt-2 text-center text-xs text-red-600">Some items are unavailable. <Link to="/cart" className="underline">Review your cart</Link>.</p>}
          <p className="mt-3 text-center text-xs text-neutral-500">You pay the courier in cash on delivery. <Link to="/cart" className="underline">Edit cart</Link></p>
        </aside>
      </form>
    </div>
  );
}
