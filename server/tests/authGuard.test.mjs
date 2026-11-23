// No database needed: every request below must be refused BEFORE any data is touched.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { makeCall } from './helpers.mjs';

process.env.MONGO_URI = 'mongodb://127.0.0.1:1/unused';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123';
process.env.NODE_ENV = 'production';
process.env.CLIENT_URL = 'http://localhost:5173';
const { default: app } = await import('../src/app.js');
const { config } = await import('../src/config/env.js');

const ID = '64b7f0f0f0f0f0f0f0f0f0f0';
const ADMIN_ROUTES = [
  ['POST', '/products'], ['PUT', `/products/${ID}`], ['PATCH', `/products/${ID}`], ['PATCH', `/products/${ID}/stock`], ['DELETE', `/products/${ID}`],
  ['POST', '/categories'], ['PUT', `/categories/${ID}`], ['PATCH', `/categories/${ID}`], ['DELETE', `/categories/${ID}`],
  ['GET', '/admin/stats'], ['GET', '/admin/products'], ['GET', `/admin/products/${ID}`], ['GET', '/admin/categories'], ['POST', '/admin/uploads'],
];
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

describe('authorization guard (no database)', () => {
  let server, call;
  before(async () => { await new Promise((r) => { server = app.listen(0, r); }); call = makeCall(`http://127.0.0.1:${server.address().port}/api`); });
  after(() => server.close());

  test('production cookies are Secure + httpOnly + SameSite', () => {
    assert.equal(config.cookie.secure, true); assert.equal(config.cookie.sameSite, 'lax');
  });

  for (const [m, p] of ADMIN_ROUTES) {
    test(`anonymous ${m} ${p.replace(ID, ':id')} -> 401`, async () => {
      const r = await call(m, p, { body: { name: 'x' } });
      assert.equal(r.status, 401); assert.equal(r.body.success, false);
    });
  }
  test('the session probe is public and answers 200 with no user', async () => {
    const r = await call('GET', '/auth/session'); assert.equal(r.status, 200); assert.equal(r.body.data.user, null);
  });
  test('account endpoints require login too', async () => {
    for (const [m, p] of [['GET', '/auth/me'], ['PATCH', '/auth/me'], ['PUT', '/auth/password'], ['GET', '/orders/mine']]) assert.equal((await call(m, p, { body: {} })).status, 401, `${m} ${p}`);
  });
  test('state-changing requests without the custom header are refused (CSRF defence in depth)', async () => {
    for (const [m, p] of [['POST', '/auth/login'], ['POST', '/products'], ['DELETE', `/products/${ID}`]]) {
      const r = await call(m, p, { body: {}, csrf: false }); assert.equal(r.status, 403, `${m} ${p}`); assert.match(r.body.message, /Missing required request header/);
    }
  });

  describe('forged or broken tokens are rejected', () => {
    const cases = {
      'signed with the wrong secret': () => jwt.sign({ tv: 0 }, 'attacker-secret-attacker-secret-1234', { subject: ID, expiresIn: '1h' }),
      'algorithm "none"': () => `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: ID, tv: 0, exp: Math.floor(Date.now() / 1000) + 3600 })}.`,
      'expired': () => jwt.sign({ tv: 0 }, process.env.JWT_SECRET, { subject: ID, expiresIn: -60 }),
      'random garbage': () => 'not.a.token',
      'empty value': () => '',
      'valid signature, other algorithm (HS512)': () => jwt.sign({ tv: 0 }, process.env.JWT_SECRET, { subject: ID, expiresIn: '1h', algorithm: 'HS512' }),
    };
    for (const [name, make] of Object.entries(cases)) {
      test(`${name} -> 401 on an admin route`, async () => {
        const r = await call('GET', '/admin/stats', { cookie: `vortex_token=${make()}` });
        assert.equal(r.status, 401);
      });
    }
    test('token in an Authorization header is ignored (cookie only)', async () => {
      const t = jwt.sign({ tv: 0 }, process.env.JWT_SECRET, { subject: ID, expiresIn: '1h' });
      assert.equal((await call('GET', '/admin/stats', { headers: { authorization: `Bearer ${t}` } })).status, 401);
    });
  });
});
