import { useCallback, useEffect, useState } from 'react';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { cartService } from '../services/shop';
import type { CartQuote } from '../types';

/**
 * Asks the server what the current cart costs (prices, stock, coupon, shipping, total) whenever the cart or coupon changes.
 * Quantities above available stock are trimmed automatically, and a coupon that stopped being valid is removed with a message.
 */
export function useCartQuote() {
  const { items, couponCode, setCoupon, syncFromQuote } = useCart();
  const { toast } = useToast();
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);
  const signature = JSON.stringify(items.map((i) => [i.productId, i.size, i.color, i.quantity])) + '|' + (couponCode ?? '');

  useEffect(() => {
    if (items.length === 0) { setQuote(null); setError(null); setLoading(false); return; }
    const ctrl = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const q = await cartService.quote(items, couponCode, ctrl.signal);
        if (ctrl.signal.aborted) return;
        setQuote(q); setError(null);
        const trimmed = syncFromQuote(q.lines);
        if (trimmed.length) toast(`Quantity reduced to the stock available for ${trimmed.join(', ')}`, 'error');
        if (q.coupon && !q.coupon.valid) { toast(q.coupon.error ?? 'Your coupon was removed', 'error'); setCoupon(null); }
      } catch (e) {
        if (!ctrl.signal.aborted) setError(e as Error);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => { clearTimeout(timer); ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { quote: items.length ? quote : null, loading, error, reload };
}
