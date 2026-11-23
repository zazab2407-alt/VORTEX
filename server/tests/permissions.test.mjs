// Who may do what: every protected route, as anonymous visitor, customer and admin.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { testUri, makeCall, login } from './helpers.mjs';

const uri = testUri('perm');
const skip = !uri && 'set MONGO_TEST_URI to run database tests';
process.env.MONGO_URI = uri || 'mongodb://127.0.0.1:1/unused';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123';
process.env.NODE_ENV = 'test';

const { default: mongoose } = await import('mongoose');
const { default: app } = await import('../src/app.js');
const { User, Product, Category, Order } = await import('../src/models/index.js');
const { seedCatalog } = await import('../src/seed/seed.js');

describe('Permissions', { skip }, () => {
  let server, call, customer, admin, other, productId, catId;
  before(async () => {
    await mongoose.connect(uri); await mongoose.connection.dropDatabase(); await Promise.all([User, Product, Category, Order].map((m) => m.init()));
    await seedCatalog();
    await new Promise((r) => { server = app.listen(0, r); });
    call = makeCall(`http://127.0.0.1:${server.address().port}/api`);
    const mk = (email, role) => User.create({ name: email.split('@')[0], email, password: 'password-12345', role });
    const [c, a, o] = await Promise.all([mk('cust@x.test', 'customer'), mk('admin@x.test', 'admin'), mk('other@x.test', 'customer')]);
    [customer, admin, other] = await Promise.all([login(call, 'cust@x.test', 'password-12345'), login(call, 'admin@x.test', 'password-12345'), login(call, 'other@x.test', 'password-12345')]);
    productId = String((await Product.findOne({ slug: 'vortex-pro-cap' }))._id); catId = String((await Category.findOne({ slug: 'tops' }))._id);
    const order = (user, n) => ({ user: user._id, customer: { fullName: 'N', email: 'n@x.test', phone: '1' }, shippingAddress: { address: 'a', city: 'c' }, items: [{ product: productId, name: 'Cap', size: 'One Size', color: 'Black', unitPrice: 20, quantity: n, lineTotal: 20 * n }], subtotal: 20 * n, total: 20 * n });
    await Order.create(order(c, 1)); await Order.create(order(c, 2)); await Order.create(order(o, 3));
  });
  after(async () => { server.close(); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });

  const validProduct = () => ({ name: 'Perm Test Tee', description: 'A test product.', price: 20, images: ['https://x/y.jpg'], category: catId, gender: 'men', sizes: ['M'], colors: [{ name: 'Black', hex: '#000000' }] });
  const ROUTES = () => [
    ['POST', '/products', validProduct()], ['PUT', `/products/${productId}`, { price: 30 }], ['PATCH', `/products/${productId}`, { price: 30 }],
    ['PATCH', `/products/${productId}/stock`, { size: 'One Size', color: 'Black', stock: 5 }], ['DELETE', `/products/${productId}`],
    ['POST', '/categories', { name: 'Perm Cat' }], ['PUT', `/categories/${catId}`, { description: 'x' }], ['PATCH', `/categories/${catId}`, { description: 'x' }], ['DELETE', `/categories/${catId}`],
    ['GET', '/admin/stats'], ['GET', '/admin/products'], ['GET', `/admin/products/${productId}`], ['GET', '/admin/categories'], ['POST', '/admin/uploads'],
  ];

  test('anonymous visitors: 401 on every admin route', async () => {
    for (const [m, p, body] of ROUTES()) assert.equal((await call(m, p, { body })).status, 401, `${m} ${p}`);
  });
  test('customers: 403 on every admin route', async () => {
    for (const [m, p, body] of ROUTES()) assert.equal((await call(m, p, { body, cookie: customer })).status, 403, `${m} ${p}`);
  });
  test('refused requests change nothing', async () => {
    const [products, cats] = [await Product.countDocuments(), await Category.countDocuments()];
    for (const cookie of [undefined, customer]) {
      await call('POST', '/products', { body: validProduct(), cookie }); await call('DELETE', `/products/${productId}`, { cookie }); await call('POST', '/categories', { body: { name: 'Nope Cat' }, cookie });
      await call('PATCH', `/products/${productId}`, { body: { price: 1 }, cookie }); await call('PATCH', `/products/${productId}/stock`, { body: { size: 'One Size', color: 'Black', stock: 999 }, cookie });
    }
    assert.equal(await Product.countDocuments(), products); assert.equal(await Category.countDocuments(), cats);
    const p = await Product.findById(productId); assert.equal(p.price, 26); assert.ok(p.variants.every((v) => v.stock !== 999));
  });
  test('admins: allowed on every admin route (never 401/403)', async () => {
    for (const [m, p, body] of ROUTES().filter(([m, p]) => !(m === 'DELETE' && p.startsWith('/products')) && !(m === 'DELETE' && p.startsWith('/categories')))) {
      const s = (await call(m, p, { body, cookie: admin })).status; assert.ok(![401, 403].includes(s), `${m} ${p} -> ${s}`);
    }
    assert.equal((await call('DELETE', `/products/${productId}`, { cookie: admin })).status, 200, 'admin can delete');
  });
  test('the public storefront stays public', async () => {
    for (const p of ['/products', '/products/flux-high-waist-leggings', '/products/flux-high-waist-leggings/related', '/categories', '/categories/tops', '/health']) assert.equal((await call('GET', p)).status, 200, p);
    assert.equal((await call('POST', '/auth/register', { body: { name: 'New Person', email: 'new@x.test', password: 'password-12345' } })).status, 201);
  });
  test('order history: a customer sees only their own orders', async () => {
    const mine = await call('GET', '/orders/mine', { cookie: customer });
    assert.equal(mine.status, 200); assert.equal(mine.body.data.length, 2); assert.ok(mine.body.data.every((o) => o.orderNumber.startsWith('VTX-')));
    const theirs = await call('GET', '/orders/mine', { cookie: other });
    assert.equal(theirs.body.data.length, 1); assert.equal(theirs.body.data[0].itemCount, 3);
    assert.equal((await call('GET', '/orders/mine')).status, 401);
  });
  test('hidden products stay hidden from the public but visible to admins', async () => {
    const hidden = await Product.findOne({ slug: 'apex-performance-tee' }); await Product.updateOne({ _id: hidden._id }, { isActive: false });
    assert.equal((await call('GET', '/products/apex-performance-tee')).status, 404);
    assert.equal((await call('GET', `/admin/products/${hidden._id}`, { cookie: admin })).status, 200);
    assert.equal((await call('GET', `/admin/products/${hidden._id}`, { cookie: customer })).status, 403);
  });
});
