import { Order } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { serializeOrder, serializeOrderSummary } from '../utils/serializers.js';
import { cancelOrder, createOrder, notifyOrderCreated } from '../services/orderService.js';

const NOT_FOUND = 'We could not find an order matching those details';

/** Places an order for a logged-in customer or a guest. Only whitelisted fields are read; prices are never accepted. */
export const create = asyncHandler(async (req, res) => {
  const { items, couponCode, customer, shippingAddress, idempotencyKey } = req.body;
  const input = {
    items: items.map(({ productId, size, color, quantity }) => ({ productId, size, color, quantity })),
    couponCode,
    customer: { fullName: customer.fullName, email: customer.email, phone: customer.phone },
    shippingAddress: { address: shippingAddress.address, city: shippingAddress.city, ...(shippingAddress.notes && { notes: shippingAddress.notes }) },
    idempotencyKey,
  };
  const { order, duplicate } = await createOrder(input, req.user);
  const emailSent = duplicate ? false : await notifyOrderCreated(order); // true only if the mail server accepted the message
  res.status(duplicate ? 200 : 201).json({ success: true, data: { order: serializeOrder(order), emailSent, duplicate } });
});

export const mine = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50).lean();
  res.json({ success: true, data: orders.map(serializeOrderSummary) });
});

const findOwn = async (req) => {
  const order = await Order.findOne({ orderNumber: req.params.orderNumber, user: req.user._id });
  if (!order) throw ApiError.notFound('Order not found'); // someone else's order looks exactly like a missing one
  return order;
};

export const getMine = asyncHandler(async (req, res) => res.json({ success: true, data: serializeOrder(await findOwn(req)) }));

export const cancelMine = asyncHandler(async (req, res) => {
  const order = await findOwn(req);
  res.json({ success: true, data: serializeOrder(await cancelOrder(order._id, { by: req.user._id })) });
});

/** Guest tracking: the order number AND the email used at checkout must both match. Failures are all the same generic 404. */
const findByLookup = async ({ orderNumber, email }) => {
  const order = await Order.findOne({ orderNumber, 'customer.email': email.trim().toLowerCase() });
  if (!order) throw ApiError.notFound(NOT_FOUND);
  return order;
};
export const lookup = asyncHandler(async (req, res) => res.json({ success: true, data: serializeOrder(await findByLookup(req.body)) }));
export const cancelLookup = asyncHandler(async (req, res) => {
  const order = await findByLookup(req.body);
  res.json({ success: true, data: serializeOrder(await cancelOrder(order._id)) });
});
