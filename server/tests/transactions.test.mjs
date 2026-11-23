// Checkout and cancellation consistency: no overselling, stock restored exactly once, atomic through failures.
// Run it against a standalone MongoDB (tests the fallback path) AND against a replica set (also runs the transaction-only tests below).
import { test, describe, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupApi, testUri } from './helpers.mjs';

const skip = !testUri('transactions') && 'set MONGO_TEST_URI to run database tests';

describe('Checkout and cancellation consistency', { skip }, () => {
  let t, call, models, tx, supported, admin;
  before(async () => {
    t = await setupApi('transactions'); call = t.call; models = t.models; admin = t.adminCookie;
    tx = await import('../src/utils/transaction.js');
    supported = await tx.transactionsSupported();
    console.log(`  [transactions] MongoDB transactions supported: ${supported} (${supported ? 'replica set' : 'standalone: fallback path'})`);
  });
  after(async () => { if (t) await t.close(); });

  const setStock = (slug, size, color, stock) => models.Product.updateOne({ slug, variants: { $elemMatch: { size, color } } }, { $set: { 'variants.$.stock': stock } });
  const order = async (items, over = {}) => call('POST', '/orders', { body: t.orderBody(items, over) });
  const coupon = async (code) => (await models.Coupon.findOne({ code })).usedCount;

  // Methods patched by tests are always put back
  const originals = {};
  const patch = (target, name, fn) => { const k = `${target.modelName ?? 'x'}.${name}`; originals[k] ??= [target, name, target[name]]; target[name] = fn; };
  afterEach(() => { for (const [target, name, fn] of Object.values(originals)) target[name] = fn; for (const k of Object.keys(originals)) delete originals[k]; });

  describe('runInTransaction', () => {
    test('passes a session only when the server supports transactions, and returns the work’s result', async () => {
      const r = await tx.runInTransaction(async (session) => ({ hasSession: Boolean(session) }));
      assert.deepEqual(r, { hasSession: supported });
    });
    test('errors thrown by the work are rethrown unchanged', async () => {
      await assert.rejects(tx.runInTransaction(async () => { throw new RangeError('boom'); }), (e) => e instanceof RangeError && e.message === 'boom');
    });
    test('if detection was wrong ("not a replica set"), it falls back to running without a session and stops trying', async () => {
      const mongoose = t.mongoose; const realAdmin = mongoose.connection.db.admin; const realStart = mongoose.startSession;
      tx.resetTransactionSupport();
      mongoose.connection.db.admin = () => ({ command: async () => ({ setName: 'rs0' }) }); // pretend it is a replica set
      mongoose.startSession = async () => ({ withTransaction: async () => { const e = new Error('Transaction numbers are only allowed on a replica set member or mongos'); e.code = 20; throw e; }, endSession: async () => {} });
      const warn = console.warn; console.warn = () => {};
      try {
        assert.equal(await tx.transactionsSupported(), true);
        assert.deepEqual(await tx.runInTransaction(async (s) => ({ session: s })), { session: null });
        assert.equal(await tx.transactionsSupported(), false, 'remembered');
      } finally { console.warn = warn; mongoose.connection.db.admin = realAdmin; mongoose.startSession = realStart; tx.resetTransactionSupport(); }
      assert.equal(await tx.transactionsSupported(), supported, 'real detection is back');
    });
  });

  describe('checkout (both modes)', () => {
    test('takes stock, counts the sale, redeems the coupon and stores the order together', async () => {
      await setStock('nova-training-shorts', 'S', 'Black', 10); const sold = (await t.product('nova-training-shorts')).sold; const used = await coupon('VORTEX10');
      const r = await order([await t.line('nova-training-shorts', 'S', 'Black', 3)], { couponCode: 'VORTEX10' });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      assert.equal(await t.stockOf('nova-training-shorts', 'S', 'Black'), 7); assert.equal((await t.product('nova-training-shorts')).sold, sold + 3);
      assert.equal(await coupon('VORTEX10'), used + 1);
      const stored = await models.Order.findById(r.body.data.order.id); assert.equal(stored.couponRedeemed, true); assert.equal(stored.items[0].quantity, 3);
    });
    test('a failure on the 2nd line leaves the 1st line’s stock and the coupon untouched (nothing half-done)', async () => {
      await setStock('apex-performance-tee', 'M', 'Black', 10); await setStock('vortex-pro-cap', 'One Size', 'Black', 10);
      const used = await coupon('VORTEX10'); const capId = String((await t.product('vortex-pro-cap'))._id); const teeSold = (await t.product('apex-performance-tee')).sold;
      const real = models.Product.reserveStock;
      patch(models.Product, 'reserveStock', async function reserve(pid, ...rest) { return String(pid) === capId ? false : real.call(this, pid, ...rest); });
      const r = await order([await t.line('apex-performance-tee', 'M', 'Black', 2), await t.line('vortex-pro-cap', 'One Size', 'Black', 1)], { couponCode: 'VORTEX10' });
      assert.equal(r.status, 409); assert.match(r.body.message, /sold out|less stock/);
      assert.equal(await t.stockOf('apex-performance-tee', 'M', 'Black'), 10, 'first line was given back');
      assert.equal(await t.stockOf('vortex-pro-cap', 'One Size', 'Black'), 10);
      assert.equal(await coupon('VORTEX10'), used);
      assert.equal((await t.product('apex-performance-tee')).sold, teeSold, 'the sold counter was given back as well');
    });
    test('a crash while saving the order gives everything back (compensation or abort)', async () => {
      await setStock('titan-compression-tank', 'M', 'Black', 6); const used = await coupon('VORTEX10'); const before = await models.Order.countDocuments(); const sold = (await t.product('titan-compression-tank')).sold;
      patch(models.Order.prototype, 'save', async () => { throw new Error('simulated crash while saving the order'); });
      const logged = console.error; console.error = () => {};
      let r; try { r = await order([await t.line('titan-compression-tank', 'M', 'Black', 2)], { couponCode: 'VORTEX10' }); } finally { console.error = logged; }
      assert.equal(r.status, 500);
      assert.equal(await t.stockOf('titan-compression-tank', 'M', 'Black'), 6); assert.equal((await t.product('titan-compression-tank')).sold, sold);
      assert.equal(await coupon('VORTEX10'), used); assert.equal(await models.Order.countDocuments(), before);
    });
    test('never oversells: 8 simultaneous buyers of the last 3 units get exactly 3 orders', async () => {
      await setStock('titan-compression-tank', 'L', 'Black', 3); const sold = (await t.product('titan-compression-tank')).sold; const before = await models.Order.countDocuments();
      const line = await t.line('titan-compression-tank', 'L', 'Black', 1);
      const rs = await Promise.all(Array.from({ length: 8 }, (_, i) => order([line], { customer: { fullName: `Buyer ${i}`, email: `buyer${i}@example.com`, phone: '0100 000 0000' } })));
      const ok = rs.filter((r) => r.status === 201).length;
      assert.equal(ok, 3, JSON.stringify(rs.map((r) => r.status)));
      assert.ok(rs.filter((r) => r.status !== 201).every((r) => r.status === 409), 'the others are told it sold out');
      assert.equal(await t.stockOf('titan-compression-tank', 'L', 'Black'), 0); assert.equal((await t.product('titan-compression-tank')).sold, sold + 3);
      assert.equal(await models.Order.countDocuments(), before + 3);
    });
    test('the same checkout submitted twice (same idempotency key) creates one order and takes stock once', async () => {
      await setStock('nova-training-shorts', 'M', 'Black', 10);
      const body = t.orderBody([await t.line('nova-training-shorts', 'M', 'Black', 2)], { idempotencyKey: 'tx-key-12345678-abcdef' });
      const [a, b] = await Promise.all([call('POST', '/orders', { body }), call('POST', '/orders', { body })]);
      assert.ok([a, b].every((r) => [200, 201].includes(r.status)), JSON.stringify([a.body, b.body]));
      assert.equal(a.body.data.order.orderNumber, b.body.data.order.orderNumber);
      assert.equal(await t.stockOf('nova-training-shorts', 'M', 'Black'), 8, 'stock taken once');
    });
  });

  describe('cancellation (both modes)', () => {
    test('restores stock, sold count and coupon exactly once, even with 6 simultaneous cancels', async () => {
      await setStock('nova-training-shorts', 'L', 'Black', 10); const sold = (await t.product('nova-training-shorts')).sold; const used = await coupon('VORTEX10');
      const placed = await order([await t.line('nova-training-shorts', 'L', 'Black', 4)], { couponCode: 'VORTEX10' }); assert.equal(placed.status, 201);
      assert.equal(await t.stockOf('nova-training-shorts', 'L', 'Black'), 6);
      const rs = await Promise.all(Array.from({ length: 6 }, () => call('PATCH', `/admin/orders/${placed.body.data.order.id}/status`, { cookie: admin, body: { status: 'cancelled' } })));
      assert.equal(rs.filter((r) => r.status === 200).length, 1, JSON.stringify(rs.map((r) => r.status)));
      assert.ok(rs.filter((r) => r.status !== 200).every((r) => r.status === 409));
      assert.equal(await t.stockOf('nova-training-shorts', 'L', 'Black'), 10, 'restored once, not six times');
      assert.equal((await t.product('nova-training-shorts')).sold, sold); assert.equal(await coupon('VORTEX10'), used);
      assert.ok((await models.Order.findById(placed.body.data.order.id)).stockRestoredAt);
    });
  });

  describe('transaction-only guarantees (need a replica set)', { skip: undefined }, () => {
    const needsReplicaSet = (name, fn) => test(name, async (ctx) => { if (!supported) return ctx.skip('MongoDB is standalone: start a replica set to run this (see README)'); await fn(); });

    needsReplicaSet('a crash during checkout is rolled back by the DATABASE even if cleanup code never runs', async () => {
      await setStock('apex-performance-tee', 'L', 'Black', 9); const used = await coupon('VORTEX10'); const before = await models.Order.countDocuments();
      let cleanupRan = false;
      patch(models.Product, 'releaseStock', async () => { cleanupRan = true; throw new Error('cleanup crashed too'); });
      patch(models.Order.prototype, 'save', async () => { throw new Error('simulated crash while saving the order'); });
      const logged = console.error; console.error = () => {};
      let r; try { r = await order([await t.line('apex-performance-tee', 'L', 'Black', 3)], { couponCode: 'VORTEX10' }); } finally { console.error = logged; }
      assert.equal(r.status, 500); assert.equal(cleanupRan, false, 'no manual compensation was needed');
      assert.equal(await t.stockOf('apex-performance-tee', 'L', 'Black'), 9); assert.equal(await coupon('VORTEX10'), used); assert.equal(await models.Order.countDocuments(), before);
    });

    needsReplicaSet('a crash during cancellation leaves the order un-cancelled; a retry then restores stock exactly once', async () => {
      await setStock('apex-performance-tee', 'S', 'Black', 10); await setStock('vortex-pro-cap', 'One Size', 'Black', 10); const used = await coupon('VORTEX10');
      const placed = await order([await t.line('apex-performance-tee', 'S', 'Black', 2), await t.line('vortex-pro-cap', 'One Size', 'Black', 1)], { couponCode: 'VORTEX10' });
      assert.equal(placed.status, 201); const id = placed.body.data.order.id;
      const stockAfterOrder = [await t.stockOf('apex-performance-tee', 'S', 'Black'), await t.stockOf('vortex-pro-cap', 'One Size', 'Black')];
      assert.deepEqual(stockAfterOrder, [8, 9]);

      const real = models.Product.releaseStock; let calls = 0;
      patch(models.Product, 'releaseStock', async function release(...a) { if (++calls === 2) throw new Error('simulated crash halfway through restoring stock'); return real.apply(this, a); });
      const logged = console.error; console.error = () => {};
      let r; try { r = await call('PATCH', `/admin/orders/${id}/status`, { cookie: admin, body: { status: 'cancelled' } }); } finally { console.error = logged; }
      assert.equal(r.status, 500);
      const mid = await models.Order.findById(id);
      assert.equal(mid.status, 'pending', 'the status flip was rolled back too'); assert.equal(mid.stockRestoredAt, undefined); assert.equal(mid.statusHistory.length, 1);
      assert.deepEqual([await t.stockOf('apex-performance-tee', 'S', 'Black'), await t.stockOf('vortex-pro-cap', 'One Size', 'Black')], stockAfterOrder, 'no half-restored stock');
      assert.equal(await coupon('VORTEX10'), used + 1);

      models.Product.releaseStock = real;
      assert.equal((await call('PATCH', `/admin/orders/${id}/status`, { cookie: admin, body: { status: 'cancelled' } })).status, 200);
      assert.deepEqual([await t.stockOf('apex-performance-tee', 'S', 'Black'), await t.stockOf('vortex-pro-cap', 'One Size', 'Black')], [10, 10]);
      assert.equal(await coupon('VORTEX10'), used);
      assert.equal((await call('PATCH', `/admin/orders/${id}/status`, { cookie: admin, body: { status: 'cancelled' } })).status, 409);
      assert.deepEqual([await t.stockOf('apex-performance-tee', 'S', 'Black'), await t.stockOf('vortex-pro-cap', 'One Size', 'Black')], [10, 10], 'still not restored twice');
    });

    needsReplicaSet('a customer-initiated cancel is atomic as well', async () => {
      await setStock('nova-training-shorts', 'XL', 'Black', 5);
      const placed = await call('POST', '/orders', { cookie: t.aliceCookie, body: t.orderBody([await t.line('nova-training-shorts', 'XL', 'Black', 2)], { customer: { fullName: 'Alice Adams', email: 'alice@x.test', phone: '0100 000 0000' } }) });
      assert.equal(placed.status, 201, JSON.stringify(placed.body));
      const r = await call('POST', `/orders/${placed.body.data.order.orderNumber}/cancel`, { cookie: t.aliceCookie });
      assert.equal(r.status, 200); assert.equal(await t.stockOf('nova-training-shorts', 'XL', 'Black'), 5);
    });
  });
});
