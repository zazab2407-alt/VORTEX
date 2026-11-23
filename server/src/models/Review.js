import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    rating: { type: Number, required: [true, 'Rating is required'], min: [1, 'Rating must be between 1 and 5'], max: [5, 'Rating must be between 1 and 5'], validate: { validator: Number.isInteger, message: 'Rating must be a whole number' } },
    title: { type: String, trim: true, maxlength: 100 },
    comment: { type: String, required: [true, 'Please write a short review'], trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

// One review per customer per product
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

/** Recomputes the product's average rating and review count from its reviews. */
reviewSchema.statics.recalculate = async function recalculate(productId) {
  const [stats] = await this.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId) } },
    { $group: { _id: '$product', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await this.model('Product').updateOne(
    { _id: productId },
    { rating: stats ? Math.round(stats.avg * 10) / 10 : 0, reviewCount: stats ? stats.count : 0 }
  );
};

reviewSchema.post('save', function afterSave() { return this.constructor.recalculate(this.product); });
reviewSchema.post('deleteOne', { document: true, query: false }, function afterDelete() { return this.constructor.recalculate(this.product); });

export default mongoose.model('Review', reviewSchema);
