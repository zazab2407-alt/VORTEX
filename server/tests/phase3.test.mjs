// Phase 3 tests: no database required. Run with: npm test
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.MONGO_URI = 'mongodb://127.0.0.1:1/unused';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123';
process.env.CLIENT_URL = 'http://localhost:5173';

const { default: app } = await import('../src/app.js');
const { User, Category, Product, Order, Coupon, Review } = await import('../src/models/index.js');
const { generateOrderNumber } = await import('../src/utils/orderNumber.js');
const { cleanInput } = await import('../src/middleware/sanitize.js');
const bcrypt = (await import('bcryptjs')).default;

const failsOn = async (doc, path) => {
  const err = await doc.validate().then(() => null, (e) => e);
  assert.ok(err, `expected validation to fail on "${path}" but it passed`);
  assert.ok(err.errors[path], `expected an error on "${path}", got: ${Object.keys(err.errors).join(', ')}`);
  return err.errors[path].message;
};
const passes = (doc) => doc.validate();

describe('HTTP app', () => {
  let server, base;
  before(async () => { await new Promise((r) => { server = app.listen(0, r); }); base = `http://127.0.0.1:${server.address().port}`; });
  after(() => server.close());

  test('GET /api/health reports DB state as JSON (503 while disconnected)', async () => {
    const res = await fetch(`${base}/api/health`);
    const body = await res.json();
    assert.equal(res.status, 503);
    assert.equal(body.db, 'disconnected');
    assert.equal(body.service, 'vortex-api');
  });
  test('security headers set, x-powered-by hidden', async () => {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(res.headers.get('ratelimit-limit'), 'rate limit headers present');
  });
  test('unknown route -> consistent 404 JSON', async () => {
    const res = await fetch(`${base}/api/nope`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /Route not found/);
  });
  test('malformed JSON -> 400 JSON, not an HTML stack trace', async () => {
    const res = await fetch(`${base}/api/health`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' });
    assert.equal(res.status, 400);
    assert.match((await res.json()).message, /invalid JSON/);
  });
  test('oversized body (>10kb) -> 413', async () => {
    const res = await fetch(`${base}/api/health`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ x: 'a'.repeat(20000) }) });
    assert.equal(res.status, 413);
  });
  test('CORS: allowed origin echoed, other origins get no CORS header', async () => {
    const good = await fetch(`${base}/api/health`, { headers: { origin: 'http://localhost:5173' } });
    const bad = await fetch(`${base}/api/health`, { headers: { origin: 'https://evil.example' } });
    assert.equal(good.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.equal(bad.headers.get('access-control-allow-origin'), null);
  });
  test('NoSQL operator keys are stripped from input', () => {
    assert.deepEqual(cleanInput({ email: { $gt: '' }, ok: 'x', nested: [{ '$where': 'bad', fine: 1 }], 'a.b': 1 }), { email: {}, ok: 'x', nested: [{ fine: 1 }] });
  });
});

describe('User', () => {
  const valid = { name: 'Zeyad', email: 'Zeyad@Example.com', password: 'longenough1' };
  test('valid user passes; email is lower-cased; role defaults to customer', async () => {
    const u = new User(valid); await passes(u);
    assert.equal(u.email, 'zeyad@example.com'); assert.equal(u.role, 'customer');
  });
  test('rejects bad email, short password, unknown role', async () => {
    await failsOn(new User({ ...valid, email: 'nope' }), 'email');
    await failsOn(new User({ ...valid, password: 'short' }), 'password');
    await failsOn(new User({ ...valid, role: 'superuser' }), 'role');
  });
  test('comparePassword works with bcrypt hash; toJSON never leaks the password', async () => {
    const u = new User({ ...valid, password: await bcrypt.hash('longenough1', 4) });
    assert.equal(await u.comparePassword('longenough1'), true);
    assert.equal(await u.comparePassword('wrong-password'), false);
    assert.equal('password' in u.toJSON(), false);
  });
});

