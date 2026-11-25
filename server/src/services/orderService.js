import { CheckoutAttempt, Coupon, Order, Product } from '../models/index.js';
import { ADMIN_CANCELLABLE, CUSTOMER_CANCELLABLE, ORDER_FLOW } from '../models/Order.js';
import ApiError from '../utils/ApiError.js';
import { runInTransaction } from '../utils/transaction.js';
import { buildQuote } from './pricing.js';
import { sendOrderConfirmation } from './mailer.js';

const unavailable = (line) => ({ field: 'items', message: `${line.name} (${line.size} / ${line.color}): ${line.message ?? 'not available'}`, productId: line.productId });

/** Only used without a transaction (standalone MongoDB): hands back what was taken so far. */
async function rollback(reserved, couponId) {
  for (const l of reserved) await Product.releaseStock(l.productId, l.size, l.color, l.quantity);
  if (couponId) await Coupon.unredeem(couponId);
}

const replay = (existing, email) => {
  if (existing.customer.email !== email.toLowerCase()) throw ApiError.conflict('This checkout was already submitted with different details. Refresh the page and try again.');
  return { order: existing, duplicate: true };
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** A duplicate request arrived while the original is still being processed: wait for it and return the same order. */
async function awaitClaimedOrder(key, email) {
  for (let i = 0; i < 100; i++) {
    const attempt = await CheckoutAttempt.findOne({ key });
    if (!attempt) throw ApiError.conflict('Your previous attempt did not complete. Please review your cart and try again.');
    if (attempt.orderId) {
      const order = await Order.findById(attempt.orderId);
      if (order) return replay(order, email);
    }
    await wait(100);
  }
  throw ApiError.conflict('Your order is still being processed. Please wait a moment and check your orders before trying again.');
}

/**
 * Places an order exactly once per idempotency key. The key is claimed first, so a double click or a retry never competes
 * with the original request for stock and always gets the original order back.
 */
export async function createOrder(input, user) {
  const { idempotencyKey, customer } = input;
  let claimed = false;
  if (idempotencyKey) {
    const existing = await Order.findOne({ idempotencyKey }).select('+idempotencyKey');
    if (existing) return replay(existing, customer.email);
    try { await CheckoutAttempt.create({ key: idempotencyKey, email: customer.email.toLowerCase() }); claimed = true; }
    catch (e) { if (e.code === 11000) return awaitClaimedOrder(idempotencyKey, customer.email); throw e; }
  }
  try {
    const result = await placeOrder(input, user);
    if (claimed) await CheckoutAttempt.updateOne({ key: idempotencyKey }, { orderId: result.order._id });
    return result;
  } catch (err) {
    if (claimed) await CheckoutAttempt.deleteOne({ key: idempotencyKey, orderId: null }); // let the customer retry after fixing the problem
    throw err;
  }
}

/**
 * All prices come from the database. Stock, the coupon redemption and the order itself are written in ONE transaction when
 * MongoDB supports it (replica set / Atlas), so a crash can never leave stock taken without an order. On a standalone server
 * the same steps run with atomic conditional updates (two shoppers can never buy the same last unit) and are handed back
 * if anything later fails.
 */
async function placeOrder(input, user) {
  const { items, couponCode, customer, shippingAddress, idempotencyKey } = input;

  if (idempotencyKey) {
    const existing = await Order.findOne({ idempotencyKey }).select('+idempotencyKey');
    if (existing) return replay(existing, customer.email);
  }

  const quote = await buildQuote({ items, couponCode });
  const problems = quote.lines.filter((l) => l.status !== 'ok');
  if (problems.length) throw ApiError.conflict('Some items in your cart are no longer available in the quantity you chose. Please review your cart.', problems.map(unavailable));
  if (quote.coupon && !quote.coupon.valid) throw ApiError.badRequest(quote.coupon.error, [{ field: 'couponCode', message: quote.coupon.error }]);

  const orderData = () => ({
    user: user?._id, customer, shippingAddress, paymentMethod: 'cod',
    items: quote.lines.map((l) => ({ product: l.productId, name: l.name, slug: l.slug, image: l.image, size: l.size, color: l.color, unitPrice: l.unitPrice, quantity: l.quantity, lineTotal: l.lineTotal })),
    subtotal: quote.subtotal, couponCode: quote.coupon?.code, discount: quote.discount, shippingCost: quote.shipping, total: quote.total,
    couponRedeemed: Boolean(quote.coupon), ...(idempotencyKey && { idempotencyKey }),
  });

  /** One attempt. `session` is null on standalone MongoDB; this function may run more than once inside a transaction (retries). */
  const write = async (session) => {
    const opts = session ? { session } : {};
    const reserved = [];
    let couponId = null;
    try {
      for (const l of quote.lines) {
        if (!(await Product.reserveStock(l.productId, l.size, l.color, l.quantity, opts))) {
          throw ApiError.conflict(`${l.name} (${l.size} / ${l.color}) just sold out or has less stock than you asked for. Please review your cart.`, [{ field: 'items', message: `${l.name} (${l.size} / ${l.color}): stock changed`, productId: l.productId }]);
        }
        reserved.push(l);
      }
      if (quote.coupon) {
        if (!(await Coupon.redeem(quote.coupon.id, { ...opts, code: quote.coupon.code }))) {
          // Bound to the quoted code: if the coupon was renamed after the quote, the redemption fails rather than recording
          // usage under a code that no longer exists.
          const now = await Coupon.findById(quote.coupon.id).select('code').session(session ?? null).lean();
          if (!now || now.code !== quote.coupon.code) throw ApiError.badRequest('This coupon code is no longer valid. Please review your cart.', [{ field: 'couponCode', message: 'This coupon code is no longer valid' }]);
          throw ApiError.conflict('This coupon has just reached its usage limit.', [{ field: 'couponCode', message: 'This coupon has just reached its usage limit' }]);
        }
        couponId = quote.coupon.id;
      }
      return { order: await new Order(orderData()).save(opts), duplicate: false };
    } catch (err) {
      if (!session) await rollback(reserved, couponId); // with a transaction the database undoes every write itself
      throw err;
    }
  };

  for (let attempt = 0; ; attempt++) {
    try {
      return await runInTransaction(write);
    } catch (err) {
      if (err.code !== 11000) throw err;
      if (err.keyPattern?.idempotencyKey) { // a parallel request with the same key won (everything of ours is already undone): return its order
        return replay(await Order.findOne({ idempotencyKey }).select('+idempotencyKey'), customer.email);
      }
      if (attempt >= 4) throw err; // order-number collision: a fresh number is generated on the next attempt
    }
  }
}

/** Emails the confirmation and records the outcome honestly. Returns whether the mail server accepted it. */
export async function notifyOrderCreated(order) {
  const result = await sendOrderConfirmation(order);
  const status = result.sent ? 'sent' : result.reason === 'not_configured' ? 'not_configured' : 'failed';
  await Order.updateOne({ _id: order._id }, { confirmationEmail: status });
  return result.sent;
}

/**
 * Cancels an order exactly once. The status flip is one atomic conditional update, so if two cancels race only one wins,
 * and only the winner gives the stock back. With a transaction (replica set / Atlas) the flip, the stock restoration, the
 * coupon refund and the `stockRestoredAt` stamp commit together or not at all, so stock is also restored exactly once
 * through a crash. Without one, a crash between the flip and the restore leaves `stockRestoredAt` empty so it can be found.
 */
export async function cancelOrder(orderId, { by, byAdmin = false, note } = {}) {
  const allowed = byAdmin ? ADMIN_CANCELLABLE : CUSTOMER_CANCELLABLE;
  const cancelled = await runInTransaction(async (session) => {
    const opts = session ? { session } : {};
    const order = await Order.findOneAndUpdate(
      { _id: orderId, status: { $in: allowed } },
      { $set: { status: 'cancelled' }, $push: { statusHistory: { status: 'cancelled', at: new Date(), ...(by && { by }), ...(note && { note }) } } },
      { new: true, ...opts }
    );
    if (!order) return null;
    for (const i of order.items) await Product.releaseStock(i.product, i.size, i.color, i.quantity, opts);
    if (order.couponRedeemed && order.couponCode) {
      const c = await Coupon.findOne({ code: order.couponCode }).select('_id').session(session ?? null);
      if (c) await Coupon.unredeem(c._id, opts);
    }
    return Order.findByIdAndUpdate(order._id, { stockRestoredAt: new Date() }, { new: true, ...opts });
  });
  if (!cancelled) {
    const current = await Order.findById(orderId).select('status');
    if (!current) throw ApiError.notFound('Order not found');
    throw ApiError.conflict(current.status === 'cancelled' ? 'This order has already been cancelled.' : `This order can no longer be cancelled because it is ${current.status}.`);
  }
  return cancelled;
}

/** Admin status change along the allowed path only (pending > confirmed > processing > shipped > delivered). */
export async function changeStatus(orderId, to, { by, note } = {}) {
  if (to === 'cancelled') return cancelOrder(orderId, { by, byAdmin: true, note });
  const order = await Order.findById(orderId);
  if (!order) throw ApiError.notFound('Order not found');
  if (ORDER_FLOW[order.status] !== to) {
    const next = ORDER_FLOW[order.status];
    throw ApiError.conflict(next ? `An order that is ${order.status} can only move to ${next} (or be cancelled).` : `A ${order.status} order cannot change status.`);
  }
  const set = { status: to };
  if (to === 'delivered' && order.paymentMethod === 'cod') set.paymentStatus = 'paid'; // cash collected on delivery
  const updated = await Order.findOneAndUpdate(
    { _id: orderId, status: order.status },
    { $set: set, $push: { statusHistory: { status: to, at: new Date(), ...(by && { by }), ...(note && { note }) } } },
    { new: true }
  );
  if (!updated) throw ApiError.conflict('This order was just changed by someone else. Refresh and try again.');
  return updated;
}
