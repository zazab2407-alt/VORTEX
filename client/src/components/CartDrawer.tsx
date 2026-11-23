import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Trash2, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useShopConfig } from '../hooks/useShopConfig';
import { formatPrice } from '../utils/format';
import Img from './Img';
import QuantitySelector from './QuantitySelector';

export default function CartDrawer() {
  const { isOpen, closeCart, items, subtotal, count, setQuantity, removeItem } = useCart();
  const threshold = useShopConfig().shipping.freeThreshold;
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeCart();
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); };
  }, [isOpen, closeCart]);
  if (!isOpen) return null;

  const remaining = Math.max(0, threshold - subtotal);
  const progress = Math.min(100, (subtotal / threshold) * 100);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Shopping cart">
      <div className="absolute inset-0 animate-fade-in bg-black/60" onClick={closeCart} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md animate-slide-left flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <h2 className="text-2xl font-extrabold">Your Cart ({count})</h2>
          <button onClick={closeCart} aria-label="Close cart"><X size={24} /></button>
        </header>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <ShoppingBag size={56} className="text-neutral-300" />
            <p className="font-display text-2xl font-bold uppercase">Your cart is empty</p>
            <p className="text-sm text-neutral-500">Gear up and start your next session.</p>
            <Link to="/shop" onClick={closeCart} className="btn btn-primary">Shop Now</Link>
          </div>
        ) : (
          <>
            <div className="border-b border-neutral-200 px-5 py-3 text-sm">
              {remaining > 0
                ? <p>Add <strong>{formatPrice(remaining)}</strong> more for <strong className="text-brand">free shipping</strong></p>
                : <p className="font-semibold text-brand">You have unlocked free shipping!</p>}
              <div className="mt-2 h-1.5 bg-neutral-200"><div className="h-full bg-brand transition-all duration-500" style={{ width: `${progress}%` }} /></div>
            </div>
            <ul className="flex-1 divide-y divide-neutral-200 overflow-y-auto px-5">
              {items.map((i) => (
                <li key={i.key} className="flex gap-4 py-4">
                  <Link to={`/product/${i.slug}`} onClick={closeCart} className="h-28 w-24 shrink-0 overflow-hidden bg-neutral-100">
                    <Img src={i.image} alt={i.name} className="h-full w-full object-cover" />
                  </Link>
                  <div className="flex flex-1 flex-col">
                    <div className="flex justify-between gap-2">
                      <Link to={`/product/${i.slug}`} onClick={closeCart} className="font-semibold leading-snug hover:text-brand">{i.name}</Link>
                      <button onClick={() => removeItem(i.key)} aria-label={`Remove ${i.name}`} className="text-neutral-400 hover:text-red-600"><Trash2 size={16} /></button>
                    </div>
                    <p className="text-xs text-neutral-500">{i.color} / {i.size}</p>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <QuantitySelector small value={i.quantity} max={i.maxStock} onChange={(n) => setQuantity(i.key, n)} />
                      <span className="font-bold">{formatPrice(i.unitPrice * i.quantity)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <footer className="space-y-3 border-t border-neutral-200 p-5">
              <div className="flex justify-between text-lg font-bold"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
              <p className="text-xs text-neutral-500">Shipping and coupons are calculated in your cart.</p>
              <Link to="/cart" onClick={closeCart} className="btn btn-dark w-full">View Cart & Checkout</Link>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
