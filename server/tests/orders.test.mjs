// Customer-side order management: details, cancellation (with stock restoration) and secure guest tracking.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupApi, testUri } from './helpers.mjs';

const skip = !testUri('orders') && 'set MONGO_TEST_URI to run database tests';

describe('Customer orders, cancellation and tracking', { skip }, () => {
  let t, call, models;
  before(async () => { t = await setupApi('orders'); call = t.call; models = t.models; });
  after(async () => { if (t) await t.close(); });

  const setStock = (slug, size, color, stock) => models.Product.updateOne({ slug, variants: { $elemMatch: { size, color } } }, { $set: { 'variants.$.stock': stock } });
  /** Places a real order through the API and returns the serialized order. */
  const place = async (slug, size, color, qty = 1, { cookie, over } = {}) => {
    const r = await call('POST', '/orders', { cookie, body: t.orderBody([await t.line(slug, size, color, qty)], over) });
    assert.equal(r.status, 201, JSON.stringify(r.body)); return r.body.data.order;
  };
  const setStatus = (id, status) => models.Order.updateOne({ _id: id }, { status });
  const ALICE = { customer: { fullName: 'Alice Adams', email: 'alice@x.test', phone: '0100 000 0000' } };

  describe('viewing an order', () => {
    test('the owner sees full details; nobody else can see them', async () => {
      const o = await place('apex-performance-tee', 'M', 'Black', 2, { cookie: t.aliceCookie, over: ALICE });
      const r = await call('GET', `/orders/${o.orderNumber}`, { cookie: t.aliceCookie });
      assert.equal(r.status, 200); const d = r.body.data;
      assert.deepEqual([d.orderNumber, d.status, d.paymentMethod, d.total, d.items.length, d.canCancel], [o.orderNumber, 'pending', 'cod', 68 + 5, 1, true]);
      assert.equal(d.items[0].quantity, 2); assert.equal(d.statusHistory[0].status, 'pending'); assert.equal(d.shippingAddress.city, 'Cairo');
      assert.ok(!('userId' in d) && !('idempotencyKey' in d) && !('stockRestoredAt' in d), 'no internal/admin fields');
      assert.equal((await call('GET', `/orders/${o.orderNumber}`, { cookie: t.bobCookie })).status, 404, "another customer's order looks like a missing one");
      assert.equal((await call('GET', `/orders/${o.orderNumber}`)).status, 401);
      assert.equal((await call('GET', `/orders/${o.orderNumber.toLowerCase()}`, { cookie: t.aliceCookie })).status, 200, 'case-insensitive');
      assert.equal((await call('GET', '/orders/NOT-A-NUMBER', { cookie: t.aliceCookie })).status, 400);
      assert.equal((await call('GET', '/orders/VTX-261111-ABCD2345', { cookie: t.aliceCookie })).status, 404);
    });
    test('"my orders" lists newest first with cancel eligibility', async () => {
      const o2 = await place('apex-performance-tee', 'M', 'Black', 1, { cookie: t.aliceCookie, over: ALICE });
      const list = (await call('GET', '/orders/mine', { cookie: t.aliceCookie })).body.data;
      assert.equal(list[0].orderNumber, o2.orderNumber); assert.ok(list.every((o) => o.canCancel === true));
      await setStatus(o2.id, 'shipped'); assert.equal((await call('GET', '/orders/mine', { cookie: t.aliceCookie })).body.data[0].canCancel, false);
    });
  });

  describe('cancelling', () => {
    test('a pending order can be cancelled: stock, sold count and coupon use are all given back, exactly once', async () => {
      await setStock('titan-compression-tank', 'M', 'Black', 10); const sold = (await t.product('titan-compression-tank')).sold; const used = (await models.Coupon.findOne({ code: 'VORTEX10' })).usedCount;
      const o = await place('titan-compression-tank', 'M', 'Black', 3, { cookie: t.aliceCookie, over: { ...ALICE, couponCode: 'VORTEX10' } });
      assert.equal(await t.stockOf('titan-compression-tank', 'M', 'Black'), 7); assert.equal((await models.Coupon.findOne({ code: 'VORTEX10' })).usedCount, used + 1);

      const r = await call('POST', `/orders/${o.orderNumber}/cancel`, { cookie: t.aliceCookie });
      assert.equal(r.status, 200); assert.equal(r.body.data.status, 'cancelled'); assert.equal(r.body.data.canCancel, false);
      assert.deepEqual(r.body.data.statusHistory.map((h) => h.status), ['pending', 'cancelled']);
      assert.equal(await t.stockOf('titan-compression-tank', 'M', 'Black'), 10, 'stock restored'); assert.equal((await t.product('titan-compression-tank')).sold, sold, 'sold count restored');
      assert.equal((await models.Coupon.findOne({ code: 'VORTEX10' })).usedCount, used, 'coupon use given back');
      assert.ok((await models.Order.findById(o.id)).stockRestoredAt, 'restoration is recorded');

      const again = await call('POST', `/orders/${o.orderNumber}/cancel`, { cookie: t.aliceCookie });
      assert.equal(again.status, 409); assert.match(again.body.message, /already been cancelled/);
      assert.equal(await t.stockOf('titan-compression-tank', 'M', 'Black'), 10, 'a second cancel never restores twice');
    });
    test('5 simultaneous cancels of one order: exactly one wins and stock is restored exactly once', async () => {
      await setStock('nova-training-shorts', 'S', 'Black', 10);
      const o = await place('nova-training-shorts', 'S', 'Black', 4, { cookie: t.aliceCookie, over: ALICE });
      const rs = await Promise.all(Array.from({ length: 5 }, () => call('POST', `/orders/${o.orderNumber}/cancel`, { cookie: t.aliceCookie })));
      assert.equal(rs.filter((r) => r.status === 200).length, 1); assert.equal(rs.filter((r) => r.status === 409).length, 4);
      assert.equal(await t.stockOf('nova-training-shorts', 'S', 'Black'), 10);
    });
    test('customers can cancel while pending or confirmed, but not once processing, shipped or delivered', async () => {
      await setStock('drift-oversized-tee', 'XL', 'White', 20);
      for (const [status, ok] of [['confirmed', true], ['processing', false], ['shipped', false], ['delivered', false]]) {
        const o = await place('drift-oversized-tee', 'XL', 'White', 1, { cookie: t.aliceCookie, over: ALICE }); await setStatus(o.id, status);
        const before = await t.stockOf('drift-oversized-tee', 'XL', 'White');
        const r = await call('POST', `/orders/${o.orderNumber}/cancel`, { cookie: t.aliceCookie });
        assert.equal(r.status, ok ? 200 : 409, status);
        if (!ok) { assert.match(r.body.message, new RegExp(`because it is ${status}`)); assert.equal(await t.stockOf('drift-oversized-tee', 'XL', 'White'), before, 'stock untouched'); }
      }
    });
    test("nobody can cancel someone else's order", async () => {
      const o = await place('vortex-pro-cap', 'One Size', 'Black', 1, { cookie: t.aliceCookie, over: ALICE }); const before = await t.stockOf('vortex-pro-cap', 'One Size', 'Black');
      assert.equal((await call('POST', `/orders/${o.orderNumber}/cancel`, { cookie: t.bobCookie })).status, 404);
      assert.equal((await call('POST', `/orders/${o.orderNumber}/cancel`)).status, 401);
      assert.equal((await models.Order.findById(o.id)).status, 'pending'); assert.equal(await t.stockOf('vortex-pro-cap', 'One Size', 'Black'), before);
    });
    test('cancelling still works if the product has since been deleted', async () => {
      const o = await place('core-duffel-bag', 'One Size', 'Navy', 1, { cookie: t.aliceCookie, over: ALICE });
      await models.Product.deleteOne({ slug: 'core-duffel-bag' });
      assert.equal((await call('POST', `/orders/${o.orderNumber}/cancel`, { cookie: t.aliceCookie })).status, 200);
    });
  });

  describe('guest order tracking (order number + email)', () => {
    let guestOrder;
    before(async () => { guestOrder = await place('surge-training-shorts', 'L', 'Navy', 2, { over: { customer: { fullName: 'Gina Guest', email: 'Gina.Guest@Example.com', phone: '0111 222 3333' } } }); });
    const lookup = (orderNumber, email) => call('POST', '/orders/lookup', { body: { orderNumber, email } });

    test('the right number and email show the order (case and spacing do not matter)', async () => {
      for (const [n, e] of [[guestOrder.orderNumber, 'gina.guest@example.com'], [guestOrder.orderNumber.toLowerCase(), '  GINA.GUEST@EXAMPLE.COM ']]) {
        const r = await lookup(n, e); assert.equal(r.status, 200); assert.equal(r.body.data.orderNumber, guestOrder.orderNumber);
        assert.equal(r.body.data.items[0].name, 'Surge Training Shorts'); assert.equal(r.body.data.statusHistory[0].status, 'pending');
      }
    });
    test('wrong email, wrong number and malformed input fail without revealing which part was wrong', async () => {
      const a = await lookup(guestOrder.orderNumber, 'someone-else@example.com'); const b = await lookup('VTX-261111-ABCD2345', 'gina.guest@example.com');
      assert.equal(a.status, 404); assert.equal(b.status, 404); assert.equal(a.body.message, b.body.message);
      assert.equal((await lookup('garbage', 'gina.guest@example.com')).status, 400); assert.equal((await lookup(guestOrder.orderNumber, 'not-an-email')).status, 400);
      assert.equal((await call('POST', '/orders/lookup', { body: { orderNumber: { $ne: null }, email: { $ne: null } } })).status, 400);
    });
    test('the tracking response never includes internal data', async () => {
      const text = JSON.stringify((await lookup(guestOrder.orderNumber, 'gina.guest@example.com')).body);
      for (const secret of ['idempotencyKey', 'userId', 'confirmationEmail', 'stockRestoredAt', '"by"']) assert.ok(!text.includes(secret), secret);
    });
    test('a logged-in customer\'s order can also be tracked with number + email', async () => {
      const o = await place('apex-performance-tee', 'L', 'White', 1, { cookie: t.bobCookie, over: { customer: { fullName: 'Bob Brown', email: 'bob@x.test', phone: '0100 000 0000' } } });
      assert.equal((await lookup(o.orderNumber, 'bob@x.test')).status, 200);
    });
    test('a guest can cancel through the same lookup while the order is still eligible, and stock is restored', async () => {
      await setStock('surge-training-shorts', 'M', 'Grey', 10);
      const o = await place('surge-training-shorts', 'M', 'Grey', 2, { over: { customer: { fullName: 'Gina Guest', email: 'gina.guest@example.com', phone: '0111 222 3333' } } });
      assert.equal((await call('POST', '/orders/lookup/cancel', { body: { orderNumber: o.orderNumber, email: 'wrong@example.com' } })).status, 404);
      assert.equal(await t.stockOf('surge-training-shorts', 'M', 'Grey'), 8, 'a wrong email cancels nothing');
      const r = await call('POST', '/orders/lookup/cancel', { body: { orderNumber: o.orderNumber, email: 'gina.guest@example.com' } });
      assert.equal(r.status, 200); assert.equal(r.body.data.status, 'cancelled'); assert.equal(await t.stockOf('surge-training-shorts', 'M', 'Grey'), 10);
      await setStatus(guestOrder.id, 'shipped');
      assert.equal((await call('POST', '/orders/lookup/cancel', { body: { orderNumber: guestOrder.orderNumber, email: 'gina.guest@example.com' } })).status, 409);
    });
  });
});
