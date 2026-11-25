// Products & categories API: real HTTP requests against the Express app and a real MongoDB, using the seeded catalogue.
// Runs only when MONGO_TEST_URI is set (see db.test.mjs).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { testUri, makeCall, login } from './helpers.mjs';

const uri = testUri('api');
const skip = !uri && 'set MONGO_TEST_URI to run database tests';
process.env.MONGO_URI = uri || 'mongodb://127.0.0.1:1/unused';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.NODE_ENV = 'test';

const { default: mongoose } = await import('mongoose');
const { default: app } = await import('../src/app.js');
const { Product, Category, Review, User } = await import('../src/models/index.js');
const { seedCatalog } = await import('../src/seed/seed.js');

describe('Products & categories API', { skip }, () => {
  let server, base, call, adminCookie;
  const api = (method, path, body) => call(method, path, { body, cookie: adminCookie }); // writes: logged in as a real admin
  const get = (p) => call('GET', p); // reads: anonymous, proving the catalogue is public
  const names = (r) => r.body.data.map((p) => p.name);
  const eff = (p) => p.salePrice ?? p.price;

  before(async () => {
    await mongoose.connect(uri);
    await mongoose.connection.dropDatabase();
    await Promise.all([Category, Product, Review].map((m) => m.init()));
    await seedCatalog();
    await new Promise((r) => { server = app.listen(0, r); });
    base = `http://127.0.0.1:${server.address().port}/api`;
    call = makeCall(base);
    await User.create({ name: 'Admin', email: 'admin@shop.test', password: 'admin-password-1', role: 'admin' });
    adminCookie = await login(call, 'admin@shop.test', 'admin-password-1');
  });
  after(async () => { server.close(); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });

  describe('GET /products: shape, paging, sorting', () => {
    test('returns the storefront product shape', async () => {
      const r = await get('/products?limit=1&q=flux');
      const p = r.body.data[0];
      assert.equal(r.status, 200); assert.equal(r.body.success, true);
      for (const k of ['id', 'slug', 'name', 'description', 'price', 'images', 'category', 'gender', 'sizes', 'colors', 'stock', 'rating', 'reviewCount', 'sold', 'isNew', 'isBestSeller', 'createdAt']) assert.ok(k in p, `missing ${k}`);
      assert.equal(p.category, 'Bottoms'); assert.match(p.id, /^[a-f0-9]{24}$/);
      assert.ok(Object.keys(p.stock).every((k) => k.includes('|')), 'stock keyed by "size|colour"');
      assert.equal(Object.keys(p.stock).length, p.sizes.length * p.colors.length, 'every size/colour has a stock row');
      assert.ok(!('_id' in p) && !('__v' in p) && !('variants' in p));
    });
    test('page 1 has 12 of 40, page 2 has the next 12 with no overlap', async () => {
      const a = await get('/products'); const b = await get('/products?page=2');
      assert.equal(a.body.data.length, 12); assert.deepEqual(a.body.meta, { page: 1, limit: 12, total: 40, totalPages: 4, hasNext: true, hasPrev: false });
      assert.equal(b.body.data.length, 12); assert.equal(b.body.meta.hasNext, true); assert.equal(b.body.meta.hasPrev, true);
      assert.equal(new Set([...a.body.data, ...b.body.data].map((p) => p.id)).size, 24);
    });
    test('page beyond the end is an empty list, not an error; limit up to 50 works', async () => {
      const r = await get('/products?page=9'); assert.equal(r.status, 200); assert.deepEqual(r.body.data, []);
      assert.equal((await get('/products?limit=50')).body.data.length, 40);
    });
    test('price sorts use the sale price when there is one', async () => {
      const asc = (await get('/products?limit=50&sort=price-asc')).body.data.map(eff);
      const desc = (await get('/products?limit=50&sort=price-desc')).body.data.map(eff);
      assert.deepEqual(asc, [...asc].sort((a, b) => a - b)); assert.deepEqual(desc, [...desc].sort((a, b) => b - a));
      assert.equal(asc[0], 14); assert.equal(desc[0], 119);
    });
    test('best-selling and newest sorts', async () => {
      const best = (await get('/products?limit=50&sort=best')).body.data.map((p) => p.sold);
      assert.deepEqual(best, [...best].sort((a, b) => b - a));
      const newest = (await get('/products?limit=50&sort=newest')).body.data.map((p) => +new Date(p.createdAt));
      assert.deepEqual(newest, [...newest].sort((a, b) => b - a));
    });
    test('paging a sorted list never repeats or skips a product (stable ordering)', async () => {
      const seen = [];
      for (let page = 1; page <= 8; page++) seen.push(...(await get(`/products?sort=price-asc&limit=5&page=${page}`)).body.data.map((p) => p.id));
      assert.equal(seen.length, 40); assert.equal(new Set(seen).size, 40);
    });
  });

  describe('GET /products: filters and search', () => {
    test('gender: men includes unisex; exactGender does not; unisex alone', async () => {
      assert.equal((await get('/products?gender=men&limit=50')).body.meta.total, 25);
      assert.equal((await get('/products?gender=men&exactGender=true')).body.meta.total, 13);
      assert.equal((await get('/products?gender=women&limit=50')).body.meta.total, 27);
      assert.equal((await get('/products?gender=unisex')).body.meta.total, 12);
    });
    test('category by slug, by name (any case), unknown -> empty', async () => {
      assert.equal((await get('/products?category=hoodies-and-jackets')).body.meta.total, 3);
      assert.equal((await get('/products?category=' + encodeURIComponent('hoodies & jackets'))).body.meta.total, 3);
      assert.equal((await get('/products?category=nope')).body.meta.total, 0);
    });
    test('size and colour', async () => {
      const xs = await get('/products?size=XS&limit=50'); assert.equal(xs.body.meta.total, 15); assert.ok(xs.body.data.every((p) => p.gender === 'women'));
      const olive = await get('/products?color=Olive&limit=50'); assert.ok(olive.body.meta.total > 0 && olive.body.data.every((p) => p.colors.some((c) => c.name === 'Olive')));
    });
    test('price range applies to the effective (sale) price', async () => {
      const r = await get('/products?minPrice=30&maxPrice=50&limit=50');
      assert.ok(r.body.data.length > 0 && r.body.data.every((p) => eff(p) >= 30 && eff(p) <= 50));
      assert.ok(names(r).includes('Velocity Joggers'), 'sale $49 qualifies although the regular price is $64');
      assert.ok(!names(r).includes('Momentum Tech Hoodie'));
    });
    test('collections: new, best, sale', async () => {
      const n = await get('/products?collection=new&limit=50'); assert.equal(n.body.meta.total, 9); assert.ok(n.body.data.every((p) => p.isNew));
      const b = await get('/products?collection=best'); assert.deepEqual(names(b).sort(), ['Apex Performance Tee', 'Aura Seamless Sports Bra', 'Flux High-Waist Leggings', 'Lotus Wide-Leg Pants', 'Momentum Tech Hoodie', 'Stride Singlet', 'Tide Racerback Swimsuit']); assert.ok(b.body.data.every((p) => p.isBestSeller));
      const s = await get('/products?collection=sale'); assert.equal(s.body.meta.total, 8); assert.ok(s.body.data.every((p) => p.salePrice < p.price));
    });
    test('search: partial words, description text, and category names', async () => {
      assert.deepEqual(names(await get('/products?q=legging')), ['Flux High-Waist Leggings']);
      assert.deepEqual(names(await get('/products?q=hood')).sort(), ['Momentum Tech Hoodie', 'Pulse Cropped Hoodie', 'Stealth Windrunner Jacket', 'Zephyr Running Jacket'], 'also the whole "Hoodies & Jackets" category, and Zephyr whose description mentions a hood');
      assert.ok(!names(await get('/products?q=tee')).includes('Hydra Shaker Bottle'), '"tee" must not match "steel"');
      assert.ok(names(await get('/products?q=tee')).includes('Apex Performance Tee'));
      assert.ok(names(await get('/products?q=zip')).includes('Surge Training Shorts'), 'matches description');
      assert.deepEqual(names(await get('/products?q=sports%20bras')).sort(), ['Aura Seamless Sports Bra', 'Elevate Longline Bra']);
      assert.equal((await get('/products?q=zzzzzz')).body.meta.total, 0);
    });
    test('search text and filters combine', async () => {
      const r = await get('/products?q=tee&gender=women'); assert.deepEqual(names(r).sort(), ['Cadence Crop Tee', 'Drift Oversized Tee']);
    });
    test('regex characters in search are treated as plain text', async () => {
      for (const q of ['.*', '(', '[a-', '\\', '%2e*+?']) assert.equal((await get('/products?q=' + encodeURIComponent(q))).status, 200);
      assert.equal((await get('/products?q=' + encodeURIComponent('.*'))).body.meta.total, 0);
    });
    test('ids filter returns exactly those products', async () => {
      const all = (await get('/products?limit=3')).body.data;
      const r = await get(`/products?ids=${all[0].id},${all[2].id}`);
      assert.deepEqual(r.body.data.map((p) => p.id).sort(), [all[0].id, all[2].id].sort());
    });
    test('invalid parameters are rejected with a clear 400', async () => {
      for (const [q, msg] of [['sort=cheapest', /sort must be/], ['limit=51', /limit must be/], ['page=0', /page must be/], ['gender=kids', /gender must be/], ['collection=hot', /collection must be/],
        ['minPrice=-1', /minPrice/], ['minPrice=50&maxPrice=10', /maxPrice must not be lower/], ['ids=abc', /valid product ids/], ['q=' + 'a'.repeat(81), /too long/]]) {
        const r = await get('/products?' + q); assert.equal(r.status, 400, q); assert.match(r.body.message, msg, q);
      }
    });
    test('NoSQL operator injection is neutralised', async () => {
      const r = await get('/products?category[$ne]=x'); assert.equal(r.status, 400);
      assert.equal((await get('/products?q[$regex]=.*')).status, 400);
    });
  });

  describe('GET /products/:idOrSlug', () => {
    test('by slug: full detail with stock map and reviews', async () => {
      const r = await get('/products/flux-high-waist-leggings'); const p = r.body.data;
      assert.equal(r.status, 200); assert.equal(p.name, 'Flux High-Waist Leggings'); assert.equal(p.categorySlug, 'bottoms');
      assert.deepEqual(p.reviews, [], 'no fabricated reviews are shown');
      assert.equal(p.reviewCount, 0, 'no rating or review count without real reviews');
      assert.ok(p.totalStock > 0);
    });
    test('by id returns the same product; unknown -> 404', async () => {
      const bySlug = (await get('/products/vortex-pro-cap')).body.data;
      assert.equal((await get('/products/' + bySlug.id)).body.data.slug, 'vortex-pro-cap');
      for (const k of ['nope', '64b7f0f0f0f0f0f0f0f0f0f0']) { const r = await get('/products/' + k); assert.equal(r.status, 404); assert.equal(r.body.success, false); }
    });
    test('related: other products, same category first, never itself', async () => {
      const r = await get('/products/flux-high-waist-leggings/related');
      assert.equal(r.body.data.length, 4); assert.ok(!names(r).includes('Flux High-Waist Leggings'));
      assert.deepEqual(r.body.data.slice(0, 3).map((p) => p.category), ['Bottoms', 'Bottoms', 'Bottoms']);
      assert.equal((await get('/products/flux-high-waist-leggings/related?limit=2')).body.data.length, 2);
      assert.equal((await get('/products/nope/related')).status, 404);
    });
  });

  describe('GET /categories', () => {
    test('lists the 8 categories with live product counts', async () => {
      const r = await get('/categories');
      assert.equal(r.body.data.length, 8); assert.equal(r.body.data.reduce((s, c) => s + c.productCount, 0), 40);
      assert.deepEqual(r.body.data.map((c) => c.name), [...r.body.data.map((c) => c.name)].sort());
      assert.equal(r.body.data.find((c) => c.slug === 'hoodies-and-jackets').productCount, 3);
    });
    test('single category by slug or id; unknown -> 404', async () => {
      const c = (await get('/categories/tops')).body.data; assert.equal(c.productCount, 3);
      assert.equal((await get('/categories/' + c.id)).body.data.slug, 'tops');
      assert.equal((await get('/categories/nope')).status, 404);
    });
  });

  describe('Category CRUD (admin)', () => {
    test('create, duplicate rejected, validate, update, delete', async () => {
      const c = await api('POST', '/categories', { name: 'Footwear', description: 'Shoes' });
      assert.equal(c.status, 201); assert.equal(c.body.data.slug, 'footwear'); assert.equal(c.body.data.productCount, 0);
      assert.equal((await api('POST', '/categories', { name: 'Footwear' })).status, 409);
      assert.equal((await api('POST', '/categories', { name: 'x' })).status, 400);
      assert.equal((await api('POST', '/categories', {})).status, 400);
      assert.equal((await api('POST', '/categories', { name: 'Okay', image: 'javascript:alert(1)' })).status, 400);
      const u = await api('PATCH', '/categories/' + c.body.data.id, { name: 'Shoes & Trainers' });
      assert.equal(u.body.data.slug, 'shoes-and-trainers');
      assert.equal((await api('DELETE', '/categories/' + c.body.data.id)).status, 200);
      assert.equal((await api('DELETE', '/categories/' + c.body.data.id)).status, 404);
    });
    test('a category that still has products cannot be deleted', async () => {
      const tops = (await get('/categories/tops')).body.data;
      const r = await api('DELETE', '/categories/' + tops.id);
      assert.equal(r.status, 409); assert.match(r.body.message, /still has 3 products/);
    });
    test('bad ids are rejected', async () => assert.equal((await api('PATCH', '/categories/not-an-id', { name: 'Nope' })).status, 400));
  });

  describe('Product CRUD with variants and stock (admin)', () => {
    let catId; let created;
    const valid = () => ({
      name: 'Test Runner Singlet', description: 'A lightweight singlet for testing.', price: 40, salePrice: 30, images: ['https://images.unsplash.com/photo-1?x=1'],
      category: catId, gender: 'men', sizes: ['S', 'M'], colors: [{ name: 'Black', hex: '#000000' }, { name: 'Red', hex: '#f00' }],
    });
    before(async () => { catId = (await get('/categories/tops')).body.data.id; });

    test('create: generates slug, zero-stock variants for every combination, effective price', async () => {
      const r = await api('POST', '/products', valid()); created = r.body.data;
      assert.equal(r.status, 201); assert.equal(created.slug, 'test-runner-singlet'); assert.equal(created.category, 'Tops');
      assert.equal(Object.keys(created.stock).length, 4); assert.ok(Object.values(created.stock).every((n) => n === 0));
      assert.equal((await get('/products?q=singlet&maxPrice=30')).body.meta.total, 1, 'findable by its sale price');
    });
    test('duplicate names get a unique slug', async () => {
      const r = await api('POST', '/products', valid()); assert.equal(r.body.data.slug, 'test-runner-singlet-2');
      await api('DELETE', '/products/' + r.body.data.id);
    });
    test('create accepts explicit variant stock', async () => {
      const r = await api('POST', '/products', { ...valid(), name: 'Stocked Tee', variants: [{ size: 'S', color: 'Black', stock: 7 }, { size: 'M', color: 'Red', stock: 2 }] });
      assert.equal(r.status, 201); assert.equal(r.body.data.stock['S|Black'], 7); assert.equal(r.body.data.totalStock, 9);
      await api('DELETE', '/products/' + r.body.data.id);
    });
    test('mass assignment: sold, rating, slug and effectivePrice cannot be set by the client', async () => {
      const r = await api('POST', '/products', { ...valid(), name: 'Sneaky Tee', sold: 9999, rating: 5, reviewCount: 500, slug: 'hacked', effectivePrice: 1 });
      assert.equal(r.body.data.sold, 0); assert.equal(r.body.data.rating, 0); assert.equal(r.body.data.reviewCount, 0); assert.equal(r.body.data.slug, 'sneaky-tee');
      assert.equal((await Product.findById(r.body.data.id)).effectivePrice, 30);
      await api('DELETE', '/products/' + r.body.data.id);
    });
    test('validation: every bad input is a clear 400 and nothing is saved', async () => {
      const before = await Product.countDocuments();
      const cases = [
        [{ ...valid(), salePrice: 40 }, /lower than the regular price/], [{ ...valid(), price: -5 }, /Price must be/], [{ ...valid(), name: 'x' }, /Name must be/],
        [{ ...valid(), category: undefined }, /required/], [{ ...valid(), category: '64b7f0f0f0f0f0f0f0f0f0f0' }, /category does not exist/],
        [{ ...valid(), gender: 'kids' }, /Gender must be/], [{ ...valid(), images: [] }, /1 to 10 images/], [{ ...valid(), images: ['javascript:alert(1)'] }, /http\(s\) URL/],
        [{ ...valid(), colors: [{ name: 'Black', hex: 'black' }] }, /Colour hex/], [{ ...valid(), sizes: ['S', 'S'] }, /duplicates/],
        [{ ...valid(), variants: [{ size: 'XXL', color: 'Black', stock: 1 }] }, /not one of the product sizes/], [{ ...valid(), variants: [{ size: 'S', color: 'Black', stock: -1 }] }, /Stock must be/],
        [{ ...valid(), variants: [{ size: 'S', color: 'Black', stock: 1.5 }] }, /Stock must be/],
      ];
      for (const [body, msg] of cases) { const r = await api('POST', '/products', body); assert.equal(r.status, 400, JSON.stringify(body).slice(0, 80)); assert.match(r.body.message, msg); }
      assert.equal(await Product.countDocuments(), before);
    });
    test('update: partial PATCH recalculates the effective price; null clears the sale', async () => {
      let r = await api('PATCH', '/products/' + created.id, { price: 60, salePrice: 45 });
      assert.equal(r.status, 200); assert.equal(r.body.data.salePrice, 45);
      assert.equal((await get('/products?q=singlet&minPrice=44&maxPrice=46')).body.meta.total, 1);
      r = await api('PUT', '/products/' + created.id, { salePrice: null });
      assert.ok(!('salePrice' in r.body.data)); assert.equal((await Product.findById(created.id)).effectivePrice, 60);
      assert.equal((await api('PATCH', '/products/' + created.id, { price: 60, salePrice: 70 })).status, 400);
      assert.equal((await api('PATCH', '/products/' + created.id, { price: 10, salePrice: 12 })).status, 400);
    });
    test('update: unspecified fields are untouched; featured and active toggles work', async () => {
      const r = await api('PATCH', '/products/' + created.id, { isFeatured: true });
      assert.equal(r.body.data.isBestSeller, true); assert.equal(r.body.data.name, 'Test Runner Singlet');
      assert.ok((await get('/products?collection=best')).body.data.some((p) => p.id === created.id));
      await api('PATCH', '/products/' + created.id, { isFeatured: false });
    });
    test('stock: set an existing variant, add a new combination, reject unknown ones', async () => {
      let r = await api('PATCH', `/products/${created.id}/stock`, { size: 'M', color: 'Red', stock: 12 });
      assert.equal(r.status, 200); assert.equal(r.body.data.stock['M|Red'], 12); assert.equal(r.body.data.stock['S|Black'], 0);
      r = await api('PATCH', `/products/${created.id}/stock`, { size: 'M', color: 'Red', stock: 0 }); assert.equal(r.body.data.stock['M|Red'], 0);
      assert.equal((await api('PATCH', `/products/${created.id}/stock`, { size: 'XXL', color: 'Red', stock: 1 })).status, 400);
      assert.equal((await api('PATCH', `/products/${created.id}/stock`, { size: 'S', color: 'Pink', stock: 1 })).status, 400);
      assert.equal((await api('PATCH', `/products/${created.id}/stock`, { size: 'S', color: 'Red', stock: -3 })).status, 400);
      assert.equal((await api('PATCH', `/products/${created.id}/stock`, { size: 'S', color: 'Red', stock: 2.5 })).status, 400);
      assert.equal((await api('PATCH', '/products/64b7f0f0f0f0f0f0f0f0f0f0/stock', { size: 'S', color: 'Red', stock: 1 })).status, 404);
    });
    test('stock edits do not disturb a concurrent order reservation', async () => {
      await api('PATCH', `/products/${created.id}/stock`, { size: 'S', color: 'Black', stock: 10 });
      await Product.reserveStock(created.id, 'S', 'Black', 4);
      await api('PATCH', `/products/${created.id}/stock`, { size: 'M', color: 'Black', stock: 5 }); // different variant
      const p = (await get('/products/' + created.id)).body.data; assert.equal(p.stock['S|Black'], 6); assert.equal(p.stock['M|Black'], 5);
    });
    test('changing sizes/colours keeps stock for combinations that remain', async () => {
      const r = await api('PATCH', '/products/' + created.id, { sizes: ['S', 'L'] });
      assert.equal(r.status, 200); assert.equal(r.body.data.stock['S|Black'], 6); assert.equal(r.body.data.stock['L|Black'], 0); assert.ok(!('M|Black' in r.body.data.stock));
    });
    test('inactive products disappear from the shop but can be reactivated', async () => {
      await api('PATCH', '/products/' + created.id, { isActive: false });
      assert.equal((await get('/products/' + created.slug)).status, 404); assert.equal((await get('/products?q=test%20runner%20singlet')).body.meta.total, 0);
      await api('PATCH', '/products/' + created.id, { isActive: true });
      assert.equal((await get('/products/' + created.slug)).status, 200);
    });
    test('delete removes the product and its reviews', async () => {
      const seeded = (await get('/products/hydra-shaker-bottle')).body.data;
      assert.equal((await api('DELETE', '/products/' + seeded.id)).status, 200);
      assert.equal(await Review.countDocuments({ product: seeded.id }), 0);
      assert.equal((await get('/products/' + seeded.id)).status, 404);
      assert.equal((await api('DELETE', '/products/' + seeded.id)).status, 404);
      assert.equal((await api('DELETE', '/products/' + created.id)).status, 200);
    });
  });
});
