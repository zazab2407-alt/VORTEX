import { Product, Category } from '../models/index.js';
import { buildFilter, escapeRegex, pageMeta, parsePaging, SORTS, wordStartRegex } from '../utils/productQuery.js';

const POPULATE = { path: 'category', select: 'name slug' };

/** A category may be given by slug or by (case-insensitive) name. */
export async function resolveCategory(value) {
  if (!value) return null;
  return Category.findOne({ $or: [{ slug: String(value).toLowerCase() }, { name: new RegExp(`^${escapeRegex(String(value))}$`, 'i') }] }).select('_id');
}

export async function listProducts(q, { includeInactive = false } = {}) {
  const paging = parsePaging(q);
  const extra = { includeInactive };

  if (q.category) {
    const cat = await resolveCategory(q.category);
    if (!cat) return { items: [], meta: pageMeta(paging, 0) }; // unknown category = nothing matches
    extra.categoryId = cat._id;
  }
  const term = typeof q.q === 'string' ? q.q.trim() : '';
  if (term) {
    const cats = await Category.find({ name: wordStartRegex(term) }).select('_id');
    extra.searchCategoryIds = cats.map((c) => c._id);
  }

  const filter = buildFilter(q, extra);
  const [items, total] = await Promise.all([
    Product.find(filter).populate(POPULATE).sort(SORTS[q.sort] ?? SORTS.newest).skip(paging.skip).limit(paging.limit).lean(),
    Product.countDocuments(filter),
  ]);
  return { items, meta: pageMeta(paging, total) };
}

export const productPopulate = POPULATE;
