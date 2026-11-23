import { config } from '../config/env.js';

const cache = new Map();

/** Formats an amount in the store currency (CURRENCY / CURRENCY_LOCALE), e.g. "$50.00" by default. */
export function formatMoney(amount, { currency = config.store.currency, locale = config.store.locale } = {}) {
  const key = `${locale}|${currency}`;
  let fmt = cache.get(key);
  if (!fmt) { fmt = new Intl.NumberFormat(locale, { style: 'currency', currency }); cache.set(key, fmt); }
  return fmt.format(Number(amount));
}
