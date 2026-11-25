// Coupon edits are atomic: every requested field is applied together or none is. A usage limit can never be set below the
// live usage count, even when a checkout redeems the coupon at the same moment. Needs MONGO_TEST_URI (skips without it).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupApi, testUri } from './helpers.mjs';

const skip = !testUri('couponatomic') && 'set MONGO_TEST_URI to run database tests';
const future = (days = 30) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);

describe('Coupon edits are atomic', { skip }, () => {
  let t;
  let admin;
  before(async () => { t = await setupApi('couponatomic'); admin = t.adminCookie; });
  after(async () => { if (t) await t.close(); });

  const make = (code, over = {}) => t.models.Coupon.create({ code, type: 'fixed', value: 2, ...over });
  const patch = (id, body) => t.call('PATCH', `/admin/coupons/${id}`, { cookie: admin, body });
  const stored = (code) => t.models.Coupon.findOne({ code });
  const place = async (couponCode) => t.call('POST', '/orders', { body: t.orderBody([await t.line('apex-performance-tee', 'M', 'Black', 1)], { couponCode }) });

  test('a refused limit change applies NONE of the other requested fields', async () => {
    const c = await make('ATOM-LIMIT', { usageLimit: 10, usedCount: 4 });
    const r = await patch(c._id, { value: 9, minSubtotal: 50, isActive: false, usageLimit: 2 });
    assert.equal(r.status, 400, JSON.stringify(r.body));
    const after = await stored('ATOM-LIMIT');
    assert.deepEqual([after.value, after.minSubtotal, after.isActive, after.usageLimit, after.usedCount], [2, 0, true, 10, 4], 'nothing partially applied');
  });

  test('a limit equal to the current usage count is accepted', async () => {
    const c = await make('ATOM-EQUAL', { usageLimit: 10, usedCount: 4 });
    const r = await patch(c._id, { usageLimit: 4 });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal((await stored('ATOM-EQUAL')).usageLimit, 4);
  });

  test('a multi-field edit of an unused coupon is applied entirely, including clearing fields', async () => {
    const c = await make('ATOM-ALL', { usageLimit: 5, expiresAt: new Date(Date.now() + 864e5) });
    const r = await patch(c._id, { value: 7, minSubtotal: 30, usageLimit: null, expiresAt: null, code: 'atom-all-two' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const after = await stored('ATOM-ALL-TWO');
    assert.deepEqual([after.value, after.minSubtotal, after.usageLimit, after.expiresAt ?? null], [7, 30, undefined, null]);
  });

  test('a used coupon keeps its code, but its other fields can still be edited (business rule preserved)', async () => {
    const c = await make('ATOM-USED', { usedCount: 1 });
    const r = await patch(c._id, { code: 'ATOM-RENAMED', value: 4 });
    assert.equal(r.status, 409);
    assert.equal((await stored('ATOM-USED')).value, 2, 'the value in the refused request was not applied');
    const ok = await patch(c._id, { value: 4, expiresAt: future(10) });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal((await stored('ATOM-USED')).value, 4);
  });

  test('an invalid field in an otherwise valid request refuses the whole edit', async () => {
    const c = await make('ATOM-INVALID');
    const r = await patch(c._id, { value: 3, type: 'percentage', minSubtotal: 10, usageLimit: 0 });
    assert.equal(r.status, 400);
    const after = await stored('ATOM-INVALID');
    assert.deepEqual([after.value, after.type, after.minSubtotal], [2, 'fixed', 0]);
  });

  test('usedCount sent by the client is never written', async () => {
    const c = await make('ATOM-COUNT', { usedCount: 2 });
    await patch(c._id, { value: 5, usedCount: 0 });
    assert.equal((await stored('ATOM-COUNT')).usedCount, 2);
  });

  test('concurrency: a limit reduction running alongside checkouts never leaves usedCount above usageLimit', async () => {
    const c = await make('RACE-LIMIT', { usageLimit: 10, usedCount: 0 });
    const attempts = [...Array(6)].map(() => place('RACE-LIMIT'));
    const edit = patch(c._id, { usageLimit: 3 });
    const [editRes, ...orders] = await Promise.all([edit, ...attempts]);
    const after = await stored('RACE-LIMIT');
    assert.ok(after.usedCount <= after.usageLimit, `usedCount ${after.usedCount} exceeds usageLimit ${after.usageLimit}`);
    if (editRes.status === 200) assert.equal(after.usageLimit, 3);
    else assert.equal(after.usageLimit, 10, 'a refused edit left the limit unchanged');
    assert.equal(orders.filter((r) => r.status === 201).length, after.usedCount, 'every redemption is recorded exactly once');
  });

  test('redemption is bound to the code: a stale code cannot redeem a renamed coupon (model level)', async () => {
    const c = await make('BIND-OLD', { usageLimit: 5 });
    await t.models.Coupon.updateOne({ _id: c._id }, { code: 'BIND-NEW' });
    assert.equal(await t.models.Coupon.redeem(c._id, { code: 'BIND-OLD' }), null, 'the old code no longer redeems');
    assert.equal((await t.models.Coupon.findById(c._id)).usedCount, 0, 'the refused redemption recorded nothing');
    const ok = await t.models.Coupon.redeem(c._id, { code: 'BIND-NEW' });
    assert.equal(ok.usedCount, 1, 'the current code still redeems');
  });

  test('after a rename, checkout with the old code is refused and nothing is recorded under it', async () => {
    const c = await make('STALE-OLD', { usageLimit: 20 });
    assert.equal((await patch(c._id, { code: 'STALE-NEW' })).status, 200);
    const r = await place('STALE-OLD');
    assert.equal(r.status, 400, JSON.stringify(r.body));
    assert.equal(await t.models.Order.countDocuments({ couponCode: 'STALE-OLD' }), 0);
    assert.equal((await stored('STALE-NEW')).usedCount, 0);
  });

  test('concurrency: a code change cannot race a redemption of the old code', async () => {
    const c = await make('RACE-CODE', { usageLimit: 20 });
    const [editRes] = await Promise.all([patch(c._id, { code: 'RACE-CODE-NEW' }), place('RACE-CODE'), place('RACE-CODE')]);
    const usedOldCode = await t.models.Order.countDocuments({ couponCode: 'RACE-CODE' });
    assert.ok(editRes.status !== 200 || usedOldCode === 0, 'a renamed coupon must not have been redeemed under its old code');
  });

  test('a coupon redeemed and then cancelled (use returned) still cannot be renamed', async () => {
    const { cancelOrder } = await import('../src/services/orderService.js');
    const c = await make('CANCEL-RENAME', { usageLimit: 5 });
    const placed = await place('CANCEL-RENAME');
    assert.equal(placed.status, 201, JSON.stringify(placed.body));
    const order = await t.models.Order.findOne({ couponCode: 'CANCEL-RENAME' });
    await cancelOrder(order._id, { byAdmin: true });
    assert.equal((await stored('CANCEL-RENAME')).usedCount, 0, 'the cancellation returned the use');
    const rename = await patch(c._id, { code: 'CANCEL-RENAME-2' });
    assert.equal(rename.status, 409, 'a coupon that was ever redeemed keeps its code');
    assert.equal((await stored('CANCEL-RENAME')).code, 'CANCEL-RENAME');
  });
});
