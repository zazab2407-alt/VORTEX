// Server-side pricing (cart quote), checkout validation, guest/authenticated checkout, duplicate prevention and concurrency.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupApi, testUri } from './helpers.mjs';

const skip = !testUri('checkout') && 'set MONGO_TEST_URI to run database tests';

describe('Cart quote, checkout and stock', { skip }, () => {
  let t, call, models;
  before(async () => { t = await setupApi('checkout'); call = t.call; models = t.models; });
  after(async () => { if (t) await t.close(); });

  const FLUX = ['flux-high-waist-leggings', 'M', 'Black'];
  const post = (body, cookie) => call('POST', '/orders', { body, cookie });
  const quote = (items, couponCode) => call('POST', '/cart/quote', { body: { items, couponCode } });
  /** Find a variant of `slug` with the given kind of stock, so tests do not depend on exact seed numbers. */
  const variantWhere = async (slug, pred) => (await t.product(slug)).variants.find(pred);
  const setStock = (slug, size, color, stock) => models.Product.updateOne({ slug, variants: { $elemMatch: { size, color } } }, { $set: { 'variants.$.stock': stock } });

  describe('cart quote: money is computed on the server', () => {
    test('prices come from the database; prices sent by the client are ignored', async () => {
      const it = { ...(await t.line(...FLUX, 2)), unitPrice: 0.01, price: 0.01, lineTotal: 0.02, total: 0.02 };
      const r = await quote([it]);
      assert.equal(r.status, 200);
      const q = r.body.data;
      assert.equal(q.lines[0].unitPrice, 68); assert.equal(q.lines[0].lineTotal, 136); assert.deepEqual([q.subtotal, q.discount, q.shipping, q.total], [136, 0, 0, 136]);
      assert.equal(q.lines[0].status, 'ok'); assert.equal(q.hasIssues, false);
    });
    test('sale prices are used, and shipping applies under the free-shipping threshold', async () => {
      const q = (await quote([await t.line('vortex-pro-cap', 'One Size', 'Black', 1)])).body.data;
      assert.equal(q.lines[0].unitPrice, 20); assert.equal(q.lines[0].originalPrice, 26);
      assert.deepEqual([q.subtotal, q.shipping, q.total], [20, 5, 25]); assert.equal(q.freeShipping.remaining, 80);
    });
    test('free shipping is decided AFTER the discount', async () => {
      const items = [await t.line('apex-performance-tee', 'M', 'Black', 3)]; // 3 x $34 = $102
      assert.deepEqual([(await quote(items)).body.data.shipping], [0]);
      const withCoupon = (await quote(items, 'VORTEX10')).body.data; // 102 - 10.2 = 91.8 < 100
      assert.deepEqual([withCoupon.discount, withCoupon.shipping, withCoupon.total], [10.2, 5, 96.8]);
    });
    test('the same variant listed twice becomes one line', async () => {
      const l = await t.line(...FLUX, 1); const q = (await quote([l, { ...l, quantity: 2 }])).body.data;
      assert.equal(q.lines.length, 1); assert.equal(q.lines[0].quantity, 3);
    });
    test('each line carries the options needed to change size/colour in the cart', async () => {
      const o = (await quote([await t.line(...FLUX)])).body.data.lines[0].options;
      assert.deepEqual(o.sizes, ['XS', 'S', 'M', 'L', 'XL']); assert.ok(o.colors.length === 4 && o.stock['M|Black'] !== undefined);
    });
    test('stock problems are reported per line: out of stock, not enough, hidden product, unknown variant, missing product', async () => {
      const sold = await variantWhere(...[FLUX[0]], (v) => v.stock === 0);
      const few = await variantWhere(FLUX[0], (v) => v.stock > 0);
      const hidden = await t.product('vortex-pro-cap'); await models.Product.updateOne({ _id: hidden._id }, { isActive: false });
      const lines = [
        await t.line(FLUX[0], sold.size, sold.color), await t.line(FLUX[0], few.size, few.color, few.stock + 5),
        await t.line('vortex-pro-cap', 'One Size', 'Black'), { ...(await t.line(FLUX[0], 'XXL', 'Black')) }, { productId: '64b7f0f0f0f0f0f0f0f0f0f0', size: 'M', color: 'Black', quantity: 1 },
      ];
      const q = (await quote(lines)).body.data;
      assert.deepEqual(q.lines.map((l) => l.status), ['out_of_stock', 'insufficient', 'unavailable', 'unavailable', 'unavailable']);
      assert.equal(q.lines[1].available, few.stock); assert.match(q.lines[1].message, new RegExp(`Only ${few.stock} left`)); assert.equal(q.hasIssues, true);
      await models.Product.updateOne({ _id: hidden._id }, { isActive: true });
    });
    test('input is validated', async () => {
      const ok = await t.line(...FLUX);
      for (const [body, msg] of [[{ items: [] }, /empty/], [{ items: [{ ...ok, quantity: 0 }] }, /Quantity/], [{ items: [{ ...ok, quantity: 100 }] }, /Quantity/], [{ items: [{ ...ok, quantity: 1.5 }] }, /Quantity/],
        [{ items: [{ ...ok, productId: 'nope' }] }, /Invalid product/], [{ items: Array(51).fill(ok) }, /too many/], [{ items: [ok], couponCode: 'X'.repeat(31) }, /coupon/i], [{}, /empty/]]) {
        const r = await call('POST', '/cart/quote', { body }); assert.equal(r.status, 400, JSON.stringify(body).slice(0, 60)); assert.match(r.body.message, msg);
      }
    });
    test('/cart/config exposes the shipping rules', async () => {
      const r = await call('GET', '/cart/config'); assert.deepEqual(r.body.data.shipping, { flatRate: 5, freeThreshold: 100 });
    });
  });

  describe('coupons (seeded demo coupons and every rule)', () => {
    const big = async () => [await t.line(...FLUX, 2)]; // $136
    test('VORTEX10 (seeded percentage coupon) works, case-insensitively', async () => {
      const q = (await quote(await big(), ' vortex10 ')).body.data;
      assert.deepEqual([q.coupon.valid, q.coupon.code, q.coupon.type, q.discount, q.total], [true, 'VORTEX10', 'percentage', 13.6, 122.4]);
    });
    test('WELCOME15 needs a $50 minimum', async () => {
      const small = (await quote([await t.line('vortex-pro-cap', 'One Size', 'Black')], 'WELCOME15')).body.data;
      assert.equal(small.coupon.valid, false); assert.match(small.coupon.error, /minimum order of \$50\.00/); assert.equal(small.discount, 0);
      const okay = (await quote(await big(), 'WELCOME15')).body.data; assert.deepEqual([okay.coupon.valid, okay.discount], [true, 20.4]);
    });
    test('unknown, inactive, expired and used-up coupons are refused with a clear reason and no discount', async () => {
      const { Coupon } = models;
      await Coupon.create([{ code: 'OFF', type: 'fixed', value: 5, isActive: false }, { code: 'OLD', type: 'fixed', value: 5, expiresAt: new Date(Date.now() - 1000) }, { code: 'USED', type: 'fixed', value: 5, usageLimit: 2, usedCount: 2 }]);
      for (const [code, msg] of [['NOPE', /not valid/], ['OFF', /no longer active/], ['OLD', /expired/], ['USED', /usage limit/]]) {
        const q = (await quote(await big(), code)).body.data; assert.equal(q.coupon.valid, false, code); assert.match(q.coupon.error, msg); assert.equal(q.discount, 0); assert.equal(q.total, 136);
      }
    });
    test('fixed-amount coupons: exact amount, never more than the cart', async () => {
      await models.Coupon.create({ code: 'FIVE', type: 'fixed', value: 5 }); await models.Coupon.create({ code: 'HUGE', type: 'fixed', value: 500 });
      assert.equal((await quote(await big(), 'FIVE')).body.data.discount, 5);
      const huge = (await quote([await t.line('vortex-pro-cap', 'One Size', 'Black')], 'HUGE')).body.data;
      assert.deepEqual([huge.discount, huge.total], [20, 0], 'cap on the subtotal, so total is 0, not negative');
    });
  });

  describe('checkout validation (frontend rules are enforced again on the server)', () => {
    test('every invalid field is a clear 400 naming the field, and nothing is created or deducted', async () => {
      const line = await t.line(...FLUX); const before = [await models.Order.countDocuments(), await t.stockOf(...FLUX)];
      const good = () => t.orderBody([line]);
      const cases = [
        ['customer.fullName', (b) => { b.customer.fullName = 'x'; }, /Full name/], ['customer.fullName', (b) => { delete b.customer.fullName; }, /Full name is required/],
        ['customer.email', (b) => { b.customer.email = 'not-an-email'; }, /valid email/], ['customer.phone', (b) => { b.customer.phone = 'call me'; }, /valid phone/],
        ['customer.phone', (b) => { b.customer.phone = '+--  12'; }, /valid phone/], ['shippingAddress.city', (b) => { b.shippingAddress.city = ''; }, /City/],
        ['shippingAddress.address', (b) => { b.shippingAddress.address = 'abc'; }, /shipping address/i], ['shippingAddress.notes', (b) => { b.shippingAddress.notes = 'n'.repeat(501); }, /Notes are too long/],
        ['paymentMethod', (b) => { b.paymentMethod = 'online'; }, /Online payment is not available/], ['idempotencyKey', (b) => { b.idempotencyKey = 'short'; }, /submission key/],
        ['items', (b) => { b.items = []; }, /empty/], ['customer.fullName', (b) => { delete b.customer; }, /Full name is required/],
      ];
      for (const [field, mutate, msg] of cases) {
        const b = good(); mutate(b); const r = await post(b);
        assert.equal(r.status, 400, `${field}: ${r.status}`); assert.match(r.body.message, msg, field); assert.ok(r.body.errors.some((e) => e.field === field), `${field} in ${JSON.stringify(r.body.errors)}`);
      }
      assert.deepEqual([await models.Order.countDocuments(), await t.stockOf(...FLUX)], before);
    });
    test('NoSQL operators in the body are neutralised', async () => {
      const b = t.orderBody([await t.line(...FLUX)]); b.customer.email = { $ne: null };
      assert.equal((await post(b)).status, 400);
    });
  });

  describe('placing orders', () => {
    test('GUEST checkout: order is created from real records with server-calculated money and a snapshot', async () => {
      const before = await t.stockOf(...FLUX); const soldBefore = (await t.product(FLUX[0])).sold;
      const body = t.orderBody([await t.line(...FLUX, 2)], { shippingAddress: { address: '12 Nile Corniche, Maadi', city: 'Cairo', notes: 'Call before arriving' } });
      const r = await post(body);
      assert.equal(r.status, 201); const o = r.body.data.order;
      assert.match(o.orderNumber, /^VTX-\d{6}-[A-Z2-9]{8}$/); assert.deepEqual([o.status, o.paymentMethod, o.paymentStatus], ['pending', 'cod', 'pending']);
      assert.deepEqual([o.subtotal, o.discount, o.shippingCost, o.total], [136, 0, 0, 136]);
      assert.deepEqual(o.items[0], { productId: o.items[0].productId, name: 'Flux High-Waist Leggings', slug: FLUX[0], image: o.items[0].image, size: 'M', color: 'Black', unitPrice: 68, quantity: 2, lineTotal: 136 });
      assert.equal(o.items[0].image, (await import('../src/seed/demoPhotos.js')).demoPhotoPath((await import('../src/seed/demoPhotos.js')).PHOTO_BY_SLUG['flux-high-waist-leggings']), 'the order snapshot carries the local demo photo');
      assert.equal(o.customer.email, 'guest@example.com', 'email stored lower-case'); assert.equal(o.shippingAddress.notes, 'Call before arriving');
      assert.equal(o.statusHistory.length, 1); assert.equal(o.statusHistory[0].status, 'pending');
      assert.equal(await t.stockOf(...FLUX), before - 2, 'stock deducted'); assert.equal((await t.product(FLUX[0])).sold, soldBefore + 2);
      const db = await models.Order.findById(o.id); assert.equal(db.user, undefined, 'a guest order has no user');
      assert.ok(!('idempotencyKey' in o) && !('userId' in o), 'internal fields are not exposed');
    });
    test('the client cannot choose prices, totals, status or payment status', async () => {
      const body = t.orderBody([{ ...(await t.line(...FLUX, 1)), unitPrice: 0.01, lineTotal: 0.01, name: 'Free leggings' }], { total: 1, subtotal: 1, discount: 999, shippingCost: 0, status: 'delivered', paymentStatus: 'paid', user: '64b7f0f0f0f0f0f0f0f0f0f0', createdAt: '2000-01-01' });
      const o = (await post(body)).body.data.order;
      assert.deepEqual([o.total, o.subtotal, o.discount, o.shippingCost, o.status, o.paymentStatus], [73, 68, 0, 5, 'pending', 'pending']);
      assert.equal(o.items[0].name, 'Flux High-Waist Leggings'); assert.ok(new Date(o.createdAt).getFullYear() >= 2026);
      assert.equal((await models.Order.findById(o.id)).user, undefined);
    });
    test('LOGGED-IN checkout links the order to the account, and it shows in "my orders"', async () => {
      const r = await post(t.orderBody([await t.line(...FLUX)], { customer: { fullName: 'Alice Adams', email: 'alice@x.test', phone: '0100 000 0000' } }), t.aliceCookie);
      assert.equal(r.status, 201); assert.equal(String((await models.Order.findById(r.body.data.order.id)).user), String(t.users.alice._id));
      const mine = (await call('GET', '/orders/mine', { cookie: t.aliceCookie })).body.data;
      assert.ok(mine.some((o) => o.orderNumber === r.body.data.order.orderNumber));
      assert.ok(!(await call('GET', '/orders/mine', { cookie: t.bobCookie })).body.data.some((o) => o.orderNumber === r.body.data.order.orderNumber));
    });
    test('a broken or expired login cookie does not block guest checkout', async () => {
      const r = await post(t.orderBody([await t.line(...FLUX)]), 'vortex_token=garbage'); assert.equal(r.status, 201);
    });
    test('order details are a snapshot: later price or name changes never rewrite history', async () => {
      const o = (await post(t.orderBody([await t.line('apex-performance-tee', 'M', 'Black')]))).body.data.order;
      await models.Product.updateOne({ slug: 'apex-performance-tee' }, { name: 'Renamed Tee', price: 999, effectivePrice: 999 });
      const db = await models.Order.findById(o.id); assert.deepEqual([db.items[0].name, db.items[0].unitPrice, db.total], ['Apex Performance Tee', 34, 39]);
    });
    test('a coupon is applied, recorded, and counted as used', async () => {
      const before = (await models.Coupon.findOne({ code: 'VORTEX10' })).usedCount;
      const o = (await post(t.orderBody([await t.line(...FLUX, 2)], { couponCode: 'vortex10' }))).body.data.order;
      assert.deepEqual([o.couponCode, o.discount, o.total], ['VORTEX10', 13.6, 122.4]);
      assert.equal((await models.Coupon.findOne({ code: 'VORTEX10' })).usedCount, before + 1); assert.equal((await models.Order.findById(o.id)).couponRedeemed, true);
    });
    test('an invalid coupon stops checkout before anything is reserved', async () => {
      const before = await t.stockOf(...FLUX);
      const r = await post(t.orderBody([await t.line(...FLUX)], { couponCode: 'NOPE' }));
      assert.equal(r.status, 400); assert.ok(r.body.errors.some((e) => e.field === 'couponCode')); assert.equal(await t.stockOf(...FLUX), before);
    });
  });

  describe('stock checks before and during checkout', () => {
    test('not enough stock -> 409 with an explanation; nothing is deducted or created', async () => {
      await setStock('drift-oversized-tee', 'M', 'White', 2);
      const orders = await models.Order.countDocuments();
      const r = await post(t.orderBody([await t.line('drift-oversized-tee', 'M', 'White', 3)]));
      assert.equal(r.status, 409); assert.match(r.body.message, /no longer available/); assert.match(r.body.errors[0].message, /Drift Oversized Tee \(M \/ White\): Only 2 left/);
      assert.equal(await t.stockOf('drift-oversized-tee', 'M', 'White'), 2); assert.equal(await models.Order.countDocuments(), orders);
    });
    test('multi-item order where the LAST item fails: earlier items are rolled back (no stock leak)', async () => {
      await setStock('titan-compression-tank', 'M', 'Black', 5); await setStock('nova-training-shorts', 'M', 'Black', 5);
      const soldA = (await t.product('titan-compression-tank')).sold;
      // Make the second item fail DURING reservation (after the quote said ok) by selling it out in between
      const items = [await t.line('titan-compression-tank', 'M', 'Black', 2), await t.line('nova-training-shorts', 'M', 'Black', 2)];
      await setStock('nova-training-shorts', 'M', 'Black', 1);
      const r = await post(t.orderBody(items));
      assert.equal(r.status, 409);
      assert.equal(await t.stockOf('titan-compression-tank', 'M', 'Black'), 5, 'first item untouched'); assert.equal((await t.product('titan-compression-tank')).sold, soldA);
      assert.equal(await t.stockOf('nova-training-shorts', 'M', 'Black'), 1);
    });
    test('hidden products and non-existent variants cannot be ordered', async () => {
      await models.Product.updateOne({ slug: 'hydra-shaker-bottle' }, { isActive: false });
      assert.equal((await post(t.orderBody([await t.line('hydra-shaker-bottle', 'One Size', 'Black')]))).status, 409);
      assert.equal((await post(t.orderBody([await t.line(FLUX[0], 'XXL', 'Black')]))).status, 409);
      await models.Product.updateOne({ slug: 'hydra-shaker-bottle' }, { isActive: true });
    });
    test('stock can reach exactly zero but never go negative', async () => {
      await setStock('core-duffel-bag', 'One Size', 'Black', 2);
      assert.equal((await post(t.orderBody([await t.line('core-duffel-bag', 'One Size', 'Black', 2)]))).status, 201);
      assert.equal(await t.stockOf('core-duffel-bag', 'One Size', 'Black'), 0);
      assert.equal((await post(t.orderBody([await t.line('core-duffel-bag', 'One Size', 'Black', 1)]))).status, 409);
      assert.equal(await t.stockOf('core-duffel-bag', 'One Size', 'Black'), 0);
    });
  });

  describe('confirmation email honesty', () => {
    test('SMTP not configured: order succeeds, emailSent is false and recorded as not_configured', async () => {
      const r = await post(t.orderBody([await t.line(...FLUX)])); assert.equal(r.body.data.emailSent, false);
      assert.equal((await models.Order.findById(r.body.data.order.id)).confirmationEmail, 'not_configured');
    });
    test('SMTP configured: emailSent is true only when the server accepted it; failures do not fail the order', async () => {
      const { setTransportForTests } = await import('../src/services/mailer.js');
      const sent = []; setTransportForTests({ sendMail: async (m) => { sent.push(m); } });
      let r = await post(t.orderBody([await t.line(...FLUX)])); assert.equal(r.body.data.emailSent, true); assert.equal(sent[0].to, 'guest@example.com');
      assert.equal((await models.Order.findById(r.body.data.order.id)).confirmationEmail, 'sent');
      const orig = console.error; console.error = () => {};
      setTransportForTests({ sendMail: async () => { throw new Error('boom'); } });
      r = await post(t.orderBody([await t.line(...FLUX)])); console.error = orig;
      assert.equal(r.status, 201); assert.equal(r.body.data.emailSent, false); assert.equal((await models.Order.findById(r.body.data.order.id)).confirmationEmail, 'failed');
      setTransportForTests(null);
    });
  });

  describe('duplicate submissions', () => {
    const key = () => `key_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}abcdef`;
    test('re-sending the same checkout returns the SAME order and deducts stock only once', async () => {
      const k = key(); const before = await t.stockOf(...FLUX); const orders = await models.Order.countDocuments();
      const body = t.orderBody([await t.line(...FLUX, 2)], { idempotencyKey: k });
      const a = await post(body); const b = await post(body);
      assert.equal(a.status, 201); assert.equal(b.status, 200); assert.equal(b.body.data.duplicate, true);
      assert.equal(a.body.data.order.orderNumber, b.body.data.order.orderNumber);
      assert.equal(await t.stockOf(...FLUX), before - 2); assert.equal(await models.Order.countDocuments(), orders + 1);
    });
    test('the same key cannot be reused for someone else (no data leaks through it)', async () => {
      const k = key(); await post(t.orderBody([await t.line(...FLUX)], { idempotencyKey: k }));
      const r = await post(t.orderBody([await t.line(...FLUX)], { idempotencyKey: k, customer: { fullName: 'Mallory', email: 'mallory@x.test', phone: '0100 000 0000' } }));
      assert.equal(r.status, 409); assert.ok(!JSON.stringify(r.body).includes('VTX-'));
    });
    test('duplicates NEVER see a false "sold out": with exactly 1 unit left, 10 simultaneous identical submissions all get the one order', async () => {
      await setStock('hydra-shaker-bottle', 'One Size', 'Orange', 1); const k = key();
      const body = t.orderBody([await t.line('hydra-shaker-bottle', 'One Size', 'Orange', 1)], { idempotencyKey: k });
      const rs = await Promise.all(Array.from({ length: 10 }, () => post(body)));
      assert.deepEqual([...new Set(rs.map((r) => r.status))].sort(), [200, 201]); assert.equal(rs.filter((r) => r.status === 201).length, 1);
      assert.equal(new Set(rs.map((r) => r.body.data.order.orderNumber)).size, 1); assert.equal(await t.stockOf('hydra-shaker-bottle', 'One Size', 'Orange'), 0);
    });
    test('a failed attempt does not lock the key: after fixing the cart the same key can be used again', async () => {
      await setStock('drift-oversized-tee', 'S', 'Sand', 1); const k = key(); const line = await t.line('drift-oversized-tee', 'S', 'Sand', 2);
      assert.equal((await post(t.orderBody([line], { idempotencyKey: k }))).status, 409);
      const ok = await post(t.orderBody([{ ...line, quantity: 1 }], { idempotencyKey: k })); assert.equal(ok.status, 201);
    });
    test('10 identical submissions fired at once (double-click storm) create exactly ONE order', async () => {
      await models.Coupon.updateOne({ code: 'VORTEX10' }, { usedCount: 0 }); await setStock(...FLUX, 20);
      const k = key(); const before = await t.stockOf(...FLUX); const orders = await models.Order.countDocuments();
      const body = t.orderBody([await t.line(...FLUX, 1)], { idempotencyKey: k, couponCode: 'VORTEX10' });
      const rs = await Promise.all(Array.from({ length: 10 }, () => post(body)));
      assert.ok(rs.every((r) => [200, 201].includes(r.status)), rs.map((r) => r.status).join());
      assert.equal(new Set(rs.map((r) => r.body.data.order.orderNumber)).size, 1);
      assert.equal(rs.filter((r) => r.status === 201).length, 1);
      assert.equal(await models.Order.countDocuments(), orders + 1); assert.equal(await t.stockOf(...FLUX), before - 1, 'stock deducted once');
      assert.equal((await models.Coupon.findOne({ code: 'VORTEX10' })).usedCount, 1, 'coupon used once');
    });
  });

  describe('simultaneous purchases never oversell', () => {
    test('15 shoppers race for the last 5 units: exactly 5 orders, stock ends at 0, never negative', async () => {
      await setStock('surge-training-shorts', 'M', 'Black', 5); const sold = (await t.product('surge-training-shorts')).sold; const orders = await models.Order.countDocuments();
      const line = await t.line('surge-training-shorts', 'M', 'Black', 1);
      const rs = await Promise.all(Array.from({ length: 15 }, (_, i) => post(t.orderBody([line], { customer: { fullName: `Racer ${i}`, email: `racer${i}@x.test`, phone: '0100 000 0000' } }))));
      assert.equal(rs.filter((r) => r.status === 201).length, 5); assert.equal(rs.filter((r) => r.status === 409).length, 10);
      assert.equal(await t.stockOf('surge-training-shorts', 'M', 'Black'), 0); assert.equal((await t.product('surge-training-shorts')).sold, sold + 5);
      assert.equal(await models.Order.countDocuments(), orders + 5);
    });
    test('mixed quantities: stock 6, five shoppers want 2 each -> exactly 3 succeed', async () => {
      await setStock('velocity-joggers', 'L', 'Navy', 6);
      const line = await t.line('velocity-joggers', 'L', 'Navy', 2);
      const rs = await Promise.all(Array.from({ length: 5 }, () => post(t.orderBody([line]))));
      assert.equal(rs.filter((r) => r.status === 201).length, 3); assert.equal(await t.stockOf('velocity-joggers', 'L', 'Navy'), 0);
    });
    test('two-product baskets: failed attempts leave no stock behind (3 units of each, 8 shoppers want one of each)', async () => {
      await setStock('elevate-longline-bra', 'M', 'Black', 3); await setStock('drift-oversized-tee', 'L', 'Black', 3);
      const items = [await t.line('elevate-longline-bra', 'M', 'Black'), await t.line('drift-oversized-tee', 'L', 'Black')];
      const rs = await Promise.all(Array.from({ length: 8 }, () => post(t.orderBody(items))));
      assert.equal(rs.filter((r) => r.status === 201).length, 3);
      assert.equal(await t.stockOf('elevate-longline-bra', 'M', 'Black'), 0); assert.equal(await t.stockOf('drift-oversized-tee', 'L', 'Black'), 0);
    });
    test('coupon with 3 uses, 10 simultaneous orders: exactly 3 get it; the others leave stock untouched', async () => {
      await models.Coupon.create({ code: 'LIMIT3', type: 'fixed', value: 5, usageLimit: 3 });
      await setStock('pulse-cropped-hoodie', 'M', 'Black', 50); const line = await t.line('pulse-cropped-hoodie', 'M', 'Black');
      const rs = await Promise.all(Array.from({ length: 10 }, () => post(t.orderBody([line], { couponCode: 'LIMIT3' }))));
      assert.equal(rs.filter((r) => r.status === 201).length, 3); assert.ok(rs.filter((r) => r.status !== 201).every((r) => [400, 409].includes(r.status)));
      assert.equal((await models.Coupon.findOne({ code: 'LIMIT3' })).usedCount, 3); assert.equal(await t.stockOf('pulse-cropped-hoodie', 'M', 'Black'), 47);
    });
  });
});
