import mongoose from 'mongoose';
import { generateOrderNumber } from '../utils/orderNumber.js';
import { round2 } from '../utils/money.js';

export const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
export const PAYMENT_METHODS = ['cod', 'online'];
export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];

/** The only forward path an order can take. Cancelling is handled separately (see the lists below). */
export const ORDER_FLOW = { pending: 'confirmed', confirmed: 'processing', processing: 'shipped', shipped: 'delivered' };
/** Customers can cancel until we start processing; admins until the parcel is shipped. */
export const CUSTOMER_CANCELLABLE = ['pending', 'confirmed'];
export const ADMIN_CANCELLABLE = ['pending', 'confirmed', 'processing'];
/** Statuses an admin may move an order to from `status`. */
export const nextStatuses = (status) => [ORDER_FLOW[status], ADMIN_CANCELLABLE.includes(status) ? 'cancelled' : null].filter(Boolean);

/** Snapshot of what was bought, so later price or name changes never rewrite order history. */
const itemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    slug: { type: String },
    image: { type: String },
    size: { type: String, required: true },
    color: { type: String, required: true },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: [1, 'Quantity must be at least 1'], validate: { validator: Number.isInteger, message: 'Quantity must be a whole number' } },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true, default: () => generateOrderNumber() },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, // empty for guest checkout
    customer: {
      fullName: { type: String, required: [true, 'Full name is required'], trim: true, maxlength: 100 },
      email: { type: String, required: [true, 'Email is required'], lowercase: true, trim: true, match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'], index: true },
      phone: { type: String, required: [true, 'Phone number is required'], trim: true, maxlength: 30 },
    },
    shippingAddress: {
      address: { type: String, required: [true, 'Address is required'], trim: true, maxlength: 300 },
      city: { type: String, required: [true, 'City is required'], trim: true, maxlength: 80 },
      notes: { type: String, trim: true, maxlength: 500 },
    },
    items: { type: [itemSchema], validate: { validator: (v) => v.length >= 1, message: 'An order needs at least one item' } },
    subtotal: { type: Number, required: true, min: 0 },
    couponCode: { type: String, uppercase: true, trim: true },
    discount: { type: Number, default: 0, min: 0 },
    shippingCost: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: { values: PAYMENT_METHODS, message: 'Invalid payment method' }, default: 'cod' },
    paymentStatus: { type: String, enum: { values: PAYMENT_STATUSES, message: 'Invalid payment status' }, default: 'pending' },
    status: { type: String, enum: { values: ORDER_STATUSES, message: 'Invalid order status' }, default: 'pending', index: true },
    statusHistory: {
      type: [new mongoose.Schema({ status: String, at: { type: Date, default: Date.now }, by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, note: { type: String, maxlength: 300 } }, { _id: false })],
      default: [],
    },
    /** Client-generated key that makes "place order" safe to retry or double-click: the same key can only ever create one order. */
    idempotencyKey: { type: String, unique: true, sparse: true, select: false },
    couponRedeemed: { type: Boolean, default: false },
    /** Set once stock (and coupon use) was given back after a cancellation. A cancelled order without it needs attention. */
    stockRestoredAt: { type: Date },
    confirmationEmail: { type: String, enum: ['not_configured', 'sent', 'failed'] },
  },
  { timestamps: true }
);

orderSchema.index({ createdAt: -1 });

/** Integrity guard: totals must add up exactly, whoever built the order. */
orderSchema.pre('validate', function checkTotals(next) {
  const lineSum = round2(this.items.reduce((s, i) => s + i.lineTotal, 0));
  for (const i of this.items) {
    if (round2(i.unitPrice * i.quantity) !== round2(i.lineTotal)) this.invalidate('items', `Line total is wrong for ${i.name}`);
  }
  if (lineSum !== round2(this.subtotal)) this.invalidate('subtotal', 'Subtotal does not match the order items');
  if (round2(this.subtotal - this.discount + this.shippingCost) !== round2(this.total)) this.invalidate('total', 'Total does not match subtotal, discount and shipping');
  if (this.discount > this.subtotal) this.invalidate('discount', 'Discount cannot exceed the subtotal');
  next();
});

orderSchema.pre('save', function recordStatus(next) {
  if (this.isNew || this.isModified('status')) this.statusHistory.push({ status: this.status });
  next();
});

export default mongoose.model('Order', orderSchema);
