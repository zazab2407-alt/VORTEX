import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupApi, testUri } from './helpers.mjs';

process.env.TEST_NODE_ENV = 'development'; // rate limiters are only switched off when NODE_ENV=test
const skip = !testUri('tracklimit') && 'set MONGO_TEST_URI to run database tests';

describe('Order lookup rate limiting', { skip }, () => {
  let t;
  before(async () => { t = await setupApi('tracklimit'); });
  after(async () => { if (t) await t.close(); });

  test('successful lookups are free; the 11th FAILED guess is blocked with 429 (order numbers cannot be brute-forced)', async () => {
    const r = await t.call('POST', '/orders', { body: t.orderBody([await t.line('apex-performance-tee', 'M', 'Black')]) });
    const { orderNumber } = r.body.data.order;
    for (let i = 0; i < 12; i++) assert.equal((await t.call('POST', '/orders/lookup', { body: { orderNumber, email: 'guest@example.com' } })).status, 200);
    for (let i = 0; i < 10; i++) assert.equal((await t.call('POST', '/orders/lookup', { body: { orderNumber: 'VTX-261111-ABCD2345', email: `guess${i}@example.com` } })).status, 404);
    const blocked = await t.call('POST', '/orders/lookup', { body: { orderNumber, email: 'guest@example.com' } });
    assert.equal(blocked.status, 429); assert.match(blocked.body.message, /Too many lookups/);
  });
});
