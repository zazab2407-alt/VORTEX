// Per-account login throttle (approved: 30 failed attempts per email in a fixed 15-minute window, no permanent lockout).
// Covers: distributed-IP attempts, successful logins not counted, identical responses for existing and unknown emails,
// window expiry, and isolation between accounts. Limiters are switched off when NODE_ENV=test, so this file runs in
// development mode, the same way rateLimit.test.mjs does.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'development';
process.env.TEST_NODE_ENV = 'development';
process.env.MONGO_URI ??= 'mongodb://127.0.0.1:1/unused';
process.env.JWT_SECRET ??= 'test-secret-test-secret-test-secret-123';
const { setupApi, testUri } = await import('./helpers.mjs');
const { createAccountLoginLimiter } = await import('../src/middleware/rateLimiter.js');
const { default: express } = await import('express');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

describe('account login limiter: window and keying (no database)', () => {
  let srv;
  let base;
  before(async () => {
    const app = express();
    app.use(express.json());
    // 3 failed attempts per window, 400 ms window: small enough to test expiry quickly
    app.post('/login', createAccountLoginLimiter({ windowMs: 400, limit: 3 }), (_req, res) => res.status(401).json({ success: false, message: 'Invalid email or password' }));
    srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    base = `http://127.0.0.1:${srv.address().port}/login`;
  });
  after(() => new Promise((r) => srv.close(r)));
  const post = (email) => fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'wrong' }) });

  test('the fourth failed attempt for one email is refused with 429', async () => {
    for (let i = 0; i < 3; i++) assert.equal((await post('window-a@x.test')).status, 401);
    const blocked = await post('window-a@x.test');
    assert.equal(blocked.status, 429);
    assert.match((await blocked.json()).message, /Too many attempts/);
  });

  test('another email has its own counter and is not blocked', async () => {
    assert.equal((await post('window-b@x.test')).status, 401);
  });

  test('case and surrounding spaces do not start a fresh counter for the same email', async () => {
    for (let i = 0; i < 3; i++) assert.equal((await post('Window-C@X.test')).status, 401);
    const r = await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: '  window-c@x.test ', password: 'wrong' }) });
    assert.equal(r.status, 429, 'normalised email shares the same counter');
  });

  test('the window expires: after it passes, the same email may try again (no permanent lockout)', async () => {
    for (let i = 0; i < 3; i++) await post('window-d@x.test');
    assert.equal((await post('window-d@x.test')).status, 429);
    await sleep(450);
    assert.equal((await post('window-d@x.test')).status, 401, 'counter reset after the window');
  });
});

const skip = !testUri('loginthrottle') && 'set MONGO_TEST_URI to run database tests';

describe('login throttle over HTTP (database)', { skip }, () => {
  let t;
  let victimBlockedBody;
  const login = (email, password, ip) => t.call('POST', '/auth/login', { body: { email, password }, headers: { 'x-forwarded-for': ip } });
  let ipN = 0;
  const freshIp = () => `198.51.100.${(ipN++ % 250) + 1}`; // each attempt from a different client address

  before(async () => {
    t = await setupApi('loginthrottle');
    const { default: app } = await import('../src/app.js');
    app.set('trust proxy', true); // makes X-Forwarded-For set req.ip, so the test can simulate many client addresses
    await t.models.User.create({ name: 'Victim Vera', email: 'victim@x.test', password: 'victim-password-1' });
  });
  after(async () => { if (t) await t.close(); });

  test('distributed addresses: 30 failures for one account from 30 addresses are all 401; the 31st is 429 from a new address', async () => {
    for (let i = 0; i < 30; i++) {
      const r = await login('victim@x.test', `wrong-${i}`, freshIp());
      assert.equal(r.status, 401, `attempt ${i + 1}: ${JSON.stringify(r.body)}`);
    }
    const r31 = await login('victim@x.test', 'wrong-31', freshIp());
    assert.equal(r31.status, 429, 'the account counter stops a distributed attack');
    assert.match(r31.body.message, /Too many attempts/);
    victimBlockedBody = r31.body;
  });

  test('a correct password is also refused while the account is throttled (throttle applies to the account)', async () => {
    assert.equal((await login('victim@x.test', 'victim-password-1', freshIp())).status, 429);
  });

  test('no enumeration: an unknown email gets the same throttled response as a real one', async () => {
    for (let i = 0; i < 30; i++) assert.equal((await login('ghost@x.test', `wrong-${i}`, freshIp())).status, 401);
    const ghostBlocked = await login('ghost@x.test', 'wrong-31', freshIp());
    assert.equal(ghostBlocked.status, 429);
    assert.deepEqual(ghostBlocked.body, victimBlockedBody, 'identical body for a real and an unknown account');
  });

  test('no enumeration before the limit: a wrong password gets the same 401 for a real and an unknown account', async () => {
    const real = await login('alice@x.test', 'wrong-password-x', freshIp());
    const unknown = await login('nobody-here@x.test', 'wrong-password-x', freshIp());
    assert.deepEqual([real.status, unknown.status], [401, 401]);
    assert.deepEqual(real.body, unknown.body);
  });

  test('successful logins are not counted: 40 successful logins for one account all succeed', async () => {
    for (let i = 0; i < 40; i++) assert.equal((await login('alice@x.test', 'password-12345', '198.51.100.200')).status, 200, `login ${i + 1}`);
  });

  test('isolation: a throttled account does not block a different account', async () => {
    assert.equal((await login('bob@x.test', 'password-12345', freshIp())).status, 200);
  });
});
