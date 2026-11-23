import { Coupon, Order } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { escapeRegex } from '../utils/productQuery.js';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
/** A date picked in the admin form means "valid through the end of that day". Blank clears the expiry. */
const parseExpiry = (v) => (!v ? null : DATE_ONLY.test(v) ? new Date(`${v}T23:59:59.999Z`) : new Date(v));

const stateOf = (c, now = new Date()) => {
  if (!c.isActive) return 'inactive';
  if (c.expiresAt && c.expiresAt < now) return 'expired';
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) return 'exhausted';
  return 'active';
};

/** `orderCount` = orders that ever used this code (cancelled ones included: the code is still written on them). */
export function serializeCoupon(doc, orderCount = 0) {
  const c = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const locked = c.usedCount > 0 || orderCount > 0;
  return {
    id: String(c._id), code: c.code, type: c.type, value: c.value, minSubtotal: c.minSubtotal ?? 0,
    expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString() : null, usageLimit: c.usageLimit ?? null, usedCount: c.usedCount ?? 0,
    isActive: c.isActive !== false, state: stateOf(c), orderCount,
    canDelete: !locked, // used coupons are kept for the order history; deactivate them instead
    createdAt: new Date(c.createdAt).toISOString(),
  };
}

const orderCountFor = async (code) => Order.countDocuments({ couponCode: code });
const find = async (id) => { const c = await Coupon.findById(id); if (!c) throw ApiError.notFound('Coupon not found'); return c; };

export const listCoupons = asyncHandler(async (req, res) => {
  const { q, status } = req.query;
  const filter = q ? { code: new RegExp(escapeRegex(String(q).trim()), 'i') } : {};
  const coupons = await Coupon.find(filter).sort({ createdAt: -1, _id: -1 }).limit(500).lean();
  const counts = await Order.aggregate([{ $match: { couponCode: { $in: coupons.map((c) => c.code) } } }, { $group: { _id: '$couponCode', n: { $sum: 1 } } }]);
  const byCode = new Map(counts.map((r) => [r._id, r.n]));
  const rows = coupons.map((c) => serializeCoupon(c, byCode.get(c.code) ?? 0)).filter((c) => !status || c.state === status);
  res.json({ success: true, data: rows });
});

export const getCoupon = asyncHandler(async (req, res) => {
  const c = await find(req.params.id);
  res.json({ success: true, data: serializeCoupon(c, await orderCountFor(c.code)) });
});

export const createCoupon = asyncHandler(async (req, res) => {
  const b = req.body;
  const expiresAt = parseExpiry(b.expiresAt);
  if (expiresAt && expiresAt < new Date()) throw ApiError.badRequest('The expiry date must be in the future', [{ field: 'expiresAt', message: 'The expiry date must be in the future' }]);
  const c = await Coupon.create({
    code: b.code.toUpperCase(), type: b.type, value: b.value, minSubtotal: b.minSubtotal ?? 0,
    ...(expiresAt && { expiresAt }), ...(b.usageLimit != null && { usageLimit: b.usageLimit }), isActive: b.isActive ?? true, // usedCount always starts at 0
  });
  res.status(201).json({ success: true, data: serializeCoupon(c, 0) });
});

export const updateCoupon = asyncHandler(async (req, res) => {
  const b = req.body;
  const c = await find(req.params.id);
  const orderCount = await orderCountFor(c.code);
  const used = c.usedCount > 0 || orderCount > 0;

  if (b.code !== undefined && b.code.toUpperCase() !== c.code) {
    // Orders and refunds refer to a coupon by its code, so a used coupon keeps its code for good
    if (used) throw ApiError.conflict('This coupon has already been used, so its code cannot change. Deactivate it and create a new one instead.', [{ field: 'code', message: 'Code cannot change after the coupon has been used' }]);
    c.code = b.code.toUpperCase();
  }
  if (b.type !== undefined) c.type = b.type;
  if (b.value !== undefined) c.value = b.value;
  if (b.minSubtotal !== undefined) c.minSubtotal = b.minSubtotal ?? 0;
  if (b.isActive !== undefined) c.isActive = b.isActive;
  if ('usageLimit' in b) {
    if (b.usageLimit != null && b.usageLimit < c.usedCount) throw ApiError.badRequest(`The limit cannot be lower than the ${c.usedCount} times this coupon was already used`, [{ field: 'usageLimit', message: `Cannot be lower than ${c.usedCount} (already used)` }]);
    c.usageLimit = b.usageLimit ?? undefined;
  }
  if ('expiresAt' in b) {
    const next = parseExpiry(b.expiresAt);
    if (next && +next !== +(c.expiresAt ?? 0) && next < new Date()) throw ApiError.badRequest('The expiry date must be in the future', [{ field: 'expiresAt', message: 'The expiry date must be in the future' }]);
    c.expiresAt = next ?? undefined;
  }
  await c.save(); // usedCount is not modified here, so a checkout redeeming it at the same moment is never overwritten
  res.json({ success: true, data: serializeCoupon(c, orderCount) });
});

export const deleteCoupon = asyncHandler(async (req, res) => {
  const c = await find(req.params.id);
  if (c.usedCount > 0 || (await orderCountFor(c.code)) > 0) throw ApiError.conflict('This coupon has been used on orders, so it cannot be deleted. Deactivate it instead.');
  const deleted = await Coupon.findOneAndDelete({ _id: c._id, usedCount: 0 }); // never delete one that was redeemed a moment ago
  if (!deleted) throw ApiError.conflict('This coupon has just been used, so it cannot be deleted. Deactivate it instead.');
  res.json({ success: true, data: { id: String(c._id) } });
});
