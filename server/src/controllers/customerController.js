import { Order, User } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { round2 } from '../utils/money.js';
import { escapeRegex, pageMeta, parsePaging } from '../utils/productQuery.js';
import { serializeOrderSummary } from '../utils/serializers.js';
import { OBJECT_ID } from '../utils/objectId.js';

const DEMO_EMAIL = /@demo\.vortex\.test$/; // seeded review authors: not real customers
/** Only real customer accounts are manageable here: admins and demo reviewers are excluded by the query itself. */
const customersOnly = () => ({ role: 'customer', email: { $not: DEMO_EMAIL } });

/** Allow-list serializer: password hash, tokenVersion, role and any other internal field can never leak through it. */
function serializeCustomer(doc, stats) {
  const u = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    id: String(u._id), name: u.name, email: u.email, phone: u.phone ?? '', address: u.address ?? '', city: u.city ?? '',
    isActive: u.isActive !== false, createdAt: new Date(u.createdAt).toISOString(),
    orderCount: stats?.orderCount ?? 0, totalSpent: round2(stats?.totalSpent ?? 0), lastOrderAt: stats?.lastOrderAt ? new Date(stats.lastOrderAt).toISOString() : null,
  };
}

/** Cancelled orders count as orders but not as money spent. */
const statsFor = async (ids) => {
  const rows = await Order.aggregate([
    { $match: { user: { $in: ids } } },
    { $group: { _id: '$user', orderCount: { $sum: 1 }, totalSpent: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 0, '$total'] } }, lastOrderAt: { $max: '$createdAt' } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r]));
};

export const listCustomers = asyncHandler(async (req, res) => {
  const paging = parsePaging(req.query);
  const filter = customersOnly();
  const term = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (term) { const rx = new RegExp(escapeRegex(term), 'i'); filter.$or = [{ name: rx }, { email: rx }, { phone: rx }]; }
  if (req.query.status) filter.isActive = req.query.status === 'active';

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1, _id: -1 }).skip(paging.skip).limit(paging.limit).lean(),
    User.countDocuments(filter),
  ]);
  const stats = await statsFor(users.map((u) => u._id));
  res.json({ success: true, data: users.map((u) => serializeCustomer(u, stats.get(String(u._id)))), meta: pageMeta(paging, total) });
});

const loadCustomer = async (id) => {
  const u = OBJECT_ID.test(id) ? await User.findOne({ _id: id, ...customersOnly() }) : null;
  if (!u) throw ApiError.notFound('Customer not found');
  return u;
};

const HISTORY_LIMIT = 50;

export const getCustomer = asyncHandler(async (req, res) => {
  const u = await loadCustomer(req.params.id);
  const [orders, stats] = await Promise.all([
    Order.find({ user: u._id }).sort({ createdAt: -1 }).limit(HISTORY_LIMIT).lean(),
    statsFor([u._id]),
  ]);
  const s = stats.get(String(u._id));
  res.json({ success: true, data: { customer: serializeCustomer(u, s), orders: orders.map(serializeOrderSummary), ordersShown: orders.length, ordersTotal: s?.orderCount ?? 0 } });
});

export const setCustomerStatus = asyncHandler(async (req, res) => {
  if (String(req.user._id) === req.params.id) throw ApiError.badRequest('You cannot change the status of your own account.');
  const u = await loadCustomer(req.params.id);
  u.isActive = req.body.isActive;
  await u.save(); // takes effect immediately: the login check reloads the account on every request
  res.json({ success: true, data: serializeCustomer(u, (await statsFor([u._id])).get(String(u._id))) });
});
