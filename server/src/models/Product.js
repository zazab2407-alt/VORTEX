import mongoose from 'mongoose';
import slugify from 'slugify';

export const GENDERS = ['men', 'women', 'unisex'];
const NEW_ARRIVAL_DAYS = 30;

const colorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    hex: { type: String, required: true, match: [/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, 'Colour must be a hex value like #FF5A1F'] },
  },
  { _id: false }
);

/** Stock lives at variant level: one row per size + colour combination. */
const variantSchema = new mongoose.Schema(
  {
    size: { type: String, required: true, trim: true },
    color: { type: String, required: true, trim: true },
    stock: { type: Number, required: true, min: [0, 'Stock cannot be negative'], default: 0, validate: { validator: Number.isInteger, message: 'Stock must be a whole number' } },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Product name is required'], trim: true, maxlength: 120 },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    description: { type: String, required: [true, 'Description is required'], trim: true, maxlength: 2000 },
    price: { type: Number, required: [true, 'Price is required'], min: [0, 'Price cannot be negative'] },
    salePrice: {
      type: Number, min: [0, 'Sale price cannot be negative'],
      validate: { validator(v) { return v == null || v < this.price; }, message: 'Sale price must be lower than the regular price' },
    },
    images: {
      type: [String],
      validate: [
        { validator: (v) => v.length >= 1, message: 'At least one product image is required' },
        { validator: (v) => v.length <= 10, message: 'A product can have at most 10 images' },
      ],
    },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: [true, 'Category is required'], index: true },
    gender: { type: String, enum: { values: GENDERS, message: 'Gender must be men, women or unisex' }, required: true, index: true },
    sizes: { type: [String], validate: { validator: (v) => v.length >= 1, message: 'At least one size is required' } },
    colors: { type: [colorSchema], validate: { validator: (v) => v.length >= 1, message: 'At least one colour is required' } },
    variants: { type: [variantSchema], default: [] },
    /** Kept in sync automatically (salePrice ?? price) so the shop can filter and sort by what customers actually pay. */
    effectivePrice: { type: Number, min: 0, index: true },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    sold: { type: Number, default: 0, min: 0 },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ price: 1 });
productSchema.index({ sold: -1 });
productSchema.index({ isFeatured: 1 });
productSchema.index({ isActive: 1, createdAt: -1 });

productSchema.virtual('totalStock').get(function totalStock() { return this.variants.reduce((s, v) => s + v.stock, 0); });
// NB: not called "isNew" - that name is reserved by Mongoose (it means "not saved yet")
productSchema.virtual('isNewArrival').get(function isNewArrival() { return this.createdAt ? Date.now() - this.createdAt.getTime() < NEW_ARRIVAL_DAYS * 864e5 : false; });

productSchema.pre('validate', function checkProduct(next) {
  if (!this.slug && this.name) this.slug = slugify(this.name, { lower: true, strict: true });
  this.effectivePrice = this.salePrice ?? this.price;

  const sizes = new Set(this.sizes);
  const colors = new Set(this.colors.map((c) => c.name));
  const seen = new Set();
  for (const v of this.variants) {
    const key = `${v.size}|${v.color}`;
    if (!sizes.has(v.size)) this.invalidate('variants', `Variant size "${v.size}" is not one of the product sizes`);
    else if (!colors.has(v.color)) this.invalidate('variants', `Variant colour "${v.color}" is not one of the product colours`);
    else if (seen.has(key)) this.invalidate('variants', `Duplicate variant ${v.size} / ${v.color}`);
    seen.add(key);
  }
  next();
});

productSchema.methods.getStock = function getStock(size, color) {
  return this.variants.find((v) => v.size === size && v.color === color)?.stock ?? 0;
};

/** Finds a slug not used by another product: "name", "name-2", "name-3"... */
productSchema.statics.generateUniqueSlug = async function generateUniqueSlug(name, ignoreId) {
  const base = slugify(name, { lower: true, strict: true }) || 'product';
  let slug = base;
  for (let i = 2; await this.exists({ slug, ...(ignoreId && { _id: { $ne: ignoreId } }) }); i += 1) slug = `${base}-${i}`;
  return slug;
};

/**
 * Atomically takes `qty` units of one variant. Returns false (and changes nothing) if the variant
 * does not have enough stock, so two shoppers can never buy the last unit at the same time.
 */
productSchema.statics.reserveStock = async function reserveStock(productId, size, color, qty, options = {}) {
  const res = await this.updateOne(
    { _id: productId, isActive: true, variants: { $elemMatch: { size, color, stock: { $gte: qty } } } },
    { $inc: { 'variants.$.stock': -qty, sold: qty } },
    options
  );
  return res.modifiedCount === 1;
};

/** Puts units back (order cancelled, or a later item in the same order failed). */
productSchema.statics.releaseStock = async function releaseStock(productId, size, color, qty, options = {}) {
  await this.updateOne(
    { _id: productId, variants: { $elemMatch: { size, color } } },
    { $inc: { 'variants.$.stock': qty, sold: -qty } },
    options
  );
};

export default mongoose.model('Product', productSchema);
