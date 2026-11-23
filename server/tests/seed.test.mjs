import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { testUri } from './helpers.mjs';

const uri = testUri('seed');
const skip = !uri && 'set MONGO_TEST_URI to run database tests';
process.env.MONGO_URI = uri || 'mongodb://127.0.0.1:1/unused';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123';

const { default: mongoose } = await import('mongoose');
const { User, Category, Product, Review, Coupon } = await import('../src/models/index.js');
const { seedCatalog } = await import('../src/seed/seed.js');

describe('Seed script', { skip }, () => {
  before(async () => { await mongoose.connect(uri); await mongoose.connection.dropDatabase(); await Promise.all([User, Category, Product, Review, Coupon].map((m) => m.init())); });
  after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });

  test('creates 8 categories, 40 valid products and 2 coupons, and NO reviews', async () => {
    const summary = await seedCatalog();
    assert.deepEqual([summary.categories, summary.products, summary.coupons, summary.reviews], [8, 40, 2, 0]);
    assert.equal(await Category.countDocuments(), 8); assert.equal(await Product.countDocuments(), 40); assert.equal(await Coupon.countDocuments(), 2);
    assert.equal(await Review.countDocuments(), 0, 'no fabricated reviews are seeded');
    for (const p of await Product.find()) await p.validate(); // every seeded product passes the schema rules
  });
  test('variants: one stock row per size x colour; mix of healthy, low and sold-out; every product sellable', async () => {
    const all = await Product.find(); let zero = 0, low = 0;
    for (const p of all) {
      assert.equal(p.variants.length, p.sizes.length * p.colors.length, p.name);
      assert.ok(p.totalStock > 0, `${p.name} must have something in stock`);
      for (const v of p.variants) { if (v.stock === 0) zero++; else if (v.stock <= 3) low++; }
    }
    assert.ok(zero > 0 && low > 0, `demo data should include sold-out (${zero}) and low-stock (${low}) variants`);
  });
  test('catalogue mix: 7 best sellers, 8 on sale, 9 new arrivals, 3 genders', async () => {
    const all = await Product.find();
    assert.equal(all.filter((p) => p.isFeatured).length, 7); assert.equal(all.filter((p) => p.salePrice != null).length, 8); assert.equal(all.filter((p) => p.isNewArrival).length, 9);
    assert.deepEqual([...new Set(all.map((p) => p.gender))].sort(), ['men', 'unisex', 'women']);
    assert.ok(all.every((p) => p.effectivePrice === (p.salePrice ?? p.price)));
    assert.ok(all.every((p) => p.images.length === 3 && p.images.every((u) => u.startsWith('https://images.unsplash.com/photo-'))));
  });
  test('seeded products have no rating and no review count', async () => {
    for (const p of await Product.find()) { assert.equal(p.reviewCount, 0, p.name); assert.equal(p.rating, 0, p.name); }
  });
  test('demo reviewer accounts are NOT created', async () => {
    assert.equal(await User.countDocuments({ email: /@demo\.vortex\.test$/ }), 0);
  });
  test('re-running is idempotent and never touches real customers', async () => {
    const real = await User.create({ name: 'Real Customer', email: 'real@example.com', password: 'a-long-password-1' });
    await seedCatalog(); await seedCatalog();
    assert.equal(await Product.countDocuments(), 40); assert.equal(await Category.countDocuments(), 8); assert.equal(await Coupon.countDocuments(), 2);
    assert.equal(await User.countDocuments({ email: /@demo\.vortex\.test$/ }), 0);
    assert.ok(await User.findById(real._id), 'real customer survived reseeding');
  });
});
