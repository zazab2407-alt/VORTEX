// Database integration tests. They run only when MONGO_TEST_URI is set, e.g.
//   MONGO_TEST_URI=mongodb://127.0.0.1:27017/vortex_test npm test
// WARNING: the target database is wiped when the tests finish - never point this at real data.
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { testUri } from './helpers.mjs';
const uri = testUri('models');
const skip = !uri && 'set MONGO_TEST_URI to run database tests';

process.env.MONGO_URI = uri || 'mongodb://127.0.0.1:1/unused';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123';

const { default: mongoose } = await import('mongoose');
const { User, Category, Product, Order, Coupon, Review } = await import('../src/models/index.js');

const dupKey = (p) => p.then(() => assert.fail('expected a duplicate key error'), (e) => assert.equal(e.code, 11000));

describe('MongoDB integration', { skip }, () => {
  let cat;
  before(async () => {
    await mongoose.connect(uri);
    await mongoose.connection.dropDatabase();
    await Promise.all([User, Category, Product, Order, Coupon, Review].map((m) => m.init())); // build unique indexes
    cat = await Category.create({ name: 'Tops' });
  });
  after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });

  const newProduct = (over = {}) => Product.create({
    name: 'Apex Tee', description: 'A tee', price: 34, images: ['https://x/y.jpg'], category: cat._id, gender: 'men',
    sizes: ['M', 'L'], colors: [{ name: 'Black', hex: '#0A0A0A' }],
    variants: [{ size: 'M', color: 'Black', stock: 5 }, { size: 'L', color: 'Black', stock: 0 }], ...over,
  });

  describe('User', () => {
    test('password is hashed on save, hidden by default, and verifiable', async () => {
      const u = await User.create({ name: 'Zeyad', email: 'z@example.com', password: 'correct-horse-9' });
      assert.match(u.password, /^\$2[aby]\$12\$/, 'stored as a bcrypt hash with cost 12');
      assert.notEqual(u.password, 'correct-horse-9');
      const found = await User.findOne({ email: 'Z@Example.com' });
      assert.equal(found.password, undefined, 'password excluded unless explicitly selected');
      const withPw = await User.findOne({ email: 'z@example.com' }).select('+password');
      assert.equal(await withPw.comparePassword('correct-horse-9'), true);
      assert.equal(await withPw.comparePassword('wrong'), false);
    });
    test('saving other fields does not re-hash the password', async () => {
      const u = await User.findOne({ email: 'z@example.com' }).select('+password');
      const before = u.password; u.name = 'Zeyad A'; await u.save();
      assert.equal((await User.findById(u._id).select('+password')).password, before);
    });
    test('duplicate email is rejected (case-insensitive)', () =>
      dupKey(User.create({ name: 'Other', email: 'Z@EXAMPLE.com', password: 'another-pass-1' })));
  });

  describe('Category / Coupon / slugs', () => {
    test('duplicate category name rejected', () => dupKey(Category.create({ name: 'Tops' })));
    test('duplicate coupon code rejected', async () => { await Coupon.create({ code: 'save10', type: 'percentage', value: 10 }); await dupKey(Coupon.create({ code: 'SAVE10', type: 'percentage', value: 5 })); });
    test('generateUniqueSlug appends -2, -3 for clashes', async () => {
      await newProduct();
      assert.equal(await Product.generateUniqueSlug('Apex Tee'), 'apex-tee-2');
      await newProduct({ slug: 'apex-tee-2' });
      assert.equal(await Product.generateUniqueSlug('Apex Tee'), 'apex-tee-3');
    });
  });

  describe('Stock reservation (overselling protection)', () => {
    let p;
    beforeEach(async () => { p = await newProduct({ name: `Stock ${Math.random()}` }); });
    const fresh = () => Product.findById(p._id);

    test('reserves stock and counts the sale', async () => {
      assert.equal(await Product.reserveStock(p._id, 'M', 'Black', 2), true);
      const f = await fresh(); assert.equal(f.getStock('M', 'Black'), 3); assert.equal(f.sold, 2);
    });
    test('refuses when not enough stock and changes nothing', async () => {
      assert.equal(await Product.reserveStock(p._id, 'M', 'Black', 6), false);
      assert.equal(await Product.reserveStock(p._id, 'L', 'Black', 1), false, 'sold-out variant');
      assert.equal(await Product.reserveStock(p._id, 'XL', 'Black', 1), false, 'variant that does not exist');
      const f = await fresh(); assert.equal(f.getStock('M', 'Black'), 5); assert.equal(f.sold, 0);
    });
    test('20 shoppers racing for 5 units: exactly 5 succeed, stock ends at 0', async () => {
      const results = await Promise.all(Array.from({ length: 20 }, () => Product.reserveStock(p._id, 'M', 'Black', 1)));
      assert.equal(results.filter(Boolean).length, 5);
      const f = await fresh(); assert.equal(f.getStock('M', 'Black'), 0); assert.equal(f.sold, 5);
    });
    test('only touches the chosen variant', async () => {
      const q = await newProduct({ name: `Two ${Math.random()}`, sizes: ['M'], colors: [{ name: 'Black', hex: '#000' }, { name: 'Navy', hex: '#123' }], variants: [{ size: 'M', color: 'Black', stock: 4 }, { size: 'M', color: 'Navy', stock: 4 }] });
      await Product.reserveStock(q._id, 'M', 'Navy', 3);
      const f = await Product.findById(q._id); assert.equal(f.getStock('M', 'Black'), 4); assert.equal(f.getStock('M', 'Navy'), 1);
    });
    test('inactive products cannot be reserved', async () => {
      await Product.updateOne({ _id: p._id }, { isActive: false });
      assert.equal(await Product.reserveStock(p._id, 'M', 'Black', 1), false);
    });
    test('releaseStock puts units back and reduces sold', async () => {
      await Product.reserveStock(p._id, 'M', 'Black', 3);
      await Product.releaseStock(p._id, 'M', 'Black', 3);
      const f = await fresh(); assert.equal(f.getStock('M', 'Black'), 5); assert.equal(f.sold, 0);
    });
  });

  describe('Reviews', () => {
    test('product rating and count follow reviews; one review per user', async () => {
      const p = await newProduct({ name: `Rated ${Math.random()}` });
      const [u1, u2] = await Promise.all([User.create({ name: 'A User', email: 'a@x.com', password: 'password-1' }), User.create({ name: 'B User', email: 'b@x.com', password: 'password-2' })]);
      await Review.create({ product: p._id, user: u1._id, name: 'A', rating: 5, comment: 'Great' });
      const r2 = await Review.create({ product: p._id, user: u2._id, name: 'B', rating: 4, comment: 'Good' });
      let f = await Product.findById(p._id); assert.equal(f.rating, 4.5); assert.equal(f.reviewCount, 2);
      await dupKey(Review.create({ product: p._id, user: u1._id, name: 'A', rating: 1, comment: 'again' }));
      await r2.deleteOne();
      f = await Product.findById(p._id); assert.equal(f.rating, 5); assert.equal(f.reviewCount, 1);
    });
  });

  describe('Orders', () => {
    const data = (over = {}) => ({
      customer: { fullName: 'Zeyad', email: 'z@example.com', phone: '0100' }, shippingAddress: { address: '1 St', city: 'Port Said' },
      items: [{ product: new mongoose.Types.ObjectId(), name: 'Tee', size: 'M', color: 'Black', unitPrice: 34, quantity: 1, lineTotal: 34 }],
      subtotal: 34, discount: 0, shippingCost: 5, total: 39, ...over,
    });
    test('saves with an order number and records status history', async () => {
      const o = await Order.create(data());
      assert.equal(o.statusHistory.length, 1); assert.equal(o.statusHistory[0].status, 'pending');
      o.status = 'confirmed'; await o.save();
      o.status = 'shipped'; await o.save();
      const f = await Order.findById(o._id);
      assert.deepEqual(f.statusHistory.map((s) => s.status), ['pending', 'confirmed', 'shipped']);
    });
    test('guest orders (no user) are allowed; duplicate order numbers rejected', async () => {
      const a = await Order.create(data()); assert.equal(a.user, undefined);
      await dupKey(Order.create(data({ orderNumber: a.orderNumber })));
    });
    test('totals that do not add up are rejected at save time too', async () => {
      await assert.rejects(Order.create(data({ total: 1 })), /Total does not match/);
    });
  });
});
