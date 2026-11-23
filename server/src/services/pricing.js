import { Coupon, Product } from '../models/index.js';
import { config } from '../config/env.js';
import { round2 } from '../utils/money.js';

export const shippingFor = (amountAfterDiscount) =>
  amountAfterDiscount <= 0 || amountAfterDiscount >= config.shipping.freeThreshold ? 0 : config.shipping.flatRate;

const keyOf = (i) => `${i.productId}|${i.size}|${i.color}`;

/**
 * The single source of truth for money. The browser only says WHAT it wants (product, size, colour, quantity, coupon code);
 * every price, discount, shipping cost and total is computed here from the database. Used by the cart and by checkout.
 */
export async function buildQuote({ items, couponCode }) {
  // The same variant listed twice is one line
  const merged = new Map();
  for (const it of items) {
    const k = keyOf(it);
    merged.set(k, merged.has(k) ? { ...merged.get(k), quantity: merged.get(k).quantity + it.quantity } : { ...it });
  }
  const wanted = [...merged.values()];
  const products = await Product.find({ _id: { $in: [...new Set(wanted.map((w) => w.productId))] } }).lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const lines = wanted.map((w) => {
    const p = byId.get(String(w.productId));
    const base = { productId: String(w.productId), size: w.size, color: w.color, quantity: w.quantity };
    if (!p || !p.isActive) return { ...base, name: p?.name ?? 'Unavailable product', slug: p?.slug, image: p?.images?.[0], status: 'unavailable', available: 0, message: 'This product is no longer available' };

    const variant = p.variants.find((v) => v.size === w.size && v.color === w.color);
    const unitPrice = p.salePrice ?? p.price;
    const stock = Object.fromEntries(p.variants.map((v) => [`${v.size}|${v.color}`, v.stock]));
    const line = {
      ...base, name: p.name, slug: p.slug, image: p.images[0], unitPrice, originalPrice: p.salePrice != null ? p.price : undefined,
      lineTotal: round2(unitPrice * w.quantity), available: variant?.stock ?? 0,
      options: { sizes: p.sizes, colors: p.colors.map((c) => ({ name: c.name, hex: c.hex })), stock },
    };
    if (!variant) return { ...line, lineTotal: 0, status: 'unavailable', message: 'This size and colour is not available' };
    if (variant.stock <= 0) return { ...line, status: 'out_of_stock', message: 'Out of stock' };
    if (w.quantity > variant.stock) return { ...line, status: 'insufficient', message: `Only ${variant.stock} left in stock` };
    return { ...line, status: 'ok' };
  });

  const subtotal = round2(lines.filter((l) => l.status !== 'unavailable').reduce((s, l) => s + l.lineTotal, 0));

  let coupon = null; let discount = 0;
  const code = typeof couponCode === 'string' ? couponCode.trim().toUpperCase() : '';
  if (code) {
    const doc = await Coupon.findOne({ code });
    const error = !doc ? 'This coupon code is not valid' : doc.check(subtotal);
    coupon = { code, valid: !error, ...(error && { error }) };
    if (!error) { discount = doc.discountFor(subtotal); coupon = { ...coupon, id: String(doc._id), type: doc.type, value: doc.value }; }
  }

  const afterDiscount = round2(subtotal - discount);
  const shipping = shippingFor(afterDiscount);
  return {
    lines, subtotal, discount, shipping, total: round2(afterDiscount + shipping), coupon,
    hasIssues: lines.some((l) => l.status !== 'ok'),
    freeShipping: { threshold: config.shipping.freeThreshold, remaining: shipping > 0 ? round2(config.shipping.freeThreshold - afterDiscount) : 0 },
  };
}
