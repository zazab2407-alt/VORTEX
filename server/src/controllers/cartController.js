import { config } from '../config/env.js';
import asyncHandler from '../utils/asyncHandler.js';
import { buildQuote } from '../services/pricing.js';
import { isContactFormEnabled } from '../services/mailer.js';

/**
 * Public store settings the storefront needs (currency formatting, shipping rules, contact details, return window).
 * Built field by field from an allow-list: nothing private (secrets, SMTP, database, the contact inbox) can end up here.
 * `currency` and `shipping` keep their original shape so existing clients keep working.
 */
export const shopConfig = (_req, res) => res.json({
  success: true,
  data: {
    currency: config.store.currency,
    currencySymbol: config.store.currencySymbol,
    locale: config.store.locale,
    storeName: config.store.name,
    shipping: { flatRate: config.shipping.flatRate, freeThreshold: config.shipping.freeThreshold },
    contact: { formEnabled: isContactFormEnabled(), email: config.contact.email, phone: config.contact.phone, address: config.contact.address },
    returns: { windowDays: config.returns.windowDays },
    promoCode: config.promoCode,
  },
});

/** "What would this cart cost right now?" Authoritative prices, stock, coupon and totals, straight from the database. */
export const quote = asyncHandler(async (req, res) => {
  const { items, couponCode } = req.body;
  res.json({ success: true, data: await buildQuote({ items: items.map(({ productId, size, color, quantity }) => ({ productId, size, color, quantity })), couponCode }) });
});
