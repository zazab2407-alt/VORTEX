import type { ShopConfig } from '../types';
import { freeShippingLabel } from '../utils/storeText';

/** The shipping and returns cards read their numbers from the server settings, so they can never promise something the shop does not offer. */
export const whyUs = (c: ShopConfig) => [
  { icon: 'zap', title: 'Performance Fabrics', text: 'Lightweight, breathable fabrics designed for training.' },
  { icon: 'truck', title: 'Fast Delivery', text: `${freeShippingLabel(c)}.` },
  { icon: 'return', title: c.returns.windowDays ? `${c.returns.windowDays}-Day Returns` : 'Returns & Refunds', text: 'Read our returns and refunds policy to see how it works.' },
  { icon: 'shield', title: 'Cash on Delivery', text: 'Pay in cash when your order arrives. No card needed.' },
] as const;
