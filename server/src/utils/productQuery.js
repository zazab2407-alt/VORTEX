/** Pure helpers that turn URL query parameters into MongoDB filters, sorts and paging. */
export const DEFAULT_LIMIT = 12;
export const MAX_LIMIT = 50;
export const NEW_ARRIVAL_DAYS = 30;

export const SORTS = {
  newest: { createdAt: -1, _id: -1 },
  best: { sold: -1, _id: 1 },
  'price-asc': { effectivePrice: 1, _id: 1 },
  'price-desc': { effectivePrice: -1, _id: 1 },
}; // _id is always the tie-breaker so pages never repeat or skip items

export const COLLECTIONS = ['new', 'best', 'sale'];
export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Matches the term at the start of any word ("hood" finds "Hoodie", but "tee" does not find "steel"). */
export const wordStartRegex = (term) => new RegExp(`(^|[^a-z0-9])${escapeRegex(term)}`, 'i');

export function parsePaging(q = {}) {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(q.limit, 10) || DEFAULT_LIMIT));
  return { page, limit, skip: (page - 1) * limit };
}

export function pageMeta({ page, limit }, total) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), hasNext: page * limit < total, hasPrev: page > 1 };
}

/** `extra` carries things that need a database lookup first: { categoryId, searchCategoryIds }. */
export function buildFilter(q = {}, extra = {}) {
  const and = extra.includeInactive ? [] : [{ isActive: true }];

  if (q.gender) and.push({ gender: q.gender === 'unisex' || q.exactGender ? q.gender : { $in: [q.gender, 'unisex'] } });
  if (extra.categoryId) and.push({ category: extra.categoryId });
  if (q.size) and.push({ sizes: q.size });
  if (q.color) and.push({ 'colors.name': q.color });
  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    const range = {};
    if (q.minPrice !== undefined) range.$gte = q.minPrice;
    if (q.maxPrice !== undefined) range.$lte = q.maxPrice;
    and.push({ effectivePrice: range });
  }
  if (q.collection === 'new') and.push({ createdAt: { $gte: new Date(Date.now() - NEW_ARRIVAL_DAYS * 864e5) } });
  if (q.collection === 'best') and.push({ isFeatured: true });
  if (q.collection === 'sale') and.push({ salePrice: { $exists: true, $ne: null } });
  if (q.ids?.length) and.push({ _id: { $in: q.ids } });

  const term = typeof q.q === 'string' ? q.q.trim() : '';
  if (term) {
    const rx = wordStartRegex(term);
    const or = [{ name: rx }, { description: rx }];
    if (extra.searchCategoryIds?.length) or.push({ category: { $in: extra.searchCategoryIds } });
    and.push({ $or: or });
  }
  if (and.length === 0) return {};
  return and.length === 1 ? and[0] : { $and: and };
}
