// Store/infrastructure settings validation. Pure: no database and no process.env involved.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isPlainEmail, parseSettings } from '../src/config/settings.js';

const parse = (env = {}) => parseSettings({ NODE_ENV: 'development', ...env });

describe('parseSettings: defaults', () => {
  test('safe development defaults need no configuration at all', () => {
    const { settings: s, errors, warnings } = parse();
    assert.deepEqual(errors, []); assert.deepEqual(warnings, []);
    assert.deepEqual(s.store, { name: 'VORTEX', currency: 'USD', currencySymbol: '$', locale: 'en-US' });
    assert.deepEqual(s.shipping, { flatRate: 5, freeThreshold: 100 });
    assert.deepEqual(s.contact, { email: null, phone: null, address: null, to: null });
    assert.equal(s.returns.windowDays, null, 'no return promise unless the owner sets one');
    assert.equal(s.mongo.transactions, 'auto'); assert.equal(s.mongo.maxPoolSize, 10); assert.equal(s.smtp.port, 587);
  });
  test('the demo promo code is only a development default', () => {
    assert.equal(parse().settings.promoCode, 'VORTEX10');
    assert.equal(parseSettings({ NODE_ENV: 'production' }).settings.promoCode, null);
    assert.equal(parse({ PROMO_CODE: '' }).settings.promoCode, null, 'explicitly empty means none');
    assert.equal(parse({ PROMO_CODE: 'summer-25' }).settings.promoCode, 'SUMMER-25');
  });
});

describe('parseSettings: currency and locale', () => {
  test('EGP and other currencies can be configured without code changes', () => {
    const { settings, errors } = parse({ CURRENCY: 'egp', CURRENCY_LOCALE: 'en-US' });
    assert.deepEqual(errors, []); assert.equal(settings.store.currency, 'EGP'); assert.ok(settings.store.currencySymbol.length > 0);
    assert.deepEqual(parse({ CURRENCY: 'EUR', CURRENCY_LOCALE: 'de-DE' }).errors, []);
  });
  test('invalid currency or locale is an error, not a silent fallback', () => {
    assert.match(parse({ CURRENCY: 'US' }).errors.join(), /CURRENCY "US"/);
    assert.match(parse({ CURRENCY: 'dollars' }).errors.join(), /CURRENCY/);
    assert.match(parse({ CURRENCY_LOCALE: 'not a locale' }).errors.join(), /CURRENCY_LOCALE/);
  });
});

describe('parseSettings: numbers and text', () => {
  test('shipping rules accept 0 and decimals, reject negatives and non-numbers', () => {
    const ok = parse({ SHIPPING_FLAT_RATE: '0', FREE_SHIPPING_THRESHOLD: '49.5' });
    assert.deepEqual(ok.errors, []); assert.deepEqual(ok.settings.shipping, { flatRate: 0, freeThreshold: 49.5 });
    assert.match(parse({ SHIPPING_FLAT_RATE: '-1' }).errors.join(), /SHIPPING_FLAT_RATE/);
    assert.match(parse({ FREE_SHIPPING_THRESHOLD: 'abc' }).errors.join(), /FREE_SHIPPING_THRESHOLD/);
    assert.deepEqual(parse({ SHIPPING_FLAT_RATE: '  ' }).settings.shipping, { flatRate: 5, freeThreshold: 100 }, 'blank = default');
  });
  test('RETURN_WINDOW_DAYS is a whole number of days from 1 to 365', () => {
    assert.equal(parse({ RETURN_WINDOW_DAYS: '14' }).settings.returns.windowDays, 14);
    for (const bad of ['0', '1.5', '400', 'two weeks']) assert.match(parse({ RETURN_WINDOW_DAYS: bad }).errors.join(), /RETURN_WINDOW_DAYS/, bad);
  });
  test('public contact details are validated and trimmed', () => {
    const { settings, errors } = parse({ STORE_EMAIL: ' Help@Shop.Example ', STORE_PHONE: '+20 100 000 0000', STORE_ADDRESS: '1 Nile St, Cairo', CONTACT_TO: 'inbox@shop.example' });
    assert.deepEqual(errors, []); assert.equal(settings.contact.email, 'help@shop.example'); assert.equal(settings.contact.to, 'inbox@shop.example');
    assert.match(parse({ STORE_EMAIL: 'not-an-email' }).errors.join(), /STORE_EMAIL/);
    assert.match(parse({ CONTACT_TO: '"a@evil.example"@shop.example' }).errors.join(), /CONTACT_TO/);
    assert.match(parse({ STORE_PHONE: 'x'.repeat(31) }).errors.join(), /STORE_PHONE/);
  });
  test('PROMO_CODE must look like a coupon code', () => assert.match(parse({ PROMO_CODE: 'bad code!' }).errors.join(), /PROMO_CODE/));
});

describe('parseSettings: database and email', () => {
  test('MONGO_TRANSACTIONS accepts auto/off (any case) and rejects anything else', () => {
    assert.equal(parse({ MONGO_TRANSACTIONS: 'OFF' }).settings.mongo.transactions, 'off');
    assert.match(parse({ MONGO_TRANSACTIONS: 'maybe' }).errors.join(), /MONGO_TRANSACTIONS/);
    assert.match(parse({ MONGO_MAX_POOL_SIZE: '0' }).errors.join(), /MONGO_MAX_POOL_SIZE/);
  });
  test('a half-filled SMTP configuration is called out; a complete one is not', () => {
    const partial = parse({ SMTP_HOST: 'smtp.example.com', SMTP_USER: 'u' });
    assert.ok(partial.warnings.some((w) => /missing SMTP_PASS/.test(w)));
    const full = parse({ SMTP_HOST: 'smtp.example.com', SMTP_USER: 'u', SMTP_PASS: 'p', MAIL_FROM: 'Shop <orders@shop.example>', CONTACT_TO: 'inbox@shop.example' });
    assert.deepEqual(full.errors, []); assert.deepEqual(full.warnings, []);
    assert.match(parse({ SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASS: 'p' }).warnings.join(), /MAIL_FROM/);
    assert.match(parse({ SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASS: 'p', MAIL_FROM: 'a@b.co' }).warnings.join(), /CONTACT_TO/);
    assert.match(parse({ SMTP_PORT: '70000' }).errors.join(), /SMTP_PORT/);
  });
  test('warnings and errors never contain the SMTP password', () => {
    const r = parse({ SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASS: 'super-secret-pass', SMTP_PORT: 'x' });
    assert.ok(!JSON.stringify([r.errors, r.warnings]).includes('super-secret-pass'));
  });
});

describe('isPlainEmail: addresses we are willing to send mail to', () => {
  test('accepts ordinary addresses', () => { for (const e of ['a@b.co', 'first.last+tag@sub.example.com', "o'brien@example.com"]) assert.ok(isPlainEmail(e), e); });
  test('rejects quoting, lists, brackets, spaces and non-strings (how mail gets redirected)', () => {
    for (const e of ['"a@evil.example"@good.com', 'a b@c.com', 'a@b', 'a,b@c.com', 'a@b.com,c@d.com', '<a@b.com>', 'a@b.com;c@d.com', '', null, 5, `${'a'.repeat(250)}@b.co`]) assert.equal(isPlainEmail(e), false, String(e));
  });
});
