import type { ShopConfig } from '../types';
import { formatPrice } from './format';

/** "Free shipping over $100": the amount always comes from the server's settings, never from a hardcoded number. */
export const freeShippingLabel = (c: ShopConfig) =>
  c.shipping.freeThreshold > 0 ? `Free shipping over ${formatPrice(c.shipping.freeThreshold)}` : 'Free shipping on every order';

/** A number of days is only mentioned once the shop owner has configured one (RETURN_WINDOW_DAYS). */
export const returnsLabel = (c: ShopConfig) => (c.returns.windowDays ? `${c.returns.windowDays}-day returns` : 'Returns policy');
