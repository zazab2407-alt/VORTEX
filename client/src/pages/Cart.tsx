import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Tag, Trash2, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useCartQuote } from '../hooks/useCartQuote';
import { cartService } from '../services/shop';
import { formatPrice } from '../utils/format';
import Img from '../components/Img';
import QuantitySelector from '../components/QuantitySelector';
import ErrorState from '../components/ErrorState';

const sel = 'border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-neutral-950';

export default function Cart() {
  useDocumentTitle('Your Cart');
  const c = useCart();
  const { toast } = useToast();
  const { quote, loading, error, reload } = useCartQuote();
  const [code, setCode] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const lineFor = (key: string) => quote?.lines.find((l) => `${l.productId}|${l.size}|${l.color}` === key);
  const unavailable = c.items.filter((i) => { const q = lineFor(i.key); return q && (q.status === 'unavailable' || q.status === 'out_of_stock'); });
  const blocked = !quote || quote.hasIssues || !!error;

  /** The code is checked by the server; it is only kept when the server says it is valid for this cart. */
  const apply = async (e: FormEvent) => {
    e.preventDefault();
    const value = code.trim();
    if (!value) return setCouponError('Enter a discount code');
    setApplying(true); setCouponError(null);
    try {
      const q = await cartService.quote(c.items, value);
      if (q.coupon?.valid) { c.setCoupon(q.coupon.code); toast(`Coupon ${q.coupon.code} applied`); setCode(''); }
      else setCouponError(q.coupon?.error ?? 'This coupon code is not valid');
    } catch (err) { setCouponError((err as Error).message); } finally { setApplying(false); }
  };

  if (c.items.length === 0) {
    return (
      <div className="container-x flex flex-col items-center py-24 text-center">
        <ShoppingBag size={72} className="text-neutral-300" />
        <h1 className="mt-5 text-5xl font-extrabold">Your cart is empty</h1>
        <p className="mt-2 text-neutral-500">Looks like you have not added anything yet.</p>
        <Link to="/shop" className="btn btn-primary mt-8">Start Shopping</Link>
      </div>
    );
  }

  return (
    <div className="container-x py-8 lg:py-12">
      <h1 className="mb-8 text-5xl font-extrabold sm:text-6xl">Your cart</h1>
      {error && <div className="mb-6 border border-red-200 bg-red-50"><ErrorState error={error} onRetry={reload} compact title="We could not check your cart" /></div>}
      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        <div>
          <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
            {c.items.map((i) => {
              const q = lineFor(i.key);
              const bad = q && q.status !== 'ok';
              const o = q?.options;
              const stockOf = (s: string, col: string) => o?.stock[`${s}|${col}`] ?? 0;
              return (
                <li key={i.key} className="flex gap-4 py-5 sm:gap-6">
                  <Link to={`/product/${i.slug}`} className="h-32 w-28 shrink-0 overflow-hidden bg-neutral-100 sm:h-40 sm:w-32">
                    <Img src={q?.image ?? i.image} alt={i.name} className="h-full w-full object-cover" />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <Link to={`/product/${i.slug}`} className="text-lg font-semibold hover:text-brand">{i.name}</Link>
                        {o ? (
                          <div className="mt-1 flex flex-wrap gap-2">
                            <label className="sr-only" htmlFor={`size-${i.key}`}>Size</label>
                            <select id={`size-${i.key}`} className={sel} value={i.size} onChange={(e) => c.changeVariant(i.key, e.target.value, i.color, stockOf(e.target.value, i.color))}>
                              {o.sizes.map((s) => <option key={s} value={s} disabled={s !== i.size && stockOf(s, i.color) <= 0}>{s}{stockOf(s, i.color) <= 0 ? ' (sold out)' : ''}</option>)}
                            </select>
                            <label className="sr-only" htmlFor={`color-${i.key}`}>Colour</label>
                            <select id={`color-${i.key}`} className={sel} value={i.color} onChange={(e) => c.changeVariant(i.key, i.size, e.target.value, stockOf(i.size, e.target.value))}>
                              {o.colors.map((col) => <option key={col.name} value={col.name} disabled={col.name !== i.color && stockOf(i.size, col.name) <= 0}>{col.name}{stockOf(i.size, col.name) <= 0 ? ' (sold out)' : ''}</option>)}
                            </select>
                          </div>
                        ) : <p className="text-sm text-neutral-500">Colour: {i.color} &middot; Size: {i.size}</p>}
                        <p className="mt-1 text-sm">
                          {q?.originalPrice != null && <span className="mr-2 text-neutral-400 line-through">{formatPrice(q.originalPrice)}</span>}
                          <span className={q?.originalPrice != null ? 'font-semibold text-brand' : ''}>{formatPrice(q?.unitPrice ?? i.unitPrice)}</span>
                        </p>
                      </div>
                      <button onClick={() => c.removeItem(i.key)} aria-label={`Remove ${i.name}`} className="self-start text-neutral-400 hover:text-red-600"><Trash2 size={18} /></button>
                    </div>
                    {bad && <p role="alert" className="mt-2 text-sm font-semibold text-red-600">{q.message}</p>}
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
                      <div>
                        <QuantitySelector value={i.quantity} max={Math.max(1, i.maxStock)} onChange={(n) => c.setQuantity(i.key, n)} />
                        {!bad && i.quantity >= i.maxStock && i.maxStock > 0 && <p className="mt-1 text-xs text-brand">Maximum available stock</p>}
                      </div>
                      <span className="text-lg font-bold">{formatPrice(q?.lineTotal ?? i.unitPrice * i.quantity)}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {unavailable.length > 0 && <button className="btn btn-outline mt-5 !px-5 !py-3" onClick={() => unavailable.forEach((i) => c.removeItem(i.key))}>Remove unavailable items</button>}
        </div>

        <aside className={`h-fit bg-neutral-100 p-6 transition-opacity lg:sticky lg:top-28 ${loading ? 'opacity-70' : ''}`} aria-busy={loading}>
          <h2 className="mb-5 text-3xl font-extrabold">Order summary</h2>

          {c.couponCode ? (
            <div className="mb-5 flex items-center justify-between bg-white px-4 py-3 text-sm">
              <span className="flex items-center gap-2"><Tag size={16} className="text-brand" /> <strong>{c.couponCode}</strong>{quote?.coupon?.valid && quote.coupon.type && <span className="text-neutral-500">({quote.coupon.type === 'percentage' ? `-${quote.coupon.value}%` : `-${formatPrice(quote.coupon.value ?? 0)}`})</span>}</span>
              <button onClick={() => c.setCoupon(null)} aria-label="Remove coupon"><X size={16} /></button>
            </div>
          ) : (
            <form onSubmit={apply} className="mb-5" noValidate>
              <label htmlFor="coupon" className="mb-1.5 block text-sm font-semibold">Discount code</label>
              <div className="flex gap-2">
                <input id="coupon" value={code} onChange={(e) => { setCode(e.target.value); setCouponError(null); }} placeholder="Enter coupon code" className="input uppercase" maxLength={30} />
                <button className="btn btn-dark !px-5 !py-3" disabled={applying}>{applying ? '...' : 'Apply'}</button>
              </div>
              {couponError && <p className="mt-1.5 text-sm text-red-600" role="alert">{couponError}</p>}
            </form>
          )}

          <dl className="space-y-3 border-t border-neutral-300 pt-5 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd className="font-semibold">{quote ? formatPrice(quote.subtotal) : '-'}</dd></div>
            {quote && quote.discount > 0 && <div className="flex justify-between text-green-700"><dt>Discount</dt><dd className="font-semibold">-{formatPrice(quote.discount)}</dd></div>}
            <div className="flex justify-between"><dt>Shipping</dt><dd className="font-semibold">{quote ? (quote.shipping === 0 ? 'Free' : formatPrice(quote.shipping)) : '-'}</dd></div>
            {quote && quote.freeShipping.remaining > 0 && <p className="text-xs text-neutral-500">Spend {formatPrice(quote.freeShipping.remaining)} more for free shipping.</p>}
            <div className="flex justify-between border-t border-neutral-300 pt-4 text-xl font-bold"><dt>Total</dt><dd>{quote ? formatPrice(quote.total) : '-'}</dd></div>
          </dl>

          <Link to="/checkout" aria-disabled={blocked} tabIndex={blocked ? -1 : undefined} onClick={(e) => blocked && e.preventDefault()}
            className={`btn btn-primary mt-6 w-full ${blocked ? 'pointer-events-none opacity-50' : ''}`}>Checkout</Link>
          {quote?.hasIssues && <p className="mt-2 text-center text-xs text-red-600">Fix the highlighted items to continue.</p>}
          <Link to="/shop" className="mt-3 block text-center text-sm font-semibold underline underline-offset-4">Continue shopping</Link>
        </aside>
      </div>
    </div>
  );
}
