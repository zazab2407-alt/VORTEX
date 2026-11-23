// Admin customer management: access control, search, details, order history, activate/deactivate, and no sensitive data.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupApi, testUri, login } from './helpers.mjs';

const skip = !testUri('customers') && 'set MONGO_TEST_URI to run database tests';

describe('Admin customer management', { skip }, () => {
  let t, call, models, admin, aliceId, bobId;
  before(async () => {
    t = await setupApi('customers'); call = t.call; models = t.models; admin = t.adminCookie;
    aliceId = String(t.users.alice._id); bobId = String(t.users.bob._id);
    await models.User.updateOne({ _id: aliceId }, { phone: '0100 111 2222', city: 'Cairo' });
    // Alice: one delivered-style order and one cancelled order, placed through the real API
    const place = async (cookie, qty) => {
      const r = await call('POST', '/orders', { cookie, body: t.orderBody([await t.line('apex-performance-tee', 'M', 'Black', qty)], { customer: { fullName: 'Alice Adams', email: 'alice@x.test', phone: '0100 000 0000' } }) });
      assert.equal(r.status, 201, JSON.stringify(r.body)); return r.body.data.order;
    };
    await place(t.aliceCookie, 1);
    const toCancel = await place(t.aliceCookie, 2);
    assert.equal((await call('POST', `/orders/${toCancel.orderNumber}/cancel`, { cookie: t.aliceCookie })).status, 200);
  });
  after(async () => { if (t) await t.close(); });

  const list = (qs = '', cookie = admin) => call('GET', `/admin/customers${qs}`, { cookie });
  const names = (r) => r.body.data.map((c) => c.name);

  describe('access control', () => {
    test('anonymous gets 401 and a customer gets 403 on every customer endpoint', async () => {
      for (const [m, p] of [['GET', '/admin/customers'], ['GET', `/admin/customers/${aliceId}`], ['PATCH', `/admin/customers/${aliceId}/status`]]) {
        assert.equal((await call(m, p, { body: { isActive: false } })).status, 401, `anon ${m} ${p}`);
        assert.equal((await call(m, p, { cookie: t.aliceCookie, body: { isActive: false } })).status, 403, `customer ${m} ${p}`);
      }
      assert.equal((await models.User.findById(bobId)).isActive, true, 'a customer could not deactivate anybody');
    });
  });

  describe('listing and searching', () => {
    test('lists real customers only: no admins and no demo reviewers', async () => {
      const r = await list(); assert.equal(r.status, 200);
      assert.deepEqual(names(r).sort(), ['Alice Adams', 'Bob Brown']);
      assert.ok(!r.body.data.some((c) => /@demo\.vortex\.test$/.test(c.email) || c.email === 'admin@x.test'));
      assert.equal(r.body.meta.total, 2);
    });
    test('shows order count and money spent (cancelled orders do not count as spent)', async () => {
      const alice = (await list()).body.data.find((c) => c.name === 'Alice Adams');
      assert.equal(alice.orderCount, 2); assert.equal(alice.totalSpent, 34 + 5); // only the first order: 1 x 34 + 5 shipping
      assert.ok(alice.lastOrderAt);
      const bob = (await list()).body.data.find((c) => c.name === 'Bob Brown'); assert.deepEqual([bob.orderCount, bob.totalSpent, bob.lastOrderAt], [0, 0, null]);
    });
    test('searches by name, email and phone, case-insensitively', async () => {
      assert.deepEqual(names(await list('?q=alice')), ['Alice Adams']);
      assert.deepEqual(names(await list('?q=BOB@X')), ['Bob Brown']);
      assert.deepEqual(names(await list('?q=111%202222')), ['Alice Adams']);
      assert.deepEqual(names(await list('?q=zzz-nobody')), []);
    });
    test('search text is treated literally, never as a regular expression or operator', async () => {
      assert.deepEqual(names(await list('?q=.*')), []);
      assert.equal((await list('?q[$ne]=x')).status, 400);
    });
    test('filters by status and validates paging', async () => {
      assert.deepEqual(names(await list('?status=inactive')), []);
      assert.equal((await list('?status=weird')).status, 400);
      assert.equal((await list('?limit=1')).body.data.length, 1);
      assert.equal((await list('?limit=1')).body.meta.totalPages, 2);
      assert.equal((await list('?limit=500')).status, 400);
      assert.equal((await list('?page=0')).status, 400);
    });
  });

  describe('customer details and order history', () => {
    test('shows the profile and the customer’s orders newest first', async () => {
      const r = await call('GET', `/admin/customers/${aliceId}`, { cookie: admin });
      assert.equal(r.status, 200); const d = r.body.data;
      assert.deepEqual([d.customer.name, d.customer.email, d.customer.city, d.customer.isActive], ['Alice Adams', 'alice@x.test', 'Cairo', true]);
      assert.equal(d.orders.length, 2); assert.equal(d.ordersTotal, 2);
      assert.deepEqual(d.orders.map((o) => o.status), ['cancelled', 'pending']);
      assert.ok(d.orders.every((o) => o.orderNumber && typeof o.total === 'number'));
    });
    test('a customer with no orders has an empty history', async () => {
      const d = (await call('GET', `/admin/customers/${bobId}`, { cookie: admin })).body.data;
      assert.deepEqual([d.orders.length, d.ordersTotal, d.customer.orderCount], [0, 0, 0]);
    });
    test('unknown ids are 404, malformed ids are 400, and admins or demo reviewers are not customers', async () => {
      assert.equal((await call('GET', '/admin/customers/507f1f77bcf86cd799439011', { cookie: admin })).status, 404);
      assert.equal((await call('GET', '/admin/customers/not-an-id', { cookie: admin })).status, 400);
      assert.equal((await call('GET', `/admin/customers/${t.users.admin._id}`, { cookie: admin })).status, 404);
      const demo = await models.User.create({ name: 'Demo R', email: 'reviewer9@demo.vortex.test', password: 'x'.repeat(24), isActive: false });
      assert.equal((await call('GET', `/admin/customers/${demo._id}`, { cookie: admin })).status, 404);
    });
  });

  describe('no sensitive data is ever returned', () => {
    test('list, detail and status responses contain no password hash, token data or internal fields', async () => {
      const bodies = [
        JSON.stringify((await list()).body),
        JSON.stringify((await call('GET', `/admin/customers/${aliceId}`, { cookie: admin })).body),
        JSON.stringify((await call('PATCH', `/admin/customers/${bobId}/status`, { cookie: admin, body: { isActive: true } })).body),
      ];
      const hash = (await models.User.findById(bobId).select('+password')).password;
      for (const s of bodies) {
        assert.ok(!s.includes(hash), 'no hash'); assert.ok(!/\$2[aby]\$/.test(s), 'nothing that looks like bcrypt');
        for (const k of ['password', 'tokenVersion', '"role"', 'idempotencyKey', '__v', 'token']) assert.ok(!s.includes(k), `leaked ${k}`);
      }
    });
  });

  describe('activating and deactivating', () => {
    test('deactivating blocks login and ends the current session at once; reactivating restores login', async () => {
      assert.equal((await call('GET', '/auth/me', { cookie: t.bobCookie })).status, 200);
      const off = await call('PATCH', `/admin/customers/${bobId}/status`, { cookie: admin, body: { isActive: false } });
      assert.equal(off.status, 200); assert.equal(off.body.data.isActive, false);
      assert.equal((await call('GET', '/auth/me', { cookie: t.bobCookie })).status, 401, 'existing session stops working immediately');
      assert.equal((await call('POST', '/auth/login', { body: { email: 'bob@x.test', password: 'password-12345' } })).status, 401, 'cannot log in');
      assert.deepEqual(names(await list('?status=inactive')), ['Bob Brown']);

      const on = await call('PATCH', `/admin/customers/${bobId}/status`, { cookie: admin, body: { isActive: true } });
      assert.equal(on.body.data.isActive, true);
      await login(call, 'bob@x.test', 'password-12345'); // works again
    });
    test('an admin cannot change their own status', async () => {
      const r = await call('PATCH', `/admin/customers/${t.users.admin._id}/status`, { cookie: admin, body: { isActive: false } });
      assert.equal(r.status, 400); assert.match(r.body.message, /your own account/);
      assert.equal((await models.User.findById(t.users.admin._id)).isActive, true);
      assert.equal((await call('GET', '/admin/stats', { cookie: admin })).status, 200, 'still logged in');
    });
    test('the status body must be a real boolean, and other fields cannot be changed through it', async () => {
      for (const body of [{}, { isActive: 'false' }, { isActive: 0 }, { isActive: null }]) assert.equal((await call('PATCH', `/admin/customers/${aliceId}/status`, { cookie: admin, body })).status, 400, JSON.stringify(body));
      const r = await call('PATCH', `/admin/customers/${aliceId}/status`, { cookie: admin, body: { isActive: true, role: 'admin', email: 'evil@x.test', password: 'hacked-hacked' } });
      assert.equal(r.status, 200);
      const u = await models.User.findById(aliceId).select('+password');
      assert.deepEqual([u.role, u.email], ['customer', 'alice@x.test']); assert.ok(await u.comparePassword('password-12345'));
    });
    test('an admin account cannot be deactivated through the customer endpoint', async () => {
      const other = await models.User.create({ name: 'Other Admin', email: 'admin2@x.test', password: 'password-12345', role: 'admin' });
      assert.equal((await call('PATCH', `/admin/customers/${other._id}/status`, { cookie: admin, body: { isActive: false } })).status, 404);
      assert.equal((await models.User.findById(other._id)).isActive, true);
    });
  });
});
