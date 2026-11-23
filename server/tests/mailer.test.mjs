// No database: confirmation emails, pricing helpers and coupon maths.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.MONGO_URI = 'mongodb://127.0.0.1:1/unused';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123';
process.env.NODE_ENV = 'test';
const { buildConfirmationEmail, sendOrderConfirmation, setTransportForTests, isEmailConfigured } = await import('../src/services/mailer.js');
const { shippingFor } = await import('../src/services/pricing.js');
const { Coupon } = await import('../src/models/index.js');

const order = {
  orderNumber: 'VTX-261111-ABCD2345', customer: { fullName: 'Zeyad <script>alert(1)</script>', email: 'z@example.com' },
  items: [{ name: 'Flux "Leggings"', size: 'M', color: 'Black', quantity: 2, lineTotal: 136 }],
  subtotal: 136, discount: 13.6, couponCode: 'VORTEX10', shippingCost: 0, total: 122.4, shippingAddress: { address: '1 Main St', city: 'Cairo' },
};

describe('order confirmation email', () => {
  beforeEach(() => setTransportForTests(null));

  test('not configured: nothing is sent and we say so (never pretends)', async () => {
    assert.equal(isEmailConfigured(), false);
    assert.deepEqual(await sendOrderConfirmation(order), { sent: false, reason: 'not_configured' });
  });
  test('configured: sent=true only after the mail server accepts it; content is complete', async () => {
    const sent = []; setTransportForTests({ sendMail: async (m) => { sent.push(m); return { accepted: [m.to] }; } });
    assert.deepEqual(await sendOrderConfirmation(order), { sent: true });
    assert.equal(sent[0].to, 'z@example.com'); assert.match(sent[0].subject, /VTX-261111-ABCD2345/);
    for (const needle of ['VTX-261111-ABCD2345', '2 x Flux', 'Subtotal: $136.00', 'Discount (VORTEX10): -$13.60', 'Shipping: Free', 'Total: $122.40', 'Cash on Delivery', '1 Main St, Cairo']) assert.ok(sent[0].text.includes(needle), needle);
  });
  test('customer-supplied text cannot inject HTML into the email', () => {
    const { html } = buildConfirmationEmail(order);
    assert.ok(!html.includes('<script>') && html.includes('&lt;script&gt;') && html.includes('Flux &quot;Leggings&quot;'));
  });
  test('a failing mail server never throws and never reports sent', async () => {
    const orig = console.error; console.error = () => {};
    try {
      setTransportForTests({ sendMail: async () => { throw new Error('SMTP down'); } });
      assert.deepEqual(await sendOrderConfirmation(order), { sent: false, reason: 'failed' });
    } finally { console.error = orig; }
  });
  test('a hanging mail server times out instead of blocking checkout', async () => {
    const orig = console.error; console.error = () => {};
    try {
      setTransportForTests({ sendMail: () => new Promise(() => {}) });
      const t = Date.now(); const r = await sendOrderConfirmation(order, { timeoutMs: 100 });
      assert.deepEqual(r, { sent: false, reason: 'failed' }); assert.ok(Date.now() - t < 1500);
    } finally { console.error = orig; }
  });
});

describe('shipping and coupon maths', () => {
  test('shipping: flat rate under the free threshold, free at or above it, none for an empty amount', () => {
    assert.equal(shippingFor(99.99), 5); assert.equal(shippingFor(100), 0); assert.equal(shippingFor(250), 0); assert.equal(shippingFor(0), 0);
  });
  test('percentage coupons round to cents; fixed coupons never exceed the subtotal', () => {
    const pct = new Coupon({ code: 'P10', type: 'percentage', value: 10 }); const fixed = new Coupon({ code: 'F5', type: 'fixed', value: 5 });
    assert.equal(pct.discountFor(33.33), 3.33); assert.equal(pct.discountFor(136), 13.6);
    assert.equal(fixed.discountFor(20), 5); assert.equal(fixed.discountFor(3), 3, 'a $5 coupon on a $3 cart only takes $3');
    assert.equal(new Coupon({ code: 'FULL', type: 'percentage', value: 100 }).discountFor(50), 50);
  });
  test('coupon rules: percentage 1-100, fixed > 0, type must be known', async () => {
    for (const bad of [{ type: 'percentage', value: 0 }, { type: 'percentage', value: 101 }, { type: 'fixed', value: 0 }, { type: 'fixed', value: -5 }, { type: 'bogus', value: 5 }]) {
      assert.ok(await new Coupon({ code: 'BAD', ...bad }).validate().then(() => null, (e) => e), JSON.stringify(bad));
    }
    await new Coupon({ code: 'OK12', type: 'fixed', value: 12.5 }).validate();
  });
});
