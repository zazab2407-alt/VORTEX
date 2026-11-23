import { Category, Order, Product, User } from '../models/index.js';
import { nextStatuses } from '../models/Order.js';
import { escapeRegex } from '../utils/productQuery.js';
import { changeStatus } from '../services/orderService.js';
import { serializeOrder } from '../utils/serializers.js';
import { parsePaging, pageMeta } from '../utils/productQuery.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { serializeCategory, serializeOrderSummary, serializeProduct } from '../utils/serializers.js';
import { listProducts, productPopulate } from '../services/productService.js';
import { saveProductImage } from '../services/imageService.js';

export const LOW_STOCK_THRESHOLD = 5;

export const stats = asyncHandler(async (_req, res) => {
  const lowStockRows = (extra) => [{ $match: { isActive: true } }, { $unwind: '$variants' }, { $match: { 'variants.stock': { $lte: LOW_STOCK_THRESHOLD } } }, ...extra];
  const [orders, revenue, products, customers, recent, best, pending, lowStock, lowStockCount] = await Promise.all([
    Order.countDocuments(),
    Order.aggregate([{ $match: { status: { $ne: 'cancelled' } } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
    Product.countDocuments(),
    User.countDocuments({ role: 'customer', isActive: true }), // demo reviewers are inactive, so they are not counted
    Order.find().sort({ createdAt: -1 }).limit(5).lean(),
    Product.find({ sold: { $gt: 0 } }).sort({ sold: -1, _id: 1 }).limit(5).select('name slug sold price salePrice images').lean(),
    Order.countDocuments({ status: 'pending' }),
    Product.aggregate(lowStockRows([{ $sort: { 'variants.stock': 1, name: 1 } }, { $limit: 10 }, { $project: { name: 1, slug: 1, size: '$variants.size', color: '$variants.color', stock: '$variants.stock' } }])),
    Product.aggregate(lowStockRows([{ $count: 'n' }])),
  ]);
  res.json({
    success: true,
    data: {
      totals: { orders, revenue: Math.round((revenue[0]?.total ?? 0) * 100) / 100, products, customers, pendingOrders: pending },
      lowStock: { threshold: LOW_STOCK_THRESHOLD, total: lowStockCount[0]?.n ?? 0, items: lowStock.map((r) => ({ id: String(r._id), name: r.name, slug: r.slug, size: r.size, color: r.color, stock: r.stock })) },
      recentOrders: recent.map(serializeOrderSummary),
      bestSellers: best.map((p) => ({ id: String(p._id), name: p.name, slug: p.slug, sold: p.sold, price: p.salePrice ?? p.price, image: p.images[0] })),
    },
  });
});

/** Same filters as the shop, but includes hidden (inactive) products. */
export const listAllProducts = asyncHandler(async (req, res) => {
  const { items, meta } = await listProducts(req.query, { includeInactive: true });
  res.json({ success: true, data: items.map((p) => serializeProduct(p)), meta });
});

export const getAnyProduct = asyncHandler(async (req, res) => {
  const p = await Product.findById(req.params.id).populate(productPopulate).lean();
  if (!p) throw ApiError.notFound('Product not found');
  res.json({ success: true, data: serializeProduct(p) });
});

export const listAllCategories = asyncHandler(async (_req, res) => {
  const [cats, rows] = await Promise.all([Category.find().sort({ name: 1 }).lean(), Product.aggregate([{ $group: { _id: '$category', n: { $sum: 1 } } }])]);
  const counts = new Map(rows.map((r) => [String(r._id), r.n]));
  res.json({ success: true, data: cats.map((c) => serializeCategory(c, counts.get(String(c._id)) ?? 0)) });
});

export const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Choose an image to upload (form field "image")');
  res.status(201).json({ success: true, data: await saveProductImage(req.file.buffer) });
});

/** Orders list: search by order number / customer name, email or phone, filter by status and date range (UTC days). */
export const listOrders = asyncHandler(async (req, res) => {
  const { q, status, from, to, sort } = req.query;
  const paging = parsePaging(req.query);
  const filter = {};
  if (status) filter.status = status;
  if (from || to) filter.createdAt = { ...(from && { $gte: new Date(`${from}T00:00:00.000Z`) }), ...(to && { $lte: new Date(`${to}T23:59:59.999Z`) }) };
  const term = typeof q === 'string' ? q.trim() : '';
  if (term) {
    const rx = new RegExp(escapeRegex(term), 'i');
    filter.$or = [{ orderNumber: rx }, { 'customer.fullName': rx }, { 'customer.email': rx }, { 'customer.phone': rx }];
  }
  const [rows, total] = await Promise.all([
    Order.find(filter).sort(sort === 'oldest' ? { createdAt: 1, _id: 1 } : { createdAt: -1, _id: -1 }).skip(paging.skip).limit(paging.limit).lean(),
    Order.countDocuments(filter),
  ]);
  res.json({ success: true, data: rows.map(serializeOrderRow), meta: pageMeta(paging, total) });
});

const serializeOrderRow = (o) => ({
  id: String(o._id), orderNumber: o.orderNumber, status: o.status, paymentMethod: o.paymentMethod, paymentStatus: o.paymentStatus, total: o.total,
  itemCount: o.items.reduce((s, i) => s + i.quantity, 0), createdAt: new Date(o.createdAt).toISOString(),
  customer: { fullName: o.customer.fullName, email: o.customer.email, phone: o.customer.phone }, city: o.shippingAddress.city, isGuest: !o.user,
});

export const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('statusHistory.by', 'name').lean();
  if (!order) throw ApiError.notFound('Order not found');
  res.json({ success: true, data: { ...serializeOrder(order, { admin: true }), nextStatuses: nextStatuses(order.status) } });
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  await changeStatus(req.params.id, req.body.status, { by: req.user._id, note: req.body.note });
  const order = await Order.findById(req.params.id).populate('statusHistory.by', 'name').lean();
  res.json({ success: true, data: { ...serializeOrder(order, { admin: true }), nextStatuses: nextStatuses(order.status) } });
});
