// Contact form: validation, honest delivery reporting (never "sent" unless the SMTP server accepted it), no storage, no leaks.
import { test, describe, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupApi, testUri } from './helpers.mjs';

// These must be set BEFORE the app (and its frozen config) is imported. Empty SMTP values also stop a developer's real .env from leaking in.
process.env.CONTACT_TO = 'inbox@shop.test';
process.env.STORE_EMAIL = 'help@shop.test';
process.env.SMTP_HOST = ''; process.env.SMTP_USER = ''; process.env.SMTP_PASS = '';
process.env.MAIL_FROM = 'Shop <orders@shop.test>';

const skip = !testUri('contact') && 'set MONGO_TEST_URI to run database tests';
const valid = (over = {}) => ({ name: 'Mona Visitor', email: 'mona@example.com', topic: 'order', message: 'Hello, where is my order? It was due yesterday.', ...over });

describe('Contact form', { skip }, () => {
  let t, call, mailer, fake;
  const makeFake = ({ fail = false } = {}) => ({ mails: [], async sendMail(m) { if (fail) { const e = new Error('535 Authentication failed for user secret-account'); e.code = 'EAUTH'; throw e; } this.mails.push(m); return { accepted: [m.to] }; } });
  before(async () => { t = await setupApi('contact', { seed: false }); call = t.call; mailer = await import('../src/services/mailer.js'); });
  after(async () => { mailer?.setTransportForTests(null); if (t) await t.close(); });
  afterEach(() => mailer.setTransportForTests(null));
  const send = (body, opts = {}) => call('POST', '/contact', { body, ...opts });

  describe('when SMTP is NOT configured', () => {
    test('says plainly that nothing was sent, offers the public email, and never claims success', async () => {
      const r = await send(valid());
      assert.equal(r.status, 503); assert.equal(r.body.success, false); assert.equal(r.body.code, 'email_unavailable');
      assert.match(r.body.message, /not sent/); assert.match(r.body.message, /help@shop\.test/);
      assert.ok(!/thank you|was sent!/i.test(r.body.message));
      assert.ok(!JSON.stringify(r.body).includes('inbox@shop.test'), 'the private inbox is never revealed');
    });
    test('the public config tells the storefront the form is disabled', async () => {
      const c = (await call('GET', '/cart/config')).body.data;
      assert.equal(c.contact.formEnabled, false); assert.equal(c.contact.email, 'help@shop.test');
      assert.ok(!JSON.stringify(c).includes('inbox@shop.test'));
    });
  });

  describe('when SMTP accepts mail', () => {
    test('delivers to CONTACT_TO with the visitor as reply-to, and reports success only then', async () => {
      fake = makeFake(); mailer.setTransportForTests(fake);
      const r = await send(valid());
      assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.success, true); assert.equal(r.body.data.sent, true);
      assert.equal(fake.mails.length, 1); const m = fake.mails[0];
      assert.equal(m.to, 'inbox@shop.test'); assert.equal(m.replyTo, 'mona@example.com'); assert.equal(m.from, 'Shop <orders@shop.test>');
      assert.match(m.subject, /order/); assert.match(m.text, /where is my order/); assert.match(m.text, /Mona Visitor/);
      assert.equal((await call('GET', '/cart/config')).body.data.contact.formEnabled, true);
    });
    test('topic is optional and defaults sensibly', async () => {
      fake = makeFake(); mailer.setTransportForTests(fake);
      assert.equal((await send(valid({ topic: undefined }))).status, 200); assert.match(fake.mails[0].subject, /other/);
    });
    test('user text is escaped in the HTML body and cannot inject headers', async () => {
      fake = makeFake(); mailer.setTransportForTests(fake);
      const r = await send(valid({ name: 'Eve\r\nBcc: victim@example.com', message: '<script>alert(1)</script> and more text here' }));
      assert.equal(r.status, 200, JSON.stringify(r.body)); const m = fake.mails[0];
      assert.ok(!/[\r\n]/.test(m.subject), 'no line breaks in the subject'); assert.ok(!('bcc' in m) && !('cc' in m));
      assert.ok(m.html.includes('&lt;script&gt;') && !m.html.includes('<script>'));
      assert.equal(m.replyTo, 'mona@example.com');
    });
  });

  describe('when the mail server fails', () => {
    test('returns 502, says the message was not sent, and logs neither the message, the address nor provider details', async () => {
      mailer.setTransportForTests(makeFake({ fail: true }));
      const logs = []; const orig = { error: console.error, log: console.log, warn: console.warn };
      console.error = console.log = console.warn = (...a) => logs.push(a.map(String).join(' '));
      let r; try { r = await send(valid({ message: 'My very private message text 12345' })); } finally { Object.assign(console, orig); }
      assert.equal(r.status, 502); assert.equal(r.body.code, 'email_failed'); assert.match(r.body.message, /not sent/);
      assert.ok(logs.some((l) => /contact message not sent \(EAUTH\)/.test(l)), 'logs the error code');
      const all = logs.join('\n');
      for (const secret of ['private message text', 'mona@example.com', 'secret-account', 'Authentication failed']) assert.ok(!all.includes(secret), `logged: ${secret}`);
    });
    test('a mail server that never answers is given up on (unit level, short timeout)', async () => {
      mailer.setTransportForTests({ sendMail: () => new Promise(() => {}) });
      assert.deepEqual(await mailer.sendContactMessage(valid(), { timeoutMs: 40 }), { sent: false, reason: 'failed' });
    });
  });

  describe('validation (no mail is attempted for invalid input)', () => {
    test('rejects bad names, emails, topics and messages with 400', async () => {
      fake = makeFake(); mailer.setTransportForTests(fake);
      const bad = [
        { name: 'A' }, { name: 'x'.repeat(81) }, { name: undefined }, { name: 123 },
        { email: 'nope' }, { email: undefined }, { email: '"a@evil.example"@shop.test' }, { email: 'a@b.com,c@d.com' },
        { topic: 'sales-pitch' }, { message: 'short' }, { message: 'x'.repeat(2001) }, { message: undefined }, { message: { $ne: 1 } },
      ];
      for (const over of bad) { const r = await send(valid(over)); assert.equal(r.status, 400, `${JSON.stringify(over)} -> ${r.status}`); assert.ok(r.body.message); }
      assert.equal(fake.mails.length, 0);
    });
    test('trims whitespace and accepts the maximum length', async () => {
      fake = makeFake(); mailer.setTransportForTests(fake);
      assert.equal((await send(valid({ name: '  Mona  ', message: `  ${'a'.repeat(2000)}  ` }))).status, 200);
    });
    test('the hidden honeypot field blocks bots without sending anything', async () => {
      fake = makeFake(); mailer.setTransportForTests(fake);
      const r = await send(valid({ website: 'http://spam.example' }));
      assert.equal(r.status, 400); assert.equal(fake.mails.length, 0); assert.ok(!r.body.success);
    });
    test('requests without the app’s CSRF header are refused', async () => {
      fake = makeFake(); mailer.setTransportForTests(fake);
      const r = await send(valid(), { csrf: false });
      assert.ok([400, 403].includes(r.status), String(r.status)); assert.equal(fake.mails.length, 0);
    });
  });

  describe('privacy', () => {
    test('messages are never stored in MongoDB', async () => {
      fake = makeFake(); mailer.setTransportForTests(fake);
      assert.equal((await send(valid({ message: 'Please do not store this message anywhere.' }))).status, 200);
      const cols = (await t.mongoose.connection.db.listCollections().toArray()).map((c) => c.name);
      assert.ok(!cols.some((n) => /contact|message|inquir/i.test(n)), `unexpected collection: ${cols}`);
      for (const n of cols) assert.equal(await t.mongoose.connection.db.collection(n).countDocuments({ message: { $exists: true } }), 0, `${n} has a document with a message field`);
    });
    test('the response is not cacheable', async () => {
      const r = await send(valid()); assert.match(r.headers.get('cache-control') ?? '', /no-store/);
    });
  });
});
