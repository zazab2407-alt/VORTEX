// Admin coupon management: authorization, validation, safe edit/delete rules, and that checkout never trusts the browser.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupApi, testUri } from './helpers.mjs';

const skip = !testUri('coupons') && 'set MONGO_TEST_URI to run database tests';
const future = (days = 30) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
const past = (days = 5) => new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);

describe('Admin coupon management', { skip }, () => {
  let t, call, models, admin;
  before(async () => { t = await setupApi('coupons'); call = t.call; models = t.models; admin = t.adminCookie; });
  after(async () => { if (t) await t.close(); });

  const create = (over = {}, cookie = admin) => call('POST', '/admin/coupons', { cookie, body: { code: 'SAVE15', type: 'percentage', value: 15, ...over } });
  const place = async (couponCode, qty = 1, extra = {}) => {
    const r = await call('POST', '/orders', { body: t.orderBody([await t.line('apex-performance-tee', 'M', 'Black', qty)], { couponCode, ...extra }) });
    return r;
  };

  describe('access control', () => {
    test('anonymous users get 401 and customers get 403 on every coupon endpoint', async () => {
      const calls = [['GET', '/admin/coupons'], ['POST', '/admin/coupons'], ['GET', '/admin/coupons/507f1f77bcf86cd799439011'], ['PATCH', '/admin/coupons/507f1f77bcf86cd799439011'], ['DELETE', '/admin/coupons/507f1f77bcf86cd799439011']];
      for (const [m, p] of calls) {
        assert.equal((await call(m, p, { body: {} })).status, 401, `anon ${m} ${p}`);
        assert.equal((await call(m, p, { cookie: t.aliceCookie, body: {} })).status, 403, `customer ${m} ${p}`);
      }
    });
  });

  describe('creating', () => {
    test('creates a percentage coupon: code upper-cased, starts unused and active', async () => {
      const r = await create({ code: 'save15', minSubtotal: 20, usageLimit: 3, expiresAt: future() });
      assert.equal(r.status, 201, JSON.stringify(r.body)); const c = r.body.data;
      assert.deepEqual([c.code, c.type, c.value, c.minSubtotal, c.usageLimit, c.usedCount, c.isActive, c.state, c.canDelete], ['SAVE15', 'percentage', 15, 20, 3, 0, true, 'active', true]);
      assert.ok(c.expiresAt.startsWith(future()), 'a date means the end of that day');
    });
    test('creates a fixed coupon with no limits', async () => {
      const r = await create({ code: 'FIVEOFF', type: 'fixed', value: 5 });
      assert.equal(r.status, 201); assert.equal(r.body.data.expiresAt, null); assert.equal(r.body.data.usageLimit, null); assert.equal(r.body.data.minSubtotal, 0);
    });
    test('a duplicate code is a 409', async () => assert.equal((await create({ code: 'FIVEOFF' })).status, 409));
    test('usedCount sent by the client is ignored', async () => {
      const r = await create({ code: 'SNEAKY', usedCount: 99, isActive: true }); assert.equal(r.status, 201); assert.equal(r.body.data.usedCount, 0);
    });
    test('invalid rules are rejected with 400', async () => {
      const bad = [
        { code: 'AB' }, { code: 'has space' }, { code: undefined }, { type: 'bogus' }, { type: undefined }, { value: 0 }, { value: -5 }, { value: 'ten' }, { value: undefined },
        { value: 150 }, { type: 'fixed', value: 100001 }, { minSubtotal: -1 }, { usageLimit: 0 }, { usageLimit: 1.5 }, { expiresAt: 'tomorrow-ish' }, { expiresAt: past() }, { isActive: 'maybe' },
      ];
      for (const [i, over] of bad.entries()) {
        const r = await create({ code: `BAD${i}X`, ...over });
        assert.equal(r.status, 400, `${JSON.stringify(over)} -> ${r.status} ${JSON.stringify(r.body)}`);
      }
      assert.equal(await models.Coupon.countDocuments({ code: /^BAD\d+X$/ }), 0);
    });
  });

  describe('listing and viewing', () => {
    test('lists coupons with a state, supports search and a status filter', async () => {
      await models.Coupon.create({ code: 'OLDONE', type: 'percentage', value: 10, expiresAt: new Date(Date.now() - 864e5) });
      await models.Coupon.create({ code: 'GONEALL', type: 'percentage', value: 10, usageLimit: 1, usedCount: 1 });
      const all = (await call('GET', '/admin/coupons', { cookie: admin })).body.data;
      const state = (code) => all.find((c) => c.code === code)?.state;
      assert.equal(state('SAVE15'), 'active'); assert.equal(state('OLDONE'), 'expired'); assert.equal(state('GONEALL'), 'exhausted');
      assert.deepEqual((await call('GET', '/admin/coupons?q=old', { cookie: admin })).body.data.map((c) => c.code), ['OLDONE']);
      assert.deepEqual((await call('GET', '/admin/coupons?status=expired', { cookie: admin })).body.data.map((c) => c.code), ['OLDONE']);
      assert.equal((await call('GET', '/admin/coupons?status=nonsense', { cookie: admin })).status, 400);
    });
    test('returns one coupon, 404 for a missing one and 400 for a malformed id', async () => {
      const id = (await models.Coupon.findOne({ code: 'SAVE15' }))._id;
      assert.equal((await call('GET', `/admin/coupons/${id}`, { cookie: admin })).body.data.code, 'SAVE15');
      assert.equal((await call('GET', '/admin/coupons/507f1f77bcf86cd799439011', { cookie: admin })).status, 404);
      assert.equal((await call('GET', '/admin/coupons/not-an-id', { cookie: admin })).status, 400);
    });
  });

  describe('editing, activating and deleting', () => {
    test('an unused coupon can change code, value, minimum and expiry, and expiry can be cleared', async () => {
      const id = (await models.Coupon.findOne({ code: 'SNEAKY' }))._id;
      const r = await call('PATCH', `/admin/coupons/${id}`, { cookie: admin, body: { code: 'RENAMED', value: 20, minSubtotal: 10, expiresAt: future(10) } });
      assert.equal(r.status, 200, JSON.stringify(r.body)); assert.deepEqual([r.body.data.code, r.body.data.value, r.body.data.minSubtotal], ['RENAMED', 20, 10]);
      const cleared = await call('PATCH', `/admin/coupons/${id}`, { cookie: admin, body: { expiresAt: null, usageLimit: null } });
      assert.equal(cleared.body.data.expiresAt, null); assert.equal(cleared.body.data.usageLimit, null);
    });
    test('edits are validated too (percentage over 100, past expiry, bad type)', async () => {
      const id = (await models.Coupon.findOne({ code: 'RENAMED' }))._id;
      for (const body of [{ value: 101 }, { expiresAt: past() }, { type: 'bogus' }, { usageLimit: 0 }]) assert.equal((await call('PATCH', `/admin/coupons/${id}`, { cookie: admin, body })).status, 400, JSON.stringify(body));
      assert.equal((await models.Coupon.findById(id)).value, 20, 'a rejected edit changes nothing');
    });
    test('an expired coupon can still be edited without being forced to pick a new date', async () => {
      const id = (await models.Coupon.findOne({ code: 'OLDONE' }))._id;
      assert.equal((await call('PATCH', `/admin/coupons/${id}`, { cookie: admin, body: { value: 12 } })).status, 200);
    });
    test('deactivating stops checkout from accepting it; reactivating allows it again', async () => {
      await create({ code: 'TOGGLE5', type: 'fixed', value: 5 });
      const id = (await models.Coupon.findOne({ code: 'TOGGLE5' }))._id;
      assert.equal((await call('PATCH', `/admin/coupons/${id}`, { cookie: admin, body: { isActive: false } })).body.data.state, 'inactive');
      const blocked = await place('TOGGLE5');
      assert.equal(blocked.status, 400); assert.match(blocked.body.message, /no longer active/);
      await call('PATCH', `/admin/coupons/${id}`, { cookie: admin, body: { isActive: true } });
      assert.equal((await place('TOGGLE5')).status, 201);
    });
    test('an unused coupon can be deleted, and is gone afterwards', async () => {
      await create({ code: 'DELME', type: 'fixed', value: 1 });
      const id = (await models.Coupon.findOne({ code: 'DELME' }))._id;
      assert.equal((await call('DELETE', `/admin/coupons/${id}`, { cookie: admin })).status, 200);
      assert.equal((await call('GET', `/admin/coupons/${id}`, { cookie: admin })).status, 404);
      assert.equal((await call('DELETE', `/admin/coupons/${id}`, { cookie: admin })).status, 404);
    });
    test('a coupon used by an order can be neither deleted nor renamed, but can be deactivated', async () => {
      await create({ code: 'USEDONE', type: 'percentage', value: 10 });
      const id = (await models.Coupon.findOne({ code: 'USEDONE' }))._id;
      assert.equal((await place('USEDONE')).status, 201);
      const view = (await call('GET', `/admin/coupons/${id}`, { cookie: admin })).body.data;
      assert.deepEqual([view.usedCount, view.orderCount, view.canDelete], [1, 1, false]);
      const del = await call('DELETE', `/admin/coupons/${id}`, { cookie: admin });
      assert.equal(del.status, 409); assert.match(del.body.message, /Deactivate/);
      assert.ok(await models.Coupon.findById(id), 'still there');
      assert.equal((await call('PATCH', `/admin/coupons/${id}`, { cookie: admin, body: { code: 'NEWNAME' } })).status, 409);
      assert.equal((await call('PATCH', `/admin/coupons/${id}`, { cookie: admin, body: { code: 'usedone', value: 15 } })).status, 200, 'same code (any case) is not a rename');
      assert.equal((await call('PATCH', `/admin/coupons/${id}`, { cookie: admin, body: { isActive: false } })).body.data.state, 'inactive');
    });
    test('a coupon whose only order was cancelled is still kept (the code is written on that order)', async () => {
      await create({ code: 'CANCELLED1', type: 'fixed', value: 2 });
      const r = await place('CANCELLED1'); assert.equal(r.status, 201);
      const cancel = await call('PATCH', `/admin/orders/${r.body.data.order.id}/status`, { cookie: admin, body: { status: 'cancelled' } });
      assert.equal(cancel.status, 200, JSON.stringify(cancel.body));
      assert.equal((await models.Coupon.findOne({ code: 'CANCELLED1' })).usedCount, 0, 'the redemption was given back');
      const id = (await models.Coupon.findOne({ code: 'CANCELLED1' }))._id;
      assert.equal((await call('DELETE', `/admin/coupons/${id}`, { cookie: admin })).status, 409);
    });
    test('the usage limit cannot be set below how often the coupon was already used', async () => {
      await create({ code: 'LIMITED', type: 'fixed', value: 1, usageLimit: 5 });
      await models.Coupon.updateOne({ code: 'LIMITED' }, { usedCount: 3 });
      const id = (await models.Coupon.findOne({ code: 'LIMITED' }))._id;
      assert.equal((await call('PATCH', `/admin/coupons/${id}`, { cookie: admin, body: { usageLimit: 2 } })).status, 400);
      assert.equal((await call('PATCH', `/admin/coupons/${id}`, { cookie: admin, body: { usageLimit: 3 } })).status, 200);
      assert.equal((await models.Coupon.findOne({ code: 'LIMITED' })).usedCount, 3, 'editing never touches usedCount');
    });
  });

  describe('checkout enforces the rules on the server', () => {
    test('discount values sent by the browser are ignored: the stored rule decides', async () => {
      await create({ code: 'TEN10', type: 'percentage', value: 10 });
      const r = await place('TEN10', 1, { discount: 9999, total: 0.01, couponValue: 100 });
      assert.equal(r.status, 201, JSON.stringify(r.body)); const o = r.body.data.order;
      assert.deepEqual([o.subtotal, o.discount, o.total], [34, 3.4, 35.6]); // 34 - 10% = 30.60, plus 5.00 shipping (under the free-shipping threshold)
    });
    test('an expired coupon (expired after it was created) is refused at checkout', async () => {
      await models.Coupon.create({ code: 'LAPSED', type: 'fixed', value: 5, expiresAt: new Date(Date.now() - 1000) });
      const r = await place('LAPSED'); assert.equal(r.status, 400); assert.match(r.body.message, /expired/);
    });
    test('the minimum order is enforced, and the message uses the store currency', async () => {
      await create({ code: 'BIGSPEND', type: 'percentage', value: 10, minSubtotal: 500 });
      const r = await place('BIGSPEND'); assert.equal(r.status, 400); assert.match(r.body.message, /minimum order of \$500\.00/);
    });
    test('a usage limit of 1 lets exactly one of two parallel checkouts use the coupon', async () => {
      await create({ code: 'ONLYONE', type: 'fixed', value: 3, usageLimit: 1 });
      const rs = await Promise.all([place('ONLYONE'), place('ONLYONE')]);
      assert.equal(rs.filter((r) => r.status === 201).length, 1, JSON.stringify(rs.map((r) => r.body.message)));
      assert.ok(rs.filter((r) => r.status !== 201).every((r) => [400, 409].includes(r.status)), 'the loser is told the coupon is used up');
      assert.equal((await models.Coupon.findOne({ code: 'ONLYONE' })).usedCount, 1);
    });
    test('the demo coupon from the seed keeps working', async () => assert.equal((await place('VORTEX10')).status, 201));
  });
});
