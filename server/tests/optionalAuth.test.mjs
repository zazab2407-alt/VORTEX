import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { setupApi, testUri } from './helpers.mjs';

// Focused tests for optionalAuth on checkout (POST /api/orders): active customer, deactivated customer, genuine guest,
// invalid token, expired token. Database suite: skipped unless MONGO_TEST_URI is set (same as the other DB suites).
// Each test prepares the account state it needs itself, so every test passes alone and in any order.
const skip = !testUri('optionalauth') && 'set MONGO_TEST_URI to run database tests';
const DEACTIVATED = 'This account has been deactivated, so orders cannot be placed while signed in. Please contact the store.';

/** The Set-Cookie header of a cookie-clearing response, or undefined. */
const clearingCookie = (setCookie) => setCookie.find((c) => c.startsWith('vortex_token=;'));
/** Everything after "name=value;" so two Set-Cookie headers can be compared option by option. */
const attributesOf = (header) => header.slice(header.indexOf(';') + 1).trim();

describe('optionalAuth at checkout', { skip }, () => {
  let t;
  before(async () => {
    t = await setupApi('optionalauth');
  });
  after(async () => { await t?.close(); });

  /** A one-line checkout body. Stock is topped up here, so each test is independent of earlier orders. */
  const checkout = async () => {
    await t.models.Product.updateOne({ slug: 'apex-performance-tee', 'variants.size': 'M', 'variants.color': 'Black' }, { $set: { 'variants.$.stock': 50 } });
    return t.orderBody([await t.line('apex-performance-tee', 'M', 'Black', 1)]);
  };

  /** Deactivates a customer through the admin API, as the store owner would. Safe to call more than once. */
  const deactivate = async (userId) => {
    const r = await t.call('PATCH', `/admin/customers/${userId}/status`, { cookie: t.adminCookie, body: { isActive: false } });
    assert.equal(r.status, 200);
  };

  test('active customer: the order is placed and linked to the account, and the cookie is kept', async () => {
    const r = await t.call('POST', '/orders', { body: await checkout(), cookie: t.aliceCookie });
    assert.equal(r.status, 201);
    const mine = await t.call('GET', '/orders/mine', { cookie: t.aliceCookie });
    assert.ok(mine.body.data.some((o) => o.orderNumber === r.body.data.order.orderNumber), 'the order belongs to Alice');
    assert.equal(clearingCookie(r.setCookie), undefined, 'an active session keeps its cookie');
  });

  test('deactivated customer: the exact 403 message is returned and the stale cookie is cleared', async () => {
    await deactivate(t.users.bob._id);

    const r = await t.call('POST', '/orders', { body: await checkout(), cookie: t.bobCookie });
    assert.equal(r.status, 403);
    assert.equal(r.body.message, DEACTIVATED);
    const cleared = clearingCookie(r.setCookie);
    assert.ok(cleared, 'the response clears the vortex_token cookie');
    assert.match(cleared, /Expires=Thu, 01 Jan 1970/, 'the cookie is expired');
    assert.match(cleared, /Path=\//);
    assert.match(cleared, /HttpOnly/);
  });

  test('the cleared cookie uses the same options as logout', async () => {
    await deactivate(t.users.bob._id);
    // Bob's cookie is still a valid token (deactivation does not change tokenVersion), so this yields a clearing response
    const r = await t.call('POST', '/orders', { body: await checkout(), cookie: t.bobCookie });
    const logout = await t.call('POST', '/auth/logout', { cookie: t.aliceCookie });
    assert.equal(attributesOf(clearingCookie(r.setCookie)), attributesOf(clearingCookie(logout.setCookie)));
  });

  test('genuine guest without a cookie checks out normally, and no cookie is touched', async () => {
    const r = await t.call('POST', '/orders', { body: await checkout() });
    assert.equal(r.status, 201);
    assert.equal(r.body.data.order.customer.email, 'guest@example.com');
    assert.equal(clearingCookie(r.setCookie), undefined);
  });

  test('a stale deactivated cookie that is sent again is refused again (the server does not revoke it)', async () => {
    // Documents current behaviour: removal happens in the browser; the server does not keep a revocation list
    await deactivate(t.users.bob._id);
    const r = await t.call('POST', '/orders', { body: await checkout(), cookie: t.bobCookie });
    assert.equal(r.status, 403);
    assert.equal(r.body.message, DEACTIVATED);
  });

  test('invalid token is treated as a guest and is not cleared', async () => {
    const r = await t.call('POST', '/orders', { body: await checkout(), cookie: 'vortex_token=not-a-real-token' });
    assert.equal(r.status, 201);
    assert.equal(clearingCookie(r.setCookie), undefined);
  });

  test('expired token is treated as a guest and does not affect the account', async () => {
    const expired = jwt.sign({ tv: 0, exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET, { subject: String(t.users.alice._id), algorithm: 'HS256' });
    const r = await t.call('POST', '/orders', { body: await checkout(), cookie: `vortex_token=${expired}` });
    assert.equal(r.status, 201);
    const alice = await t.models.User.findById(t.users.alice._id);
    assert.equal(alice.isActive, true);
  });
});
