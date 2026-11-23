import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CartItem, QuoteLine } from '../types';
import { isValidId } from '../services/api';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface CartCtx {
  items: CartItem[];
  count: number;
  /** Quick local estimate for the drawer. Real prices, discounts and totals always come from the server (useCartQuote). */
  subtotal: number;
  couponCode: string | null;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: Omit<CartItem, 'key'>) => { ok: boolean; message: string };
  setQuantity: (key: string, qty: number) => void;
  /** Switch a line to another size/colour; merges with an existing line for that variant. */
  changeVariant: (key: string, size: string, color: string, maxStock: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  setCoupon: (code: string | null) => void;
  /** Applies what the server says: current price, stock limit, and trims quantities that exceed stock. Returns names that were trimmed. */
  syncFromQuote: (lines: QuoteLine[]) => string[];
}
const Ctx = createContext<CartCtx | null>(null);
const keyOf = (productId: string, size: string, color: string) => `${productId}|${size}|${color}`;

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useLocalStorage<CartItem[]>('vortex_cart', []);
  const [couponCode, setCouponCode] = useLocalStorage<string | null>('vortex_coupon_code', null);
  const [isOpen, setOpen] = useState(false);

  // Drop anything saved before real product ids existed, and the old locally-calculated coupon
  useEffect(() => {
    if (items.some((i) => !isValidId(i.productId))) setItems((l) => l.filter((i) => isValidId(i.productId)));
    try { localStorage.removeItem('vortex_coupon'); } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const subtotal = useMemo(() => Math.round(items.reduce((s, i) => s + i.unitPrice * i.quantity, 0) * 100) / 100, [items]);
  const count = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);

  const addItem: CartCtx['addItem'] = (item) => {
    const key = keyOf(item.productId, item.size, item.color);
    const existing = items.find((i) => i.key === key);
    const current = existing?.quantity ?? 0;
    if (item.maxStock <= 0) return { ok: false, message: 'This variant is out of stock' };
    if (current + item.quantity > item.maxStock) return { ok: false, message: `Only ${item.maxStock} available${current ? ` (${current} already in your cart)` : ''}` };
    setItems((l) => existing ? l.map((i) => (i.key === key ? { ...i, quantity: i.quantity + item.quantity, maxStock: item.maxStock } : i)) : [...l, { ...item, key }]);
    return { ok: true, message: 'Added to cart' };
  };

  const changeVariant: CartCtx['changeVariant'] = (key, size, color, maxStock) =>
    setItems((l) => {
      const line = l.find((i) => i.key === key);
      if (!line) return l;
      const newKey = keyOf(line.productId, size, color);
      if (newKey === key) return l;
      const other = l.find((i) => i.key === newKey);
      const cap = Math.max(1, maxStock);
      if (other) return l.filter((i) => i.key !== key).map((i) => (i.key === newKey ? { ...i, quantity: Math.min(i.quantity + line.quantity, cap), maxStock } : i));
      return l.map((i) => (i.key === key ? { ...i, key: newKey, size, color, maxStock, quantity: Math.min(i.quantity, cap) } : i));
    });

  const syncFromQuote: CartCtx['syncFromQuote'] = (lines) => {
    const byKey = new Map(lines.map((q) => [keyOf(q.productId, q.size, q.color), q]));
    const trimmed: string[] = [];
    setItems((l) => {
      let changed = false;
      const next = l.map((i) => {
        const q = byKey.get(i.key);
        if (!q || q.status === 'unavailable') return i;
        const quantity = q.available > 0 && i.quantity > q.available ? q.available : i.quantity;
        const upd = { ...i, maxStock: q.available, unitPrice: q.unitPrice ?? i.unitPrice, image: q.image ?? i.image, name: q.name, quantity };
        if (quantity !== i.quantity) trimmed.push(i.name);
        if (upd.maxStock !== i.maxStock || upd.unitPrice !== i.unitPrice || upd.quantity !== i.quantity || upd.image !== i.image || upd.name !== i.name) changed = true;
        return upd;
      });
      return changed ? next : l;
    });
    return trimmed;
  };

  const value: CartCtx = {
    items, count, subtotal, couponCode, isOpen,
    openCart: () => setOpen(true), closeCart: () => setOpen(false),
    addItem,
    setQuantity: (key, qty) => setItems((l) => l.map((i) => (i.key === key ? { ...i, quantity: Math.max(1, Math.min(qty, Math.max(1, i.maxStock))) } : i))),
    changeVariant,
    removeItem: (key) => setItems((l) => l.filter((i) => i.key !== key)),
    clear: () => { setItems([]); setCouponCode(null); },
    setCoupon: setCouponCode,
    syncFromQuote,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useCart = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCart must be used inside CartProvider');
  return c;
};
