import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { testUri, makeCall, login } from './helpers.mjs';

const uri = testUri('auth');
const skip = !uri && 'set MONGO_TEST_URI to run database tests';
process.env.MONGO_URI = uri || 'mongodb://127.0.0.1:1/unused';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123';
process.env.NODE_ENV = 'test';
process.env.CLIENT_URL = 'http://localhost:5173';

const { default: mongoose } = await import('mongoose');
const { default: app } = await import('../src/app.js');
const { User } = await import('../src/models/index.js');

describe('Authentication', { skip }, () => {
  let server, call;
  const reg = { name: 'Zeyad Ali', email: 'Zeyad@Example.com', password: 'correct-horse-9' };
  const register = (over = {}) => call('POST', '/auth/register', { body: { ...reg, ...over } });

  before(async () => {
    await mongoose.connect(uri); await mongoose.connection.dropDatabase(); await User.init();
    await new Promise((r) => { server = app.listen(0, r); });
    call = makeCall(`http://127.0.0.1:${server.address().port}/api`);
  });
  after(async () => { server.close(); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });

  describe('registration', () => {
    test('creates a customer, signs them in, and never returns secrets', async () => {
      const r = await register();
      assert.equal(r.status, 201);
      const u = r.body.data.user;
      assert.deepEqual([u.name, u.email, u.role], ['Zeyad Ali', 'zeyad@example.com', 'customer']);
      assert.ok(!('password' in u) && !('tokenVersion' in u) && !JSON.stringify(r.body).includes('token'), 'no password, version or token in the body');
      const cookie = r.setCookie.find((c) => c.startsWith('vortex_token='));
      assert.match(cookie, /HttpOnly/i); assert.match(cookie, /SameSite=Lax/i); assert.match(cookie, /Path=\//);
      assert.equal((await call('GET', '/auth/me', { cookie: r.cookie })).body.data.user.email, 'zeyad@example.com', 'the new cookie works immediately');
    });
    test('password is stored as a bcrypt hash', async () => {
      const u = await User.findOne({ email: 'zeyad@example.com' }).select('+password');
      assert.match(u.password, /^\$2[aby]\$12\$/); assert.ok(!u.password.includes('correct-horse'));
    });
    test('cannot register as admin or set protected fields (mass assignment)', async () => {
      const r = await register({ email: 'sneaky@example.com', role: 'admin', isActive: false, tokenVersion: 99 });
      assert.equal(r.status, 201); assert.equal(r.body.data.user.role, 'customer');
      const u = await User.findOne({ email: 'sneaky@example.com' });
      assert.deepEqual([u.role, u.isActive, u.tokenVersion], ['customer', true, 0]);
    });
    test('duplicate email is rejected, case-insensitively', async () => {
      assert.equal((await register({ email: 'ZEYAD@example.COM' })).status, 409);
    });
    test('validation: every bad input is a clear 400 and creates nothing', async () => {
      const before = await User.countDocuments();
      const bad = [
        [{ email: 'nope' }, /valid email/], [{ email: undefined }, /Email is required/], [{ name: 'x' }, /Name must be/], [{ name: undefined }, /Name is required/],
        [{ password: 'short' }, /at least 8/], [{ password: undefined }, /Password is required/], [{ password: 'a'.repeat(73) }, /too long/],
        [{ password: 'é'.repeat(40) }, /too long/], // 40 characters but 80 bytes: bcrypt would silently ignore the tail
        [{ name: { $gt: '' } }, /Name is required/], [{ email: { $ne: null } }, /Email is required/],
      ];
      for (const [over, msg] of bad) { const r = await register({ email: `u${Math.random()}@example.com`, ...over }); assert.equal(r.status, 400, JSON.stringify(over)); assert.match(r.body.message, msg); }
      assert.equal(await User.countDocuments(), before);
    });
  });

  describe('login', () => {
    test('correct credentials sign in (email is case-insensitive)', async () => {
      const r = await call('POST', '/auth/login', { body: { email: 'ZEYAD@example.com', password: reg.password } });
      assert.equal(r.status, 200); assert.ok(r.cookie.length > 40); assert.equal(r.body.data.user.name, 'Zeyad Ali');
    });
    test('wrong password and unknown email are indistinguishable', async () => {
      const a = await call('POST', '/auth/login', { body: { email: 'zeyad@example.com', password: 'wrong-password' } });
      const b = await call('POST', '/auth/login', { body: { email: 'nobody@example.com', password: 'wrong-password' } });
      assert.equal(a.status, 401); assert.equal(b.status, 401); assert.equal(a.body.message, b.body.message); assert.equal(a.body.message, 'Invalid email or password');
      assert.equal(a.cookie, undefined);
    });
    test('deactivated accounts cannot log in, even with the right password', async () => {
      await register({ email: 'blocked@example.com' }); await User.updateOne({ email: 'blocked@example.com' }, { isActive: false });
      const r = await call('POST', '/auth/login', { body: { email: 'blocked@example.com', password: reg.password } });
      assert.equal(r.status, 401); assert.equal(r.body.message, 'Invalid email or password');
    });
    test('NoSQL operator injection cannot bypass login', async () => {
      for (const body of [{ email: { $gt: '' }, password: 'x' }, { email: 'zeyad@example.com', password: { $ne: 'x' } }, { email: { $regex: '.*' }, password: { $regex: '.*' } }]) {
        const r = await call('POST', '/auth/login', { body }); assert.equal(r.status, 400); assert.equal(r.cookie, undefined);
      }
    });
    test('missing fields are a 400', async () => assert.equal((await call('POST', '/auth/login', { body: {} })).status, 400));
  });

  describe('session', () => {
    let cookie;
    before(async () => { cookie = await login(call, 'zeyad@example.com', reg.password); });

    test('/auth/me requires a session and returns the profile without secrets', async () => {
      assert.equal((await call('GET', '/auth/me')).status, 401);
      const r = await call('GET', '/auth/me', { cookie });
      assert.equal(r.status, 200); assert.ok(!('password' in r.body.data.user));
    });
    test('logout clears the cookie', async () => {
      const r = await call('POST', '/auth/logout', { cookie });
      assert.equal(r.status, 200); assert.match(r.setCookie.find((c) => c.startsWith('vortex_token=')), /vortex_token=;/);
    });
    test('a token whose user was deleted is rejected', async () => {
      await register({ email: 'ghost@example.com' }); const c = await login(call, 'ghost@example.com', reg.password);
      await User.deleteOne({ email: 'ghost@example.com' });
      assert.equal((await call('GET', '/auth/me', { cookie: c })).status, 401);
    });
    test('deactivating an account ends its existing sessions immediately', async () => {
      await register({ email: 'soon-gone@example.com' }); const c = await login(call, 'soon-gone@example.com', reg.password);
      assert.equal((await call('GET', '/auth/me', { cookie: c })).status, 200);
      await User.updateOne({ email: 'soon-gone@example.com' }, { isActive: false });
      assert.equal((await call('GET', '/auth/me', { cookie: c })).status, 401);
    });
    test('a token signed with the wrong secret is rejected', async () => {
      const u = await User.findOne({ email: 'zeyad@example.com' });
      const forged = jwt.sign({ tv: 0 }, 'attacker-secret-attacker-secret-1234', { subject: String(u._id), expiresIn: '1h' });
      assert.equal((await call('GET', '/auth/me', { cookie: `vortex_token=${forged}` })).status, 401);
    });
  });

  describe('session probe (used by the storefront on every page load)', () => {
    test('anonymous visitors get 200 with user null, never a 401', async () => {
      const r = await call('GET', '/auth/session'); assert.equal(r.status, 200); assert.equal(r.body.data.user, null);
    });
    test('a valid session returns the user (without secrets)', async () => {
      const r = await call('GET', '/auth/session', { cookie: await login(call, 'zeyad@example.com', reg.password) });
      assert.equal(r.status, 200); assert.equal(r.body.data.user.email, 'zeyad@example.com'); assert.ok(!('password' in r.body.data.user));
    });
    test('forged, expired or deactivated sessions read as "logged out", not as errors', async () => {
      const u = await User.findOne({ email: 'zeyad@example.com' });
      const forged = jwt.sign({ tv: 0 }, 'attacker-secret-attacker-secret-1234', { subject: String(u._id), expiresIn: '1h' });
      const expired = jwt.sign({ tv: 0 }, process.env.JWT_SECRET, { subject: String(u._id), expiresIn: -10 });
      for (const t of [forged, expired, 'garbage']) { const r = await call('GET', '/auth/session', { cookie: `vortex_token=${t}` }); assert.equal(r.status, 200); assert.equal(r.body.data.user, null); }
      await register({ email: 'probe-off@example.com' }); const c = await login(call, 'probe-off@example.com', reg.password);
      await User.updateOne({ email: 'probe-off@example.com' }, { isActive: false });
      assert.equal((await call('GET', '/auth/session', { cookie: c })).body.data.user, null);
    });
    test('the strict /auth/me endpoint still returns 401 for anonymous callers', async () => assert.equal((await call('GET', '/auth/me')).status, 401));
  });

  describe('profile', () => {
    let cookie;
    before(async () => { await register({ email: 'profile@example.com' }); cookie = await login(call, 'profile@example.com', reg.password); });
    test('updates name, phone, address and city (trimmed)', async () => {
      const r = await call('PATCH', '/auth/me', { cookie, body: { name: '  New Name ', phone: '+20 100 000 0000', address: '1 Main St', city: 'Port Said' } });
      assert.equal(r.status, 200); assert.deepEqual([r.body.data.user.name, r.body.data.user.phone, r.body.data.user.city], ['New Name', '+20 100 000 0000', 'Port Said']);
      assert.equal((await call('GET', '/auth/me', { cookie })).body.data.user.address, '1 Main St', 'persisted');
    });
    test('email, role and status cannot be changed through the profile', async () => {
      const r = await call('PATCH', '/auth/me', { cookie, body: { email: 'hijack@example.com', role: 'admin', isActive: false, tokenVersion: 5, password: 'new-password-123' } });
      assert.equal(r.status, 200); assert.equal(r.body.data.user.email, 'profile@example.com'); assert.equal(r.body.data.user.role, 'customer');
      const u = await User.findOne({ email: 'profile@example.com' }).select('+password');
      assert.deepEqual([u.role, u.isActive, u.tokenVersion], ['customer', true, 0]);
      assert.equal(await u.comparePassword(reg.password), true, 'password untouched');
    });
    test('validation', async () => {
      for (const [body, msg] of [[{ name: 'x' }, /Name must be/], [{ phone: 'abc' }, /valid phone/], [{ address: 'a'.repeat(301) }, /too long/], [{ city: 'c'.repeat(81) }, /too long/]]) {
        const r = await call('PATCH', '/auth/me', { cookie, body }); assert.equal(r.status, 400); assert.match(r.body.message, msg);
      }
    });
  });

  describe('password change', () => {
    test('requires the current password, validates the new one, signs out every other session', async () => {
      await register({ email: 'pw@example.com' });
      const deviceA = await login(call, 'pw@example.com', reg.password);
      const deviceB = await login(call, 'pw@example.com', reg.password);
      const change = (body, cookie = deviceA) => call('PUT', '/auth/password', { cookie, body });

      assert.equal((await change({ currentPassword: 'wrong', newPassword: 'brand-new-pass-1' })).status, 400, 'wrong current password');
      assert.equal((await change({ currentPassword: reg.password, newPassword: reg.password })).status, 400, 'same password');
      assert.equal((await change({ currentPassword: reg.password, newPassword: 'short' })).status, 400, 'too short');
      assert.equal((await change({ currentPassword: reg.password, newPassword: 'a'.repeat(73) })).status, 400, 'too long');
      assert.equal((await call('PUT', '/auth/password', { body: { currentPassword: reg.password, newPassword: 'brand-new-pass-1' } })).status, 401, 'anonymous');
      assert.equal((await call('GET', '/auth/me', { cookie: deviceB })).status, 200, 'nothing changed by the failures');

      const ok = await change({ currentPassword: reg.password, newPassword: 'brand-new-pass-1' });
      assert.equal(ok.status, 200);
      assert.equal((await call('GET', '/auth/me', { cookie: deviceA })).status, 401, 'the old cookie of the same device is dead');
      assert.equal((await call('GET', '/auth/me', { cookie: deviceB })).status, 401, 'other devices are signed out');
      assert.equal((await call('GET', '/auth/me', { cookie: ok.cookie })).status, 200, 'the cookie issued by the change works');
      assert.equal((await call('POST', '/auth/login', { body: { email: 'pw@example.com', password: reg.password } })).status, 401, 'old password no longer works');
      assert.equal((await call('POST', '/auth/login', { body: { email: 'pw@example.com', password: 'brand-new-pass-1' } })).status, 200);
    });
  });

  describe('CSRF header', () => {
    test('POST without the custom header is refused; GET does not need it', async () => {
      assert.equal((await call('POST', '/auth/login', { body: { email: 'zeyad@example.com', password: reg.password }, csrf: false })).status, 403);
      assert.equal((await call('GET', '/auth/me', { csrf: false })).status, 401, 'reaches the auth check, so it was not blocked by the header rule');
    });
  });

  describe('roles', () => {
    test('a demoted admin loses access on the very next request', async () => {
      await User.create({ name: 'Boss', email: 'boss@example.com', password: 'boss-password-1', role: 'admin' });
      const cookie = await login(call, 'boss@example.com', 'boss-password-1');
      assert.equal((await call('GET', '/admin/stats', { cookie })).status, 200);
      await User.updateOne({ email: 'boss@example.com' }, { role: 'customer' });
      assert.equal((await call('GET', '/admin/stats', { cookie })).status, 403);
    });
  });
});
