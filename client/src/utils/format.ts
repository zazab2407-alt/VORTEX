import type { Product } from '../types';

// Currency and locale come from the server (GET /api/cart/config via useShopConfig), so the shop can switch from USD to
// EGP (or anything else) by changing server settings only. Until the settings arrive the defaults below are used.
let money = { currency: 'USD', locale: 'en-US' };
let formatter = new Intl.NumberFormat(money.locale, { style: 'currency', currency: money.currency });

/** Called once the store settings are known. Invalid values are ignored so a bad setting can never break the UI. */
export function setMoneyFormat(currency: string, locale: string) {
  if (currency === money.currency && locale === money.locale) return;
  try { formatter = new Intl.NumberFormat(locale, { style: 'currency', currency }); money = { currency, locale }; } catch { /* keep the previous formatter */ }
}

export const formatPrice = (n: number) => formatter.format(n);

export const variantKey = (size: string, color: string) => `${size}|${color}`;
export const effectivePrice = (p: Pick<Product, 'price' | 'salePrice'>) => p.salePrice ?? p.price;
export const discountPercent = (p: Pick<Product, 'price' | 'salePrice'>) =>
  p.salePrice ? Math.round((1 - p.salePrice / p.price) * 100) : 0;
