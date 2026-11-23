// Admin order management: permissions, search/filter, status transitions, cancellation, low-stock warnings.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupApi, testUri } from './helpers.mjs';

const skip = !testUri('adminorders') && 'set MONGO_TEST_URI to run database tests';

describe('Admin order management', { skip }, () => {
  let t, call, models, orders;
  before(async () => {
    t = await setupApi('adminorders'); call = t.call; models = t.models;
    // the demo data deliberately contains sold-out variants; these tests need plenty of stock for the products they order
    await models.Product.updateMany({ slug: { $in: ['apex-performance-tee', 'momentum-tech-hoodie'] } }, { $set: { 'variants.$[].stock': 50 } });
    const mk = async (slug, size, color, qty, who, cookie) => {
      const r = await call('POST', '/orders', { cookie, body: t.orderBody([await t.line(slug, size, color, qty)], { customer: who }) });
      assert.equal(r.status, 201, JSON.stringify(r.body)); return r.body.data.order;
    };
    const alice = { fullName: 'Alice Adams', email: 'alice@x.test', phone: '0100 111 2222' }; const carol = { fullName: 'Carol Cooper', email: 'carol@shop.test', phone: '0122 333 4444' };
    orders = {
      a: await mk('apex-performance-tee', 'M', 'Black', 1, alice, t.aliceCookie), b: await mk('flux-high-waist-leggings', 'M', 'Black', 2, carol),
      c: await mk('vortex-pro-cap', 'One Size', 'Black', 1, carol), d: await mk('surge-training-shorts', 'L', 'Navy', 1, alice, t.aliceCookie),
    };
    const day = (d) => new Date(`2026-10-${d}T12:00:00.000Z`); // spread creation dates for the date filters
    for (const [k, d, s] of [['a', '05', 'delivered'], ['b', '12', 'confirmed'], ['c', '20', 'pending'], ['d', '28', 'cancelled']]) {
      await models.Order.collection.updateOne({ _id: new t.mongoose.Types.ObjectId(orders[k].id) }, { $set: { createdAt: day(d), status: s } });
    }
  });
  after(async () => { if (t) await t.close(); });
  const admin = (m, p, body) => call(m, p, { cookie: t.adminCookie, body });
  const numbers = (r) => r.body.data.map((o) => o.orderNumber);

  describe('permissions', () => {
    test('anonymous 401, customer 403, admin allowed, on every order-management route', async () => {
      const routes = [['GET', '/admin/orders'], ['GET', `/admin/orders/${orders.c.id}`], ['PATCH', `/admin/orders/${orders.c.id}/status`, { status: 'confirmed' }]];
      for (const [m, p, body] of routes) {
        assert.equal((await call(m, p, { body })).status, 401, `anon ${m} ${p}`);
        assert.equal((await call(m, p, { body, cookie: t.aliceCookie })).status, 403, `customer ${m} ${p}`);
      }
      assert.equal((await admin('GET', '/admin/orders')).status, 200);
      assert.equal((await models.Order.findById(orders.c.id)).status, 'pending', 'the refused customer/anonymous PATCH changed nothing');
    });
  });

  describe('list, search and filters', () => {
    test('newest first, paginated, with customer and payment info', async () => {
      const r = await admin('GET', '/admin/orders'); assert.deepEqual(numbers(r), [orders.d, orders.c, orders.b, orders.a].map((o) => o.orderNumber));
      assert.deepEqual(r.body.meta, { page: 1, limit: 12, total: 4, totalPages: 1, hasNext: false, hasPrev: false });
      const row = r.body.data[1]; assert.deepEqual([row.customer.fullName, row.paymentMethod, row.city, row.isGuest, row.itemCount], ['Carol Cooper', 'cod', 'Cairo', true, 1]);
      assert.equal(r.body.data[0].isGuest, false, "Alice's order is linked to her account");
      assert.deepEqual(numbers(await admin('GET', '/admin/orders?sort=oldest')), [orders.a, orders.b, orders.c, orders.d].map((o) => o.orderNumber));
      assert.equal((await admin('GET', '/admin/orders?limit=2&page=2')).body.data.length, 2);
    });
    test('search by order number (partial, any case), customer name, email and phone', async () => {
      const tail = orders.b.orderNumber.slice(-5).toLowerCase();
      assert.deepEqual(numbers(await admin('GET', `/admin/orders?q=${tail}`)), [orders.b.orderNumber]);
      assert.equal((await admin('GET', `/admin/orders?q=${orders.a.orderNumber}`)).body.meta.total, 1);
      assert.equal((await admin('GET', '/admin/orders?q=carol')).body.meta.total, 2); assert.equal((await admin('GET', '/admin/orders?q=ALICE')).body.meta.total, 2);
      assert.equal((await admin('GET', '/admin/orders?q=shop.test')).body.meta.total, 2); assert.equal((await admin('GET', '/admin/orders?q=333%204444')).body.meta.total, 2);
      assert.equal((await admin('GET', '/admin/orders?q=nobody')).body.meta.total, 0);
      for (const q of ['.*', '(', '[a-', '\\']) assert.equal((await admin('GET', '/admin/orders?q=' + encodeURIComponent(q))).status, 200, `regex-safe: ${q}`);
    });
    test('filter by status and by date range (inclusive days), and combine them', async () => {
      assert.deepEqual(numbers(await admin('GET', '/admin/orders?status=delivered')), [orders.a.orderNumber]);
      assert.equal((await admin('GET', '/admin/orders?status=cancelled')).body.meta.total, 1);
      assert.deepEqual(numbers(await admin('GET', '/admin/orders?from=2026-10-12&to=2026-10-20')).sort(), [orders.b.orderNumber, orders.c.orderNumber].sort());
      assert.equal((await admin('GET', '/admin/orders?from=2026-10-20')).body.meta.total, 2); assert.equal((await admin('GET', '/admin/orders?to=2026-10-05')).body.meta.total, 1);
      assert.equal((await admin('GET', '/admin/orders?q=carol&status=pending')).body.meta.total, 1);
    });
    test('bad filters are rejected', async () => {
      for (const [q, msg] of [['status=teleported', /status must be/], ['from=yesterday', /from must be/], ['to=2026-13-45x', /to must be/], ['limit=500', /limit/], ['page=0', /page/], ['sort=random', /sort/]]) {
        const r = await admin('GET', '/admin/orders?' + q); assert.equal(r.status, 400, q); assert.match(r.body.message, msg);
      }
    });
  });

  describe('order details', () => {
    test('admin sees everything: shipping, customer, items snapshot, payment, history, allowed next steps', async () => {
      const d = (await admin('GET', `/admin/orders/${orders.b.id}`)).body.data;
      assert.deepEqual([d.customer.fullName, d.customer.phone, d.shippingAddress.address, d.shippingAddress.city, d.paymentMethod, d.paymentStatus, d.total], ['Carol Cooper', '0122 333 4444', '12 Nile Corniche, Maadi', 'Cairo', 'cod', 'pending', 136]);
      assert.equal(d.items[0].name, 'Flux High-Waist Leggings'); assert.deepEqual(d.nextStatuses, ['processing', 'cancelled']); assert.equal(d.isGuest, true); assert.equal(d.confirmationEmail, 'not_configured');
      assert.equal((await admin('GET', '/admin/orders/64b7f0f0f0f0f0f0f0f0f0f0')).status, 404); assert.equal((await admin('GET', '/admin/orders/nope')).status, 400);
    });
  });

  describe('status changes', () => {
    test('an order moves pending > confirmed > processing > shipped > delivered; every step is recorded with who and when', async () => {
      const o = (await call('POST', '/orders', { body: t.orderBody([await t.line('apex-performance-tee', 'L', 'Black')]) })).body.data.order;
      for (const [to, note] of [['confirmed', 'Called customer'], ['processing', undefined], ['shipped', 'Courier: Aramex'], ['delivered', undefined]]) {
        const r = await admin('PATCH', `/admin/orders/${o.id}/status`, { status: to, note }); assert.equal(r.status, 200, `${to}: ${JSON.stringify(r.body)}`); assert.equal(r.body.data.status, to);
      }
      const d = (await admin('GET', `/admin/orders/${o.id}`)).body.data;
      assert.deepEqual(d.statusHistory.map((h) => h.status), ['pending', 'confirmed', 'processing', 'shipped', 'delivered']);
      assert.deepEqual(d.statusHistory.slice(1).map((h) => h.by), Array(4).fill('Admin Amy')); assert.equal(d.statusHistory[1].note, 'Called customer'); assert.equal(d.statusHistory[3].note, 'Courier: Aramex');
      assert.ok(d.statusHistory.every((h) => !Number.isNaN(Date.parse(h.at))));
      assert.equal(d.paymentStatus, 'paid', 'cash on delivery counts as paid once delivered'); assert.deepEqual(d.nextStatuses, []);
    });
    test('invalid transitions are refused (no skipping, no going back, nothing after delivered/cancelled)', async () => {
      const mkOrder = async () => (await call('POST', '/orders', { body: t.orderBody([await t.line('apex-performance-tee', 'XL', 'Black')]) })).body.data.order;
      const o = await mkOrder();
      for (const to of ['processing', 'shipped', 'delivered', 'pending']) { const r = await admin('PATCH', `/admin/orders/${o.id}/status`, { status: to }); assert.equal(r.status, 409, `pending -> ${to}`); assert.match(r.body.message, /can only move to confirmed/); }
      await admin('PATCH', `/admin/orders/${o.id}/status`, { status: 'confirmed' });
      assert.equal((await admin('PATCH', `/admin/orders/${o.id}/status`, { status: 'pending' })).status, 409, 'cannot go back');
      assert.equal((await admin('PATCH', `/admin/orders/${o.id}/status`, { status: 'confirmed' })).status, 409, 'cannot repeat');
      await admin('PATCH', `/admin/orders/${o.id}/status`, { status: 'cancelled' });
      for (const to of ['confirmed', 'processing', 'cancelled']) assert.equal((await admin('PATCH', `/admin/orders/${o.id}/status`, { status: to })).status, 409, `cancelled -> ${to}`);
      assert.equal((await admin('PATCH', `/admin/orders/${orders.a.id}/status`, { status: 'cancelled' })).status, 409, 'delivered orders cannot be cancelled');
      assert.equal((await models.Order.findById(o.id)).statusHistory.length, 3, 'refused changes leave no history');
    });
    test('unknown statuses, bad ids and long notes are rejected', async () => {
      assert.equal((await admin('PATCH', `/admin/orders/${orders.c.id}/status`, { status: 'bogus' })).status, 400);
      assert.equal((await admin('PATCH', '/admin/orders/64b7f0f0f0f0f0f0f0f0f0f0/status', { status: 'confirmed' })).status, 404);
      assert.equal((await admin('PATCH', '/admin/orders/bad/status', { status: 'confirmed' })).status, 400);
      assert.equal((await admin('PATCH', `/admin/orders/${orders.c.id}/status`, { status: 'confirmed', note: 'x'.repeat(301) })).status, 400);
    });
    test('two admins confirming at the same moment: one wins, one is told the order changed', async () => {
      const o = (await call('POST', '/orders', { body: t.orderBody([await t.line('apex-performance-tee', 'S', 'Black')]) })).body.data.order;
      const rs = await Promise.all([admin('PATCH', `/admin/orders/${o.id}/status`, { status: 'confirmed' }), admin('PATCH', `/admin/orders/${o.id}/status`, { status: 'confirmed' })]);
      assert.deepEqual(rs.map((r) => r.status).sort(), [200, 409]);
      assert.equal((await models.Order.findById(o.id)).statusHistory.filter((h) => h.status === 'confirmed').length, 1);
    });
    test('the customer sees the admin\'s update (without admin names)', async () => {
      const o = (await call('POST', '/orders', { cookie: t.bobCookie, body: t.orderBody([await t.line('apex-performance-tee', 'S', 'White')], { customer: { fullName: 'Bob', email: 'bob@x.test', phone: '0100 000 0000' } }) })).body.data.order;
      await admin('PATCH', `/admin/orders/${o.id}/status`, { status: 'confirmed', note: 'Packed soon' });
      const r = (await call('GET', `/orders/${o.orderNumber}`, { cookie: t.bobCookie })).body.data;
      assert.deepEqual(r.statusHistory.map((h) => h.status), ['pending', 'confirmed']); assert.equal(r.statusHistory[1].note, 'Packed soon'); assert.ok(!('by' in r.statusHistory[1]));
    });
  });

  describe('admin cancellation restores stock', () => {
    const setStock = (slug, size, color, stock) => models.Product.updateOne({ slug, variants: { $elemMatch: { size, color } } }, { $set: { 'variants.$.stock': stock } });
    test('pending, confirmed and processing orders can be cancelled by an admin and the stock returns', async () => {
      await setStock('momentum-tech-hoodie', 'M', 'Black', 30);
      for (const [i, upto] of [[0, null], [1, 'confirmed'], [2, 'processing']]) {
        const before = await t.stockOf('momentum-tech-hoodie', 'M', 'Black');
        const o = (await call('POST', '/orders', { body: t.orderBody([await t.line('momentum-tech-hoodie', 'M', 'Black', 2)]) })).body.data.order;
        if (upto) for (const s of ['confirmed', 'processing'].slice(0, upto === 'confirmed' ? 1 : 2)) await admin('PATCH', `/admin/orders/${o.id}/status`, { status: s });
        assert.equal(await t.stockOf('momentum-tech-hoodie', 'M', 'Black'), before - 2);
        const r = await admin('PATCH', `/admin/orders/${o.id}/status`, { status: 'cancelled', note: `reason ${i}` }); assert.equal(r.status, 200);
        assert.equal(await t.stockOf('momentum-tech-hoodie', 'M', 'Black'), before, 'stock restored');
        const last = r.body.data.statusHistory.at(-1); assert.deepEqual([last.status, last.by, last.note], ['cancelled', 'Admin Amy', `reason ${i}`]);
        assert.ok(r.body.data.stockRestoredAt);
      }
    });
    test('a shipped order cannot be cancelled and its stock stays deducted', async () => {
      const before = await t.stockOf('momentum-tech-hoodie', 'L', 'Black');
      const o = (await call('POST', '/orders', { body: t.orderBody([await t.line('momentum-tech-hoodie', 'L', 'Black', 1)]) })).body.data.order;
      for (const s of ['confirmed', 'processing', 'shipped']) await admin('PATCH', `/admin/orders/${o.id}/status`, { status: s });
      assert.equal((await admin('PATCH', `/admin/orders/${o.id}/status`, { status: 'cancelled' })).status, 409);
      assert.equal(await t.stockOf('momentum-tech-hoodie', 'L', 'Black'), before - 1);
    });
  });

  describe('dashboard: pending orders and low-stock warnings', () => {
    test('pending count matches reality', async () => {
      const d = (await admin('GET', '/admin/stats')).body.data; assert.equal(d.totals.pendingOrders, await models.Order.countDocuments({ status: 'pending' }));
    });
    test('low stock lists active variants at or below the threshold, lowest first, and ignores hidden products', async () => {
      await models.Product.updateOne({ slug: 'grip-training-gloves', variants: { $elemMatch: { size: 'S', color: 'Black' } } }, { $set: { 'variants.$.stock': 5 } });
      await models.Product.updateOne({ slug: 'grip-training-gloves', variants: { $elemMatch: { size: 'M', color: 'Black' } } }, { $set: { 'variants.$.stock': 6 } });
      const d = (await admin('GET', '/admin/stats')).body.data.lowStock;
      assert.equal(d.threshold, 5); assert.ok(d.items.length <= 10 && d.total >= d.items.length);
      assert.ok(d.items.every((i) => i.stock <= 5)); assert.deepEqual(d.items.map((i) => i.stock), [...d.items.map((i) => i.stock)].sort((a, b) => a - b));
      const all = await models.Product.aggregate([{ $match: { isActive: true } }, { $unwind: '$variants' }, { $match: { 'variants.stock': { $lte: 5 } } }, { $count: 'n' }]);
      assert.equal(d.total, all[0].n, 'total counts every low variant, not just the 10 shown');
      await models.Product.updateOne({ slug: 'grip-training-gloves' }, { isActive: false });
      const hidden = (await admin('GET', '/admin/stats')).body.data.lowStock; assert.ok(hidden.total < d.total, 'hidden products drop out of the warnings');
      assert.ok(!hidden.items.some((i) => i.slug === 'grip-training-gloves'));
    });
  });
});