describe('Category & Coupon', () => {
  test('category slug is generated from the name', async () => {
    const c = new Category({ name: 'Hoodies & Jackets' }); await passes(c);
    assert.equal(c.slug, 'hoodies-and-jackets');
  });
  test('coupon: code upper-cased; percent bounds enforced', async () => {
    const c = new Coupon({ code: 'vortex10', type: 'percentage', value: 10 }); await passes(c);
    assert.equal(c.code, 'VORTEX10');
    await failsOn(new Coupon({ code: 'ABC', type: 'percentage', value: 0 }), 'value');
    await failsOn(new Coupon({ code: 'ABC', type: 'percentage', value: 101 }), 'value');
    await failsOn(new Coupon({ code: 'bad code!', type: 'percentage', value: 10 }), 'code');
  });
  test('coupon.check(): inactive, expired, used up, below minimum, valid', () => {
    const mk = (o) => new Coupon({ code: 'TEST', type: 'percentage', value: 10, ...o });
    assert.match(mk({ isActive: false }).check(100), /no longer active/);
    assert.match(mk({ expiresAt: new Date(Date.now() - 1000) }).check(100), /expired/);
    assert.match(mk({ usageLimit: 5, usedCount: 5 }).check(100), /usage limit/);
    assert.match(mk({ minSubtotal: 50 }).check(40), /minimum order of \$50\.00/);
    assert.equal(mk({ minSubtotal: 50, usageLimit: 5, usedCount: 4 }).check(60), null);
  });
});

describe('Product', () => {
  const catId = '64b7f0f0f0f0f0f0f0f0f0f0';
  const base = () => ({
    name: 'Flux High-Waist Leggings', description: 'Sculpting leggings.', price: 68, images: ['https://x/y.jpg'], category: catId, gender: 'women',
    sizes: ['S', 'M'], colors: [{ name: 'Black', hex: '#0A0A0A' }, { name: 'Navy', hex: '#1E293B' }],
    variants: [{ size: 'S', color: 'Black', stock: 5 }, { size: 'M', color: 'Black', stock: 0 }],
  });
  test('valid product: slug generated, virtuals correct', async () => {
    const p = new Product({ ...base(), salePrice: 49 }); await passes(p);
    assert.equal(p.slug, 'flux-high-waist-leggings');
    assert.equal(p.effectivePrice, 49);
    assert.equal(p.totalStock, 5);
    assert.equal(p.getStock('S', 'Black'), 5);
    assert.equal(p.getStock('M', 'Navy'), 0, 'unknown variant counts as 0 stock');
  });
  test('sale price must be lower than price', async () => {
    assert.match(await failsOn(new Product({ ...base(), salePrice: 68 }), 'salePrice'), /lower than the regular price/);
  });
  test('requires image, category, valid gender, sizes and colours', async () => {
    await failsOn(new Product({ ...base(), images: [] }), 'images');
    await failsOn(new Product({ ...base(), category: undefined }), 'category');
    await failsOn(new Product({ ...base(), gender: 'kids' }), 'gender');
    await failsOn(new Product({ ...base(), sizes: [], variants: [] }), 'sizes');
    await failsOn(new Product({ ...base(), colors: [], variants: [] }), 'colors');
  });
  test('rejects bad colour hex, negative or fractional stock', async () => {
    await failsOn(new Product({ ...base(), colors: [{ name: 'Black', hex: 'black' }], variants: [] }), 'colors.0.hex');
    await failsOn(new Product({ ...base(), variants: [{ size: 'S', color: 'Black', stock: -1 }] }), 'variants.0.stock');
    await failsOn(new Product({ ...base(), variants: [{ size: 'S', color: 'Black', stock: 1.5 }] }), 'variants.0.stock');
  });
  test('variants must reference real sizes/colours and be unique', async () => {
    await failsOn(new Product({ ...base(), variants: [{ size: 'XL', color: 'Black', stock: 1 }] }), 'variants');
    await failsOn(new Product({ ...base(), variants: [{ size: 'S', color: 'Pink', stock: 1 }] }), 'variants');
    await failsOn(new Product({ ...base(), variants: [{ size: 'S', color: 'Black', stock: 1 }, { size: 'S', color: 'Black', stock: 2 }] }), 'variants');
  });
  test('isNewArrival is true only for products created in the last 30 days', () => {
    assert.equal(new Product({ ...base(), createdAt: new Date() }).isNewArrival, true);
    assert.equal(new Product({ ...base(), createdAt: new Date(Date.now() - 60 * 864e5) }).isNewArrival, false);
  });
});

