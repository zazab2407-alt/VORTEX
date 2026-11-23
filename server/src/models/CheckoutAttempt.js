import mongoose from 'mongoose';

/**
 * Claims an idempotency key BEFORE any stock is touched. A duplicate submission (double click, retry after a network
 * glitch) finds the claim, waits for the original to finish, and returns the same order, so duplicates never compete
 * with the original for stock. Claims expire after 24 hours.
 */
const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  email: { type: String },
  orderId: { type: mongoose.Schema.Types.ObjectId },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 },
});

export default mongoose.model('CheckoutAttempt', schema);
