// Standalone stress test (NOT part of `npm test`; the name does not match *.test.mjs).
// Races the real PATCH /admin/coupons/:id (rename) against several real POST /orders checkouts that redeem the OLD code,
// then verifies the database after every race. Needs MONGO_TEST_URI (a replica set to also exercise transactions).
//
//   $env:MONGO_TEST_URI='mongodb://127.0.0.1:27020/vortex_test?replicaSet=rs0'
//   node tests/stress/couponRace.stress.mjs            # env: STRESS_ITER=300 STRESS_ORDERS=3 STRESS_NAME=couponstress
//
// Each worker process uses its own database (vortex_test_<STRESS_NAME>), so several can run in parallel for extra load.
import { setupApi } from '../helpers.mjs';

const ITER = Number(process.env.STRESS_ITER ?? 300);
const ORDERS = Number(process.env.STRESS_ORDERS ?? 3);
const NAME = process.env.STRESS_NAME ?? 'couponstress';
const STOCK = 1_000_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jit = (max) => (max ? sleep(Math.random() * max) : Promise.resolve());

const t = await setupApi(NAME);
if (!t) { console.error('Set MONGO_TEST_URI to run this stress test.'); process.exit(2); }

const { Coupon, Order, Product } = t.models;
const tee = await t.product('apex-performance-tee');
await Product.updateOne({ _id: tee._id }, { $set: { 'variants.$[v].stock': STOCK } }, { arrayFilters: [{ 'v.size': 'M', 'v.color': 'Black' }] });
const startStock = await t.stockOf('apex-performance-tee', 'M', 'Black');
const teeLine = await t.line('apex-performance-tee', 'M', 'Black', 1);
const place = (couponCode) => t.call('POST', '/orders', { body: t.orderBody([teeLine], { couponCode }) });
const rename = (id, code) => t.call('PATCH', `/admin/coupons/${id}`, { cookie: t.adminCookie, body: { code } });

const stats = { iterations: 0, renameOk: 0, renameConflict: 0, benignConflict: 0, orders201: 0, orders400: 0, orders409: 0, oldCodeOrdersAfterRename: 0 };
const violations = [];
let totalCreated = 0;

/** mode: 'fresh' = unused coupon raced against checkouts; 'used' = one order completed first, then rename raced with more. */
async function iteration(i) {
  const mode = i % 5 === 4 ? 'used' : 'fresh';
  const oldCode = `ST${NAME.toUpperCase().slice(-4)}${i}O`.slice(0, 30);
  const newCode = `ST${NAME.toUpperCase().slice(-4)}${i}N`.slice(0, 30);
  const c = await Coupon.create({ code: oldCode, type: 'fixed', value: 2, usageLimit: 1000 });
  let pre = 0;
  if (mode === 'used') { const r = await place(oldCode); if (r.status !== 201) violations.push({ i, why: 'pre-order failed', status: r.status, body: r.body }); else { pre = 1; totalCreated++; } }

  const J = [0, 0, 2, 5, 10, 20][Math.floor(Math.random() * 6)];
  const renameFirst = Math.random() < 0.5;
  const old = [...Array(ORDERS)].map(async () => { if (renameFirst) await jit(J + 3); else await jit(J); return place(oldCode); });
  const fresh = [...Array(2)].map(async () => { await jit(J + 2); return place(newCode); }); // customers who already know the new code
  const ren = (async () => { if (!renameFirst) await jit(J + 3); else await jit(J); return rename(c._id, newCode); })();
  const [rr, ...results] = await Promise.all([ren, ...old, ...fresh]);
  const oldRes = results.slice(0, ORDERS);
  const newRes = results.slice(ORDERS);

  const doc = await Coupon.findById(c._id).lean();
  const nOld = await Order.countDocuments({ couponCode: oldCode });
  const nNew = await Order.countDocuments({ couponCode: newCode });
  const ok201 = (arr) => arr.filter((r) => r.status === 201).length;
  const ctx = { i, mode, J, renameFirst, rename: rr.status, oldStatuses: oldRes.map((r) => r.status), newStatuses: newRes.map((r) => r.status), code: doc.code, usedCount: doc.usedCount, nOld, nNew, pre };
  const bad = (why) => violations.push({ why, ...ctx });

  stats.iterations++;
  for (const r of [...oldRes, ...newRes]) { if (r.status === 201) stats.orders201++; else if (r.status === 400) stats.orders400++; else if (r.status === 409) stats.orders409++; else bad(`unexpected order status ${r.status}: ${JSON.stringify(r.body)}`); }
  totalCreated += ok201(oldRes) + ok201(newRes);

  // Order records must match what the API reported.
  if (nOld !== pre + ok201(oldRes)) bad('old-code order records differ from 201 responses');
  if (nNew !== ok201(newRes)) bad('new-code order records differ from 201 responses');
  // Usage count is exactly the number of orders that carry this coupon, and never exceeds the limit.
  if (doc.usedCount !== nOld + nNew) bad('usedCount differs from the number of orders using the coupon');
  if (doc.usedCount > doc.usageLimit) bad('usedCount exceeds usageLimit');

  if (rr.status === 200) {
    stats.renameOk++;
    if (doc.code !== newCode) bad('rename returned 200 but the stored code is not the new one');
    if (mode === 'used') bad('a coupon that was already used was renamed');
    // THE assertion from couponAtomic.test.mjs: a renamed coupon must never have been redeemed under its old code.
    if (nOld !== 0) { stats.oldCodeOrdersAfterRename += nOld; bad('RACE: renamed coupon was redeemed under its old code'); }
  } else if (rr.status === 409) {
    stats.renameConflict++;
    if (doc.code !== oldCode) bad('rename was refused but the stored code changed');
    if (nNew !== 0) bad('orders exist under a new code that was never applied');
    if (doc.usedCount === 0) stats.benignConflict++; // transient: a checkout held the coupon, then rolled back
    if (mode === 'used' && !/already been used|just been used/.test(JSON.stringify(rr.body))) bad('used-coupon refusal has an unexpected message');
  } else bad(`unexpected rename status ${rr.status}: ${JSON.stringify(rr.body)}`);

  // Failed checkouts must leave stock untouched: stock fell by exactly the number of orders ever created.
  const stock = await t.stockOf('apex-performance-tee', 'M', 'Black');
  if (stock !== startStock - totalCreated) bad(`stock drift: expected ${startStock - totalCreated}, found ${stock}`);
}

const t0 = Date.now();
for (let i = 0; i < ITER; i++) {
  await iteration(i);
  if (violations.length >= 5) break;
}
const seconds = ((Date.now() - t0) / 1000).toFixed(1);
console.log(JSON.stringify({ worker: NAME, orders: ORDERS, seconds, ...stats, violations: violations.length }));
if (violations.length) console.log('FIRST VIOLATIONS:\n' + JSON.stringify(violations.slice(0, 3), null, 2));
await t.close();
process.exit(violations.length ? 1 : 0);
