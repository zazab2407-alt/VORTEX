import mongoose from 'mongoose';
import slugify from 'slugify';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Category name is required'], unique: true, trim: true, maxlength: 60 },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 500 },
    image: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

categorySchema.pre('validate', function makeSlug(next) {
  if (this.name && (this.isNew || this.isModified('name'))) this.slug = slugify(this.name, { lower: true, strict: true });
  next();
});

export default mongoose.model('Category', categorySchema);
