import mongoose from 'mongoose';
import { round2 } from '../utils/money.js';
import { formatMoney } from '../utils/currency.js';

export const COUPON_TYPES = ['percentage', 'fixed'];

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: [true, 'Coupon code is required'], unique: true, uppercase: true, trim: true, match: [/^[A-Z0-9_-]{3,30}$/, 'Code may only contain letters, numbers, - and _'] },
    type: { type: String, enum: { values: COUPON_TYPES, message: 'Coupon type must be percentage or fixed' }, default: 'percentage' },
    /** A percentage (1-100) for type "percentage", or an amount in the store currency for type "fixed". */
    value: { type: Number, required: [true, 'Discount value is required'], min: [0.01, 'Discount must be greater than 0'] },
    minSubtotal: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date },
    usageLimit: { type: Number, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    /** Set (never cleared) by the first redemption. A coupon that has ever been redeemed keeps its code, even after its uses are returned. */
    everRedeemed: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

couponSchema.pre('validate', function checkValue(next) {
  if (this.type === 'percentage' && (this.value < 1 || this.value > 100)) this.invalidate('value', 'A percentage discount must be between 1% and 100%');
  if (this.type === 'fixed' && this.value > 100000) this.invalidate('value', 'Fixed discount is too large');
  next();
});

/** Returns a customer-facing error string, or null when the coupon can be used on this subtotal. */
couponSchema.methods.check = function check(subtotal) {
  if (!this.isActive) return 'This coupon is no longer active';
  if (this.expiresAt && this.expiresAt < new Date()) return 'This coupon has expired';
  if (this.usageLimit != null && this.usedCount >= this.usageLimit) return 'This coupon has reached its usage limit';
  if (subtotal < this.minSubtotal) return `This coupon requires a minimum order of ${formatMoney(this.minSubtotal)}`;
  return null;
};

/** The discount in the store currency for a subtotal. Never more than the subtotal itself. */
couponSchema.methods.discountFor = function discountFor(subtotal) {
  const raw = this.type === 'percentage' ? (subtotal * this.value) / 100 : this.value;
  return round2(Math.min(raw, subtotal));
};

/**
 * Atomically uses one redemption. Returns null if the coupon is inactive, its limit was just reached, or (when `code` is
 * given) the coupon has been renamed since the code was quoted. Binding to `code` closes the race where checkout reads a
 * coupon under its old code, the code is then changed, and the stale quote would otherwise still redeem the renamed coupon.
 */
couponSchema.statics.redeem = function redeem(id, options = {}) {
  const { code, ...rest } = options;
  return this.findOneAndUpdate(
    { _id: id, ...(code !== undefined && { code }), isActive: true, $or: [{ usageLimit: null }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }] },
    { $inc: { usedCount: 1 }, $set: { everRedeemed: true } },
    { new: true, ...rest }
  );
};

/** Gives a redemption back (order cancelled, or order creation failed after redeeming). */
couponSchema.statics.unredeem = function unredeem(id, options = {}) {
  return this.updateOne({ _id: id, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } }, options);
};

export default mongoose.model('Coupon', couponSchema);