describe('Order', () => {
  const pid = '64b7f0f0f0f0f0f0f0f0f0f1';
  const base = () => ({
    customer: { fullName: 'Zeyad A', email: 'z@example.com', phone: '0100000000' },
    shippingAddress: { address: '1 Main St', city: 'Port Said' },
    items: [{ product: pid, name: 'Tee', size: 'M', color: 'Black', unitPrice: 34, quantity: 2, lineTotal: 68 }],
    subtotal: 68, discount: 6.8, shippingCost: 5, total: 66.2,
  });
  test('valid order: number generated, defaults are COD / pending / pending', async () => {
    const o = new Order(base()); await passes(o);
    assert.match(o.orderNumber, /^VTX-\d{6}-[A-Z2-9]{8}$/);
    assert.deepEqual([o.paymentMethod, o.paymentStatus, o.status], ['cod', 'pending', 'pending']);
  });
  test('rejects totals that do not add up (never trust submitted totals)', async () => {
    await failsOn(new Order({ ...base(), total: 10 }), 'total');
    await failsOn(new Order({ ...base(), subtotal: 50, total: 48.2 }), 'subtotal');
    const bad = base(); bad.items[0].lineTotal = 1;
    await failsOn(new Order({ ...bad, subtotal: 1, discount: 0, shippingCost: 0, total: 1 }), 'items');
    await failsOn(new Order({ ...base(), discount: 100, total: 0 }), 'discount');
  });
  test('rejects empty orders, zero quantity, missing customer fields, bad enums', async () => {
    await failsOn(new Order({ ...base(), items: [], subtotal: 0, discount: 0, shippingCost: 0, total: 0 }), 'items');
    const q = base(); q.items[0].quantity = 0; q.items[0].lineTotal = 0;
    await failsOn(new Order({ ...q, subtotal: 0, discount: 0, shippingCost: 0, total: 0 }), 'items.0.quantity');
    const c = base(); delete c.customer.phone;
    await failsOn(new Order(c), 'customer.phone');
    await failsOn(new Order({ ...base(), status: 'teleported' }), 'status');
    await failsOn(new Order({ ...base(), paymentMethod: 'bitcoin' }), 'paymentMethod');
  });
  test('order numbers: 5,000 generated, no collisions', () => {
    const set = new Set(Array.from({ length: 5000 }, () => generateOrderNumber()));
    assert.equal(set.size, 5000);
  });
});

describe('Review', () => {
  const base = { product: '64b7f0f0f0f0f0f0f0f0f0f1', user: '64b7f0f0f0f0f0f0f0f0f0f2', name: 'Omar', rating: 5, comment: 'Great' };
  test('valid review passes; rating must be a whole number from 1 to 5', async () => {
    await passes(new Review(base));
    await failsOn(new Review({ ...base, rating: 0 }), 'rating');
    await failsOn(new Review({ ...base, rating: 6 }), 'rating');
    await failsOn(new Review({ ...base, rating: 3.5 }), 'rating');
    await failsOn(new Review({ ...base, comment: '' }), 'comment');
  });
  test('one review per user per product is enforced by a unique index', () => {
    const idx = Review.schema.indexes().find(([f]) => f.product === 1 && f.user === 1);
    assert.ok(idx && idx[1].unique === true);
  });
});

describe('Error handler mapping', async () => {
  const { errorHandler } = await import('../src/middleware/errorHandler.js');
  const { default: ApiError } = await import('../src/utils/ApiError.js');
  const { default: mongoose } = await import('mongoose');
  const run = (err) => { let out; errorHandler(err, {}, { status(s) { out = { status: s }; return { json(b) { out.body = b; } }; } }, () => {}); return out; };

  test('ApiError keeps its status and message', () => {
    const r = run(ApiError.forbidden()); assert.equal(r.status, 403); assert.equal(r.body.success, false);
  });
  test('duplicate key (11000) -> 409 naming the field', () => {
    const r = run(Object.assign(new Error('dup'), { code: 11000, keyPattern: { email: 1 } }));
    assert.equal(r.status, 409); assert.equal(r.body.message, 'That email is already in use');
  });
  test('Mongoose validation error -> 400 with per-field list', async () => {
    const err = await new User({ name: 'x', email: 'bad', password: '1' }).validate().catch((e) => e);
    const r = run(err); assert.equal(r.status, 400); assert.ok(r.body.errors.some((e) => e.field === 'email'));
  });
  test('bad ObjectId (CastError) -> 400, JWT errors -> 401', () => {
    assert.equal(run(new mongoose.Error.CastError('ObjectId', 'abc', '_id')).status, 400);
    assert.equal(run(Object.assign(new Error('x'), { name: 'TokenExpiredError' })).status, 401);
  });
  test('unexpected errors -> 500', () => {
    const orig = console.error; console.error = () => {};
    try { assert.equal(run(new Error('boom')).status, 500); } finally { console.error = orig; }
  });
});
