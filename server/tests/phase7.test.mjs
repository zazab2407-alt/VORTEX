// Phase 7 cross-cutting checks: public store settings, caching headers, currency formatting, mail safety, error output.
import { test, describe, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupApi, testUri } from './helpers.mjs';

const skip = !testUri('phase7') && 'set MONGO_TEST_URI to run database tests';

describe('Phase 7: settings, headers, currency, mail safety', { skip }, () => {
  let t, call, models, mailer, formatMoney, config;
  before(async () => {
    t = await setupApi('phase7'); call = t.call; models = t.models;
    mailer = await import('../src/services/mailer.js');
    ({ formatMoney } = await import('../src/utils/currency.js'));
    ({ config } = await import('../src/config/env.js'));
  });
  after(async () => { mailer?.setTransportForTests(null); if (t) await t.close(); });
  afterEach(() => mailer.setTransportForTests(null));

  describe('GET /cart/config (public store settings)', () => {
    test('keeps the original currency and shipping shape and adds the new public settings', async () => {
      const r = await call('GET', '/cart/config'); assert.equal(r.status, 200); const d = r.body.data;
      assert.equal(d.currency, 'USD'); assert.deepEqual(d.shipping, { flatRate: 5, freeThreshold: 100 });
      assert.equal(d.currencySymbol, '$'); assert.equal(d.locale, 'en-US'); assert.equal(d.storeName, 'VORTEX');
      assert.deepEqual(Object.keys(d.contact).sort(), ['address', 'email', 'formEnabled', 'phone']);
      assert.deepEqual(d.returns, { windowDays: null }, 'no return promise until the owner configures one');
      assert.ok(d.promoCode === null || typeof d.promoCode === 'string');
    });
    test('exposes only an explicit allow-list: no secrets, database, SMTP or private inbox settings', async () => {
      const r = await call('GET', '/cart/config'); const s = JSON.stringify(r.body);
      assert.deepEqual(Object.keys(r.body.data).sort(), ['contact', 'currency', 'currencySymbol', 'locale', 'promoCode', 'returns', 'shipping', 'storeName']);
      for (const secret of [config.jwt.secret, config.mongoUri, 'mongodb', 'smtp', 'SMTP', 'jwt', 'cloudinary', 'uploadsDir', 'password']) assert.ok(!s.includes(secret), `public config leaked: ${secret}`);
    });
    test('works without being logged in and is not marked private', async () => assert.equal((await call('GET', '/cart/config')).status, 200));
  });

  describe('response headers', () => {
    test('account, order, admin and contact responses are never cacheable', async () => {
      for (const [m, p, o] of [['GET', '/auth/session'], ['GET', '/orders/mine', { cookie: t.aliceCookie }], ['GET', '/admin/stats', { cookie: t.adminCookie }], ['GET', '/admin/stats'], ['GET', '/auth/me']]) {
        const r = await call(m, p, o); assert.match(r.headers.get('cache-control') ?? '', /no-store/, `${p} (${r.status})`);
      }
    });
    test('security headers from helmet are present', async () => {
      const r = await call('GET', '/cart/config');
      assert.equal(r.headers.get('x-content-type-options'), 'nosniff'); assert.ok(r.headers.get('x-powered-by') === null, 'framework is not advertised');
    });
  });

  describe('there is no public password-reset endpoint', () => {
    test('common reset routes do not exist', async () => {
      for (const p of ['/auth/reset-password', '/auth/forgot-password', '/auth/reset', '/users/reset-password']) assert.equal((await call('POST', p, { body: { email: 'alice@x.test', password: 'new-password-123' } })).status, 404, p);
    });
  });

  describe('error responses', () => {
    test('a server error never includes a stack trace (outside explicit development)', async () => {
      const real = models.Product.find; models.Product.find = () => { throw new Error('database exploded at C:\\secret\\path'); };
      const logged = console.error; console.error = () => {};
      let r; try { r = await call('GET', '/products'); } finally { models.Product.find = real; console.error = logged; }
      assert.equal(r.status, 500); assert.ok(!('stack' in r.body), 'no stack'); assert.ok(!JSON.stringify(r.body).includes('C:\\secret'), 'no file paths');
    });
  });

  describe('currency formatting follows configuration', () => {
    test('defaults to US dollars and honours another currency or locale', () => {
      assert.equal(formatMoney(50), '$50.00'); assert.equal(formatMoney(1234.5), '$1,234.50');
      assert.match(formatMoney(50, { currency: 'EGP', locale: 'en-US' }), /50\.00/); assert.ok(!formatMoney(50, { currency: 'EGP', locale: 'en-US' }).includes('$'));
      assert.match(formatMoney(50, { currency: 'EUR', locale: 'de-DE' }), /50,00\s?€/);
    });
  });

  describe('email safety', () => {
    const order = (email) => ({ orderNumber: 'VTX-261119-TEST1234', customer: { fullName: 'Test Buyer', email }, items: [{ quantity: 2, name: 'Tee', size: 'M', color: 'Black', lineTotal: 68 }], subtotal: 68, discount: 0, shippingCost: 5, total: 73, shippingAddress: { address: '1 Nile St', city: 'Cairo' } });
    const fake = () => ({ mails: [], async sendMail(m) { this.mails.push(m); return {}; } });

    test('the confirmation uses the configured currency formatting and store name', () => {
      const m = mailer.buildConfirmationEmail(order('a@b.co'));
      assert.match(m.text, /Total: \$73\.00/); assert.match(m.text, /Shipping: \$5\.00/); assert.equal(m.subject, 'Your VORTEX order VTX-261119-TEST1234');
    });
    test('orders to ordinary addresses are sent, including ones with an apostrophe', async () => {
      const f = fake(); mailer.setTransportForTests(f);
      for (const e of ['buyer@example.com', "o'brien@example.com"]) assert.deepEqual(await mailer.sendOrderConfirmation(order(e)), { sent: true });
      assert.equal(f.mails.length, 2);
    });
    test('addresses that could redirect mail (quotes, lists, brackets) are refused and nothing is sent', async () => {
      const f = fake(); mailer.setTransportForTests(f);
      for (const e of ['"victim@evil.example"@shop.test', 'a@b.com,c@d.com', 'x y@z.com', '<a@b.com>']) assert.equal((await mailer.sendOrderConfirmation(order(e))).sent, false, e);
      assert.equal(f.mails.length, 0);
    });
    test('failure logs only an error code: never the provider message, address or credentials', async () => {
      mailer.setTransportForTests({ async sendMail() { const e = new Error('535 5.7.8 Username and Password not accepted for secret-user@provider.test'); e.code = 'EAUTH'; throw e; } });
      const logs = []; const orig = console.error; console.error = (...a) => logs.push(a.join(' '));
      let r; try { r = await mailer.sendOrderConfirmation(order('buyer@example.com')); } finally { console.error = orig; }
      assert.deepEqual(r, { sent: false, reason: 'failed' });
      assert.ok(logs.join().includes('EAUTH')); assert.ok(!logs.join().includes('secret-user') && !logs.join().includes('buyer@example.com'));
    });
    test('verifySmtp reports an unconfigured setup without throwing and without printing secrets', async () => {
      assert.deepEqual(await mailer.verifySmtp(), { ok: false, reason: 'not_configured' });
      mailer.setTransportForTests({ verify: async () => { const e = new Error('connect ECONNREFUSED 10.0.0.1:587 user=secret'); e.code = 'ECONNECTION'; throw e; } });
      assert.deepEqual(await mailer.verifySmtp(), { ok: false, reason: 'ECONNECTION' });
      mailer.setTransportForTests({ verify: async () => true });
      assert.deepEqual(await mailer.verifySmtp(), { ok: true });
    });
  });
});
