import { Product, Category, Review } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { isObjectId } from '../utils/objectId.js';
import { serializeProduct } from '../utils/serializers.js';
import { listProducts, productPopulate } from '../services/productService.js';
import { deleteUploadIfUnused } from '../services/imageService.js';

const EDITABLE = ['name', 'description', 'price', 'salePrice', 'images', 'category', 'gender', 'sizes', 'colors', 'variants', 'isFeatured', 'isActive'];
const pick = (src) => Object.fromEntries(EDITABLE.filter((k) => src[k] !== undefined).map((k) => [k, src[k]])); // never trust sold/rating/slug etc. from the client

const byKey = (key) => (isObjectId(key) ? { $or: [{ _id: key }, { slug: key.toLowerCase() }] } : { slug: String(key).toLowerCase() });
const findPublic = (key) => Product.findOne({ ...byKey(key), isActive: true }).populate(productPopulate).lean();
const withCategory = (id) => Product.findById(id).populate(productPopulate);

async function assertCategory(id) {
  if (!(await Category.exists({ _id: id }))) throw ApiError.badRequest('That category does not exist', [{ field: 'category', message: 'That category does not exist' }]);
}

/** One zero-stock row per size/colour, so inventory can be edited straight away. */
const blankVariants = (sizes, colors) => sizes.flatMap((size) => colors.map((c) => ({ size, color: c.name, stock: 0 })));

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await listProducts(req.query);
  res.json({ success: true, data: items.map((p) => serializeProduct(p)), meta });
});

export const getOne = asyncHandler(async (req, res) => {
  const product = await findPublic(req.params.idOrSlug);
  if (!product) throw ApiError.notFound('Product not found');
  const reviews = await Review.find({ product: product._id }).sort({ createdAt: -1, _id: -1 }).limit(6).lean();
  res.json({ success: true, data: serializeProduct(product, { reviews }) });
});

export const related = asyncHandler(async (req, res) => {
  const base = await findPublic(req.params.idOrSlug);
  if (!base) throw ApiError.notFound('Product not found');
  const limit = req.query.limit ?? 4;
  const baseCat = base.category?._id;
  const sameCategory = await Product.find({ _id: { $ne: base._id }, isActive: true, category: baseCat }).populate(productPopulate).sort({ sold: -1, _id: 1 }).limit(limit).lean();
  let items = sameCategory;
  if (items.length < limit) {
    const others = await Product.find({ _id: { $nin: [base._id, ...items.map((i) => i._id)] }, isActive: true }).populate(productPopulate).sort({ sold: -1, _id: 1 }).limit(limit - items.length).lean();
    items = [...items, ...others];
  }
  res.json({ success: true, data: items.map((p) => serializeProduct(p)) });
});

export const create = asyncHandler(async (req, res) => {
  const data = pick(req.body);
  await assertCategory(data.category);
  data.slug = await Product.generateUniqueSlug(data.name);
  if (!data.variants) data.variants = blankVariants(data.sizes, data.colors);
  const created = await Product.create(data);
  res.status(201).json({ success: true, data: serializeProduct(await withCategory(created._id)) });
});

export const update = asyncHandler(async (req, res) => {
  const doc = await Product.findById(req.params.id);
  if (!doc) throw ApiError.notFound('Product not found');
  const data = pick(req.body);
  if (data.category) await assertCategory(data.category);
  // sizes/colours changed without new variants: keep matching rows, add blank rows for new combinations
  if ((data.sizes || data.colors) && !data.variants) {
    const sizes = data.sizes ?? doc.sizes;
    const colors = data.colors ?? doc.colors;
    const have = new Map(doc.variants.map((v) => [`${v.size}|${v.color}`, v.stock]));
    data.variants = blankVariants(sizes, colors).map((v) => ({ ...v, stock: have.get(`${v.size}|${v.color}`) ?? 0 }));
  }
  const oldImages = [...doc.images];
  doc.set(data);
  await doc.save();
  if (data.images) for (const url of oldImages.filter((u) => !doc.images.includes(u))) await deleteUploadIfUnused(url); // save() (not update queries) so schema validation and effectivePrice sync always run
  res.json({ success: true, data: serializeProduct(await withCategory(doc._id)) });
});

export const setStock = asyncHandler(async (req, res) => {
  const { size, color, stock } = req.body;
  const doc = await Product.findById(req.params.id);
  if (!doc) throw ApiError.notFound('Product not found');
  if (!doc.sizes.includes(size) || !doc.colors.some((c) => c.name === color)) {
    throw ApiError.badRequest(`${size} / ${color} is not a size and colour of this product`);
  }
  // Atomic: concurrent orders decrementing other variants are never overwritten
  const res1 = await Product.updateOne({ _id: doc._id, variants: { $elemMatch: { size, color } } }, { $set: { 'variants.$.stock': stock } });
  if (res1.matchedCount === 0) {
    await Product.updateOne({ _id: doc._id, variants: { $not: { $elemMatch: { size, color } } } }, { $push: { variants: { size, color, stock } } });
  }
  res.json({ success: true, data: serializeProduct(await withCategory(doc._id)) });
});

export const remove = asyncHandler(async (req, res) => {
  const doc = await Product.findById(req.params.id);
  if (!doc) throw ApiError.notFound('Product not found');
  await Review.deleteMany({ product: doc._id });
  await doc.deleteOne();
  for (const url of doc.images) await deleteUploadIfUnused(url);
  res.json({ success: true, message: 'Product deleted' });
});
