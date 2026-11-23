/** Turns database documents into the exact JSON shape the storefront consumes. Accepts lean objects or documents. */
const NEW_ARRIVAL_DAYS = 30;
const plain = (d) => (d && typeof d.toObject === 'function' ? d.toObject() : d);

export function serializeProduct(doc, { reviews } = {}) {
  const p = plain(doc);
  const stock = {};
  for (const v of p.variants ?? []) stock[`${v.size}|${v.color}`] = v.stock;
  const cat = p.category && typeof p.category === 'object' && 'name' in p.category ? p.category : null;
  const created = p.createdAt ? new Date(p.createdAt) : null;
  const out = {
    id: String(p._id),
    slug: p.slug,
    name: p.name,
    description: p.description,
    price: p.price,
    images: p.images,
    category: cat ? cat.name : undefined,
    categorySlug: cat ? cat.slug : undefined,
    categoryId: String(cat ? cat._id : p.category),
    gender: p.gender,
    sizes: p.sizes,
    colors: p.colors.map((c) => ({ name: c.name, hex: c.hex })),
    stock,
    totalStock: Object.values(stock).reduce((s, n) => s + n, 0),
    rating: p.rating,
    reviewCount: p.reviewCount,
    sold: p.sold,
    isNew: created ? Date.now() - created.getTime() < NEW_ARRIVAL_DAYS * 864e5 : false,
    isBestSeller: Boolean(p.isFeatured), // "featured" is the merchandising flag that powers Best Sellers
    isFeatured: Boolean(p.isFeatured),
    isActive: p.isActive !== false,
    createdAt: created ? created.toISOString() : undefined,
  };
  if (p.salePrice != null) out.salePrice = p.salePrice;
  if (reviews) out.reviews = reviews.map(serializeReview);
  return out;
}

export function serializeReview(doc) {
  const r = plain(doc);
  return { id: String(r._id), author: r.name, rating: r.rating, title: r.title ?? '', comment: r.comment, date: new Date(r.createdAt).toISOString() };
}

export function serializeCategory(doc, productCount) {
  const c = plain(doc);
  const out = { id: String(c._id), name: c.name, slug: c.slug, description: c.description ?? '', image: c.image ?? '', isActive: c.isActive !== false };
  if (productCount !== undefined) out.productCount = productCount;
  return out;
}

export function serializeUser(doc) {
  const u = plain(doc);
  return { id: String(u._id), name: u.name, email: u.email, role: u.role, phone: u.phone ?? '', address: u.address ?? '', city: u.city ?? '', createdAt: new Date(u.createdAt).toISOString() };
}

const CUSTOMER_CANCELLABLE_LIST = ['pending', 'confirmed'];

export function serializeOrderSummary(doc) {
  const o = plain(doc);
  return {
    id: String(o._id), orderNumber: o.orderNumber, status: o.status, paymentMethod: o.paymentMethod, paymentStatus: o.paymentStatus,
    total: o.total, canCancel: CUSTOMER_CANCELLABLE_LIST.includes(o.status), itemCount: o.items.reduce((s, i) => s + i.quantity, 0), items: o.items.map((i) => ({ name: i.name, size: i.size, color: i.color, quantity: i.quantity })),
    createdAt: new Date(o.createdAt).toISOString(), customerName: o.customer?.fullName,
  };
}

const CUSTOMER_CANCELLABLE = ['pending', 'confirmed'];

/** Full order as the owner (or a guest with the order number + email) sees it. `admin` adds who changed each status. */
export function serializeOrder(doc, { admin = false } = {}) {
  const o = plain(doc);
  return {
    id: String(o._id), orderNumber: o.orderNumber, status: o.status, paymentMethod: o.paymentMethod, paymentStatus: o.paymentStatus,
    customer: { fullName: o.customer.fullName, email: o.customer.email, phone: o.customer.phone },
    shippingAddress: { address: o.shippingAddress.address, city: o.shippingAddress.city, notes: o.shippingAddress.notes ?? '' },
    items: o.items.map((i) => ({ productId: String(i.product), name: i.name, slug: i.slug, image: i.image, size: i.size, color: i.color, unitPrice: i.unitPrice, quantity: i.quantity, lineTotal: i.lineTotal })),
    subtotal: o.subtotal, couponCode: o.couponCode ?? null, discount: o.discount, shippingCost: o.shippingCost, total: o.total,
    createdAt: new Date(o.createdAt).toISOString(),
    statusHistory: (o.statusHistory ?? []).map((h) => ({ status: h.status, at: new Date(h.at).toISOString(), ...(h.note && { note: h.note }), ...(admin && h.by && { by: typeof h.by === 'object' && h.by.name ? h.by.name : String(h.by) }) })),
    canCancel: CUSTOMER_CANCELLABLE.includes(o.status),
    ...(admin && { userId: o.user ? String(o.user) : null, isGuest: !o.user, confirmationEmail: o.confirmationEmail ?? null, stockRestoredAt: o.stockRestoredAt ?? null }),
  };
}
