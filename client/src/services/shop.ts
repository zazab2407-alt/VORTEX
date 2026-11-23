import type { CartItem, CartQuote, CreateOrderPayload, Order, ShopConfig } from '../types';
import { apiGet, apiSend } from './http';

const lines = (items: CartItem[]) => items.map(({ productId, size, color, quantity }) => ({ productId, size, color, quantity }));

export const cartService = {
  async config(signal?: AbortSignal) { return (await apiGet<ShopConfig>('/cart/config', { signal })).data; },
  /** Authoritative prices, stock, coupon and totals. The browser never calculates money itself. */
  async quote(items: CartItem[], couponCode: string | null, signal?: AbortSignal) {
    return (await apiSend<CartQuote>('POST', '/cart/quote', { items: lines(items), couponCode: couponCode || undefined }, { signal })).data;
  },
};

export const orderService = {
  async create(payload: CreateOrderPayload) { return (await apiSend<{ order: Order; emailSent: boolean; duplicate: boolean }>('POST', '/orders', payload, { timeoutMs: 30000 })).data; },
  async get(orderNumber: string, signal?: AbortSignal) { return (await apiGet<Order>(`/orders/${encodeURIComponent(orderNumber)}`, { signal })).data; },
  async cancel(orderNumber: string) { return (await apiSend<Order>('POST', `/orders/${encodeURIComponent(orderNumber)}/cancel`)).data; },
  async lookup(orderNumber: string, email: string) { return (await apiSend<Order>('POST', '/orders/lookup', { orderNumber, email })).data; },
  async cancelLookup(orderNumber: string, email: string) { return (await apiSend<Order>('POST', '/orders/lookup/cancel', { orderNumber, email })).data; },
};

export const contactService = {
  /** Resolves only when the server confirms the mail server accepted the message; otherwise throws with an honest message. */
  async send(input: { name: string; email: string; topic: string; message: string; website?: string }) {
    return (await apiSend<{ sent: boolean }>('POST', '/contact', input, { timeoutMs: 20000 })).data;
  },
};

/** The confirmation page needs the order right after checkout; guests cannot fetch it by number alone. */
const LAST = 'vortex_last_order';
export const lastOrder = {
  save(order: Order, emailSent: boolean) { try { sessionStorage.setItem(LAST, JSON.stringify({ order, emailSent })); } catch { /* storage unavailable */ } },
  read(orderNumber: string): { order: Order; emailSent: boolean } | null {
    try { const v = JSON.parse(sessionStorage.getItem(LAST) ?? 'null'); return v?.order?.orderNumber === orderNumber ? v : null; } catch { return null; }
  },
};
