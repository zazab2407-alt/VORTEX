import { Category, Product } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { isObjectId } from '../utils/objectId.js';
import { serializeCategory } from '../utils/serializers.js';

const EDITABLE = ['name', 'description', 'image', 'isActive'];
const pick = (src) => Object.fromEntries(EDITABLE.filter((k) => src[k] !== undefined).map((k) => [k, src[k]]));
const byKey = (key) => (isObjectId(key) ? { $or: [{ _id: key }, { slug: key.toLowerCase() }] } : { slug: String(key).toLowerCase() });

async function counts() {
  const rows = await Product.aggregate([{ $match: { isActive: true } }, { $group: { _id: '$category', n: { $sum: 1 } } }]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

export const list = asyncHandler(async (_req, res) => {
  const [cats, n] = await Promise.all([Category.find({ isActive: true }).sort({ name: 1 }).lean(), counts()]);
  res.json({ success: true, data: cats.map((c) => serializeCategory(c, n.get(String(c._id)) ?? 0)) });
});

export const getOne = asyncHandler(async (req, res) => {
  const cat = await Category.findOne({ ...byKey(req.params.idOrSlug), isActive: true }).lean();
  if (!cat) throw ApiError.notFound('Category not found');
  res.json({ success: true, data: serializeCategory(cat, (await counts()).get(String(cat._id)) ?? 0) });
});

export const create = asyncHandler(async (req, res) => {
  const cat = await Category.create(pick(req.body));
  res.status(201).json({ success: true, data: serializeCategory(cat, 0) });
});

export const update = asyncHandler(async (req, res) => {
  const cat = await Category.findById(req.params.id);
  if (!cat) throw ApiError.notFound('Category not found');
  cat.set(pick(req.body));
  await cat.save();
  res.json({ success: true, data: serializeCategory(cat, (await counts()).get(String(cat._id)) ?? 0) });
});

export const remove = asyncHandler(async (req, res) => {
  const cat = await Category.findById(req.params.id);
  if (!cat) throw ApiError.notFound('Category not found');
  const inUse = await Product.countDocuments({ category: cat._id });
  if (inUse > 0) throw ApiError.conflict(`This category still has ${inUse} product${inUse === 1 ? '' : 's'}. Move or delete them first.`);
  await cat.deleteOne();
  res.json({ success: true, message: 'Category deleted' });
});
