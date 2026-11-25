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
  const locked = c.usedCount > 0 || orderCount > 0 || c.everRedeemed;
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

/**
 * Edits a coupon. Every requested field is applied in ONE atomic write, or none is:
 *  - a used coupon keeps its code (orders refer to it by code); other fields may still be edited;
 *  - the usage limit may never be set below the number of times the coupon has been used, checked again inside the write
 *    so a checkout that redeems the coupon at the same moment cannot leave usedCount above usageLimit;
 *  - the edited coupon must pass the same validation as before, checked in memory before anything is written.
 * usedCount itself is never written from this endpoint.
 */
export const updateCoupon = asyncHandler(async (req, res) => {
  const b = req.body;
  const c = await find(req.params.id);
  const orderCount = await orderCountFor(c.code);
  const used = c.usedCount > 0 || orderCount > 0 || c.everRedeemed;

  // 1. Work out what is being requested. Nothing is written yet.
  const set = {};
  const unset = {};
  let codeChanging = false;
  let limitChanging = false;

  if (b.code !== undefined && b.code.toUpperCase() !== c.code) {
    // Orders and refunds refer to a coupon by its code, so a used coupon keeps its code for good
    if (used) throw ApiError.conflict('This coupon has already been used, so its code cannot change. Deactivate it and create a new one instead.', [{ field: 'code', message: 'Code cannot change after the coupon has been used' }]);
    codeChanging = true;
    set.code = b.code.toUpperCase();
  }
  if (b.type !== undefined) set.type = b.type;
  if (b.value !== undefined) set.value = b.value;
  if (b.minSubtotal !== undefined) set.minSubtotal = b.minSubtotal ?? 0;
  if (b.isActive !== undefined) set.isActive = b.isActive;
  if ('usageLimit' in b) {
    limitChanging = true;
    if (b.usageLimit != null && b.usageLimit < c.usedCount) throw ApiError.badRequest(`The limit cannot be lower than the ${c.usedCount} times this coupon was already used`, [{ field: 'usageLimit', message: `Cannot be lower than ${c.usedCount} (already used)` }]);
    if (b.usageLimit != null) set.usageLimit = b.usageLimit;
    else unset.usageLimit = '';
  }
  if ('expiresAt' in b) {
    const next = parseExpiry(b.expiresAt);
    if (next && +next !== +(c.expiresAt ?? 0) && next < new Date()) throw ApiError.badRequest('The expiry date must be in the future', [{ field: 'expiresAt', message: 'The expiry date must be in the future' }]);
    if (next) set.expiresAt = next;
    else unset.expiresAt = '';
  }

  // 2. Validate the coupon as it would look after the change, using the same schema rules, without saving anything.
  for (const [k, v] of Object.entries(set)) c.set(k, v);
  for (const k of Object.keys(unset)) c.set(k, undefined);
  await c.validate();

  // 3. One atomic write. The filter re-checks the conditions that matter at the moment of the write.
  const update = {};
  if (Object.keys(set).length) update.$set = set;
  if (Object.keys(unset).length) update.$unset = unset;
  if (!Object.keys(update).length) return res.json({ success: true, data: serializeCoupon(c, orderCount) }); // nothing to change

  const conditions = [];
  if (codeChanging) conditions.push({ usedCount: 0 }, { everRedeemed: { $ne: true } }); // no redemption may happen while the code is changing, now or ever
  if (limitChanging && set.usageLimit !== undefined) conditions.push({ usedCount: { $lte: set.usageLimit } }); // never below the live usage count
  const filter = conditions.length ? { _id: c._id, $and: conditions } : { _id: c._id };

  const updated = await Coupon.findOneAndUpdate(filter, update, { new: true });
  if (!updated) {
    // Something changed between our read and the write. Nothing was applied. Say why, using the current state.
    const fresh = await find(req.params.id);
    if (codeChanging && (fresh.usedCount > 0 || fresh.everRedeemed)) throw ApiError.conflict('This coupon has just been used, so its code cannot change. Deactivate it and create a new one instead.', [{ field: 'code', message: 'Code cannot change after the coupon has been used' }]);
    if (limitChanging && set.usageLimit !== undefined && set.usageLimit < fresh.usedCount) throw ApiError.badRequest(`The limit cannot be lower than the ${fresh.usedCount} times this coupon was already used`, [{ field: 'usageLimit', message: `Cannot be lower than ${fresh.usedCount} (already used)` }]);
    throw ApiError.conflict('The coupon was changed while you were saving. Reload it and try again.');
  }
  res.json({ success: true, data: serializeCoupon(updated, await orderCountFor(updated.code)) });
});

export const deleteCoupon = asyncHandler(async (req, res) => {
  const c = await find(req.params.id);
  if (c.usedCount > 0 || c.everRedeemed || (await orderCountFor(c.code)) > 0) throw ApiError.conflict('This coupon has been used on orders, so it cannot be deleted. Deactivate it instead.');
  const deleted = await Coupon.findOneAndDelete({ _id: c._id, usedCount: 0, everRedeemed: { $ne: true } }); // never delete one that was redeemed a moment ago
  if (!deleted) throw ApiError.conflict('This coupon has just been used, so it cannot be deleted. Deactivate it instead.');
  res.json({ success: true, data: { id: String(c._id) } });
});
