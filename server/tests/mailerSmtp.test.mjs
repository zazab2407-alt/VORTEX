// Real SMTP path, no mocks: a local SMTP stub (Node's built-in net module) receives messages sent by the real Nodemailer
// transport built with the production options. Exists because mailer.test.mjs injects a fake transport, so it never
// exercises Nodemailer itself. No database.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';

process.env.MONGO_URI = 'mongodb://127.0.0.1:1/unused';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123';
process.env.NODE_ENV = 'test';
const { createSmtpTransport, buildConfirmationEmail, buildContactEmail, sendOrderConfirmation, verifySmtp, setTransportForTests } = await import('../src/services/mailer.js');

/**
 * Minimal SMTP server: greeting, EHLO (advertises AUTH PLAIN only, no STARTTLS), AUTH PLAIN (inline or two-step),
 * MAIL FROM, RCPT TO, DATA (with dot-unstuffing), RSET, NOOP, QUIT. Anything else gets 500.
 * `greet: false` never sends the 220 greeting (used to test greetingTimeout). `authFails: true` rejects AUTH with 535.
 */
function startSmtpStub({ greet = true, authFails = false, rcptReply = null, dataReply = null, stallAfterEhlo = false, dropAfterGreet = false } = {}) {
  const messages = [];
  const envelopes = [];
  const server = net.createServer((sock) => {
    sock.setEncoding('utf8');
    let buf = '';
    let inData = false;
    let data = '';
    let awaiting = null; // 'auth-token' while waiting for a two-step AUTH PLAIN response
    const send = (line) => sock.write(`${line}\r\n`);
    if (greet) send('220 stub.vortex.test ESMTP ready');
    sock.on('data', (chunk) => {
      buf += chunk;
      let idx;
      while ((idx = buf.indexOf('\r\n')) !== -1) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        if (inData) {
          if (line === '.') { inData = false; if (!dataReply) messages.push(data); data = ''; send(dataReply ?? '250 2.0.0 queued'); }
          else data += (line.startsWith('..') ? line.slice(1) : line) + '\n';
          continue;
        }
        if (awaiting === 'auth-token') {
          awaiting = null;
          send(authFails ? '535 5.7.8 Authentication credentials invalid' : '235 2.7.0 Authentication successful');
          continue;
        }
        const up = line.toUpperCase();
        if (dropAfterGreet) { sock.destroy(); return; } // greeted, then the connection is lost on the first command (deterministic, no timer)
        if (stallAfterEhlo && (up.startsWith('EHLO') || up.startsWith('HELO'))) continue; // never answers: exercises socketTimeout
        if (up.startsWith('EHLO') || up.startsWith('HELO')) {
          send('250-stub.vortex.test');
          send('250 AUTH PLAIN');
        } else if (up.startsWith('AUTH PLAIN')) {
          const token = line.split(' ')[2];
          if (token) send(authFails ? '535 5.7.8 Authentication credentials invalid' : '235 2.7.0 Authentication successful');
          else { awaiting = 'auth-token'; send('334 '); }
        } else if (up.startsWith('MAIL FROM:')) { envelopes.push({ from: line.slice(10).trim() }); send('250 2.1.0 sender OK'); }
        else if (up.startsWith('RCPT TO:')) { envelopes[envelopes.length - 1].to = line.slice(8).trim(); send(rcptReply ?? '250 2.1.5 recipient OK'); }
        else if (up === 'DATA') { send('354 end data with <CR><LF>.<CR><LF>'); inData = true; }
        else if (up === 'RSET' || up === 'NOOP') send('250 2.0.0 OK');
        else if (up === 'QUIT') { send('221 2.0.0 bye'); sock.end(); }
        else send('500 5.5.2 command not recognised');
      }
    });
    sock.on('error', () => {});
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({
    port: server.address().port, messages, envelopes,
    close: () => new Promise((r) => { server.close(r); server.closeAllConnections?.(); }),
  })));
}

const smtpFor = (port, over = {}) => ({ host: '127.0.0.1', port, user: 'vortex-mailer', pass: 'stub-password', from: 'VORTEX <no-reply@vortex.test>', ...over });
const order = {
  orderNumber: 'VTX-261122-STUB2345', customer: { fullName: 'Stub Buyer', email: 'buyer@example.test' },
  items: [{ name: 'Flux High-Waist Leggings', size: 'M', color: 'Black', quantity: 1, lineTotal: 68 }],
  subtotal: 68, discount: 0, couponCode: null, shippingCost: 5, total: 73, shippingAddress: { address: '1 Nile St', city: 'Cairo' },
};

describe('Nodemailer over real SMTP (local stub)', () => {
  let stub;
  before(async () => { stub = await startSmtpStub(); });
  after(async () => { await stub.close(); });

  test('verify() succeeds against the stub (EHLO, AUTH PLAIN)', async () => {
    const t = createSmtpTransport(smtpFor(stub.port));
    try {
      await t.verify();
    } finally { t.close(); }
  });

  test('sends a complete confirmation message through the real transport, with the production options', async () => {
    const t = createSmtpTransport(smtpFor(stub.port));
    try {
      const { subject, text, html } = buildConfirmationEmail(order);
      const info = await t.sendMail({ from: 'VORTEX <no-reply@vortex.test>', to: order.customer.email, subject, text, html });
      assert.deepEqual(info.accepted, [order.customer.email]);
      assert.deepEqual(info.rejected, []);
    } finally { t.close(); }
    const sent = stub.messages.at(-1);
    assert.ok(sent, 'the stub received a DATA body');
    assert.match(sent, /^Subject: .*VTX-261122-STUB2345/m);
    assert.ok(sent.includes('Flux High-Waist Leggings'), 'body carries the order lines');
    assert.ok(sent.includes('Cash on Delivery'));
    assert.equal(stub.envelopes.at(-1).to.replace(/[<>]/g, ''), order.customer.email, 'envelope recipient is the customer');
  });

  test('greetingTimeout is honoured: a server that never greets fails fast instead of hanging', async () => {
    const silent = await startSmtpStub({ greet: false });
    const t = createSmtpTransport(smtpFor(silent.port), { greetingTimeout: 300, connectionTimeout: 2000 });
    const started = Date.now();
    try {
      await assert.rejects(t.sendMail({ from: 'x@vortex.test', to: 'y@example.test', subject: 's', text: 't' }));
      assert.ok(Date.now() - started < 3000, `took ${Date.now() - started} ms; greetingTimeout (300 ms) was not applied`);
    } finally { t.close(); await silent.close(); }
  });

  test('a rejected login is reported as a failure, not as sent', async () => {
    const bad = await startSmtpStub({ authFails: true });
    const t = createSmtpTransport(smtpFor(bad.port));
    try {
      await assert.rejects(t.verify());
    } finally { t.close(); await bad.close(); }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Added with the Nodemailer 6.10.1 -> 10.6.1 migration: failures, timeouts, connection problems, the production
// mailer.js functions over real SMTP, and message formatting. Every case uses the real Nodemailer transport.
// ---------------------------------------------------------------------------------------------------------------------
const plain = { from: 'VORTEX <no-reply@vortex.test>', to: 'y@example.test', subject: 's', text: 't' };
const closedPort = () => new Promise((resolve) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
/** Runs `fn(transport, stub)` against a fresh stub and always cleans both up. */
async function withStub(stubOpts, overrides, fn) {
  const stub = await startSmtpStub(stubOpts);
  const t = createSmtpTransport(smtpFor(stub.port), overrides);
  try { return await fn(t, stub); } finally { t.close(); await stub.close(); }
}

describe('Nodemailer over real SMTP: server errors, timeouts and connection failures', () => {
  test('a permanent recipient rejection (550) is reported with its response code and nothing is delivered', async () => {
    await withStub({ rcptReply: '550 5.1.1 mailbox unavailable' }, {}, async (t, stub) => {
      await assert.rejects(t.sendMail(plain), (err) => { assert.equal(err.responseCode, 550); return true; });
      assert.equal(stub.messages.length, 0);
    });
  });

  test('a temporary failure (451) is reported with its response code', async () => {
    await withStub({ rcptReply: '451 4.3.0 try again later' }, {}, async (t) => {
      await assert.rejects(t.sendMail(plain), (err) => { assert.equal(err.responseCode, 451); return true; });
    });
  });

  test('a message refused after DATA (554) is reported as failed and not stored', async () => {
    await withStub({ dataReply: '554 5.7.1 message refused' }, {}, async (t, stub) => {
      await assert.rejects(t.sendMail(plain), (err) => { assert.equal(err.responseCode, 554); return true; });
      assert.equal(stub.messages.length, 0);
    });
  });

  test('connection refused fails fast with an error code', async () => {
    const port = await closedPort();
    const t = createSmtpTransport(smtpFor(port), { connectionTimeout: 2000 });
    const started = Date.now();
    try {
      await assert.rejects(t.sendMail(plain), (err) => { assert.ok(typeof err.code === 'string' && err.code.length > 0, `error has a code (${err.code})`); return true; });
      assert.ok(Date.now() - started < 3000, 'did not hang');
    } finally { t.close(); }
  });

  test('a connection dropped right after the greeting is a failure, not a hang', async () => {
    await withStub({ dropAfterGreet: true }, { connectionTimeout: 2000, greetingTimeout: 2000, socketTimeout: 2000 }, async (t) => {
      const started = Date.now();
      await assert.rejects(t.sendMail(plain));
      assert.ok(Date.now() - started < 3500, 'did not hang');
    });
  });

  test('socketTimeout is honoured: a server that stops answering mid-conversation fails with a timeout', async () => {
    await withStub({ stallAfterEhlo: true }, { socketTimeout: 300, greetingTimeout: 2000, connectionTimeout: 2000 }, async (t) => {
      const started = Date.now();
      await assert.rejects(t.sendMail(plain), (err) => { assert.ok(err.code === 'ETIMEDOUT' || /timeout/i.test(err.message), `timeout error (${err.code}: ${err.message})`); return true; });
      assert.ok(Date.now() - started < 3500, `took ${Date.now() - started} ms; socketTimeout (300 ms) was not applied`);
    });
  });
});

describe('mailer.js over real SMTP (production functions, real Nodemailer transport)', () => {
  const use = (t) => setTransportForTests(t);
  after(() => setTransportForTests(null));
  const captureLogs = async (fn) => { const logs = []; const orig = console.error; console.error = (...a) => logs.push(a.join(' ')); try { await fn(); } finally { console.error = orig; } return logs; };

  test('sendOrderConfirmation resolves { sent: true } only after the server accepted the message', async () => {
    await withStub({}, {}, async (t, stub) => {
      use(t);
      assert.deepEqual(await sendOrderConfirmation(order), { sent: true });
      assert.equal(stub.messages.length, 1);
    });
  });

  test('a server rejection becomes { sent: false, reason: "failed" }, never throws, and logs only the error code', async () => {
    await withStub({ rcptReply: '550 5.1.1 mailbox unavailable' }, {}, async (t, stub) => {
      use(t);
      let result;
      const logs = await captureLogs(async () => { result = await sendOrderConfirmation(order); });
      assert.deepEqual(result, { sent: false, reason: 'failed' });
      assert.equal(stub.messages.length, 0);
      assert.ok(logs.some((l) => /order confirmation not sent \(\w+\)/.test(l)), `logs the error code: ${logs.join(' | ')}`);
      const all = logs.join(' ');
      assert.ok(!all.includes('stub-password') && !all.includes('buyer@example.test') && !all.includes('vortex-mailer'), 'no credentials or customer data in logs');
    });
  });

  test('the timeoutMs limit applies even when Nodemailer itself would wait much longer', async () => {
    await withStub({ stallAfterEhlo: true }, {}, async (t) => { // default socketTimeout is 15 s
      use(t);
      const started = Date.now();
      assert.deepEqual(await sendOrderConfirmation(order, { timeoutMs: 400 }), { sent: false, reason: 'failed' });
      assert.ok(Date.now() - started < 3000, `took ${Date.now() - started} ms`);
    });
  });

  test('verifySmtp: ok against a good server, a code-only reason for a bad login or an unreachable server', async () => {
    await withStub({}, {}, async (t) => { use(t); assert.deepEqual(await verifySmtp(), { ok: true }); });
    await withStub({ authFails: true }, {}, async (t) => { use(t); assert.deepEqual(await verifySmtp(), { ok: false, reason: 'EAUTH' }); });
    const port = await closedPort();
    const t = createSmtpTransport(smtpFor(port), { connectionTimeout: 1500 });
    try { use(t); const r = await verifySmtp({ timeoutMs: 3000 }); assert.equal(r.ok, false); assert.match(r.reason, /^[A-Za-z_]+$/, 'reason is a bare code'); } finally { t.close(); }
  });
});

describe('Message formatting through the real transport', () => {
  const headersOf = (raw) => raw.slice(0, raw.indexOf('\n\n')).replace(/\n[ \t]+/g, ' ');
  const decodeQp = (s) => Buffer.from(s.replace(/=\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))), 'latin1').toString('utf8');
  /** Returns the decoded body of the first MIME part of the given content type. */
  const part = (raw, type) => {
    const boundary = /boundary="?([^"\n;]+)"?/i.exec(headersOf(raw))?.[1];
    assert.ok(boundary, 'message is multipart');
    const chunk = raw.split(`--${boundary}`).find((p) => new RegExp(`Content-Type: ${type}`, 'i').test(p));
    assert.ok(chunk, `has a ${type} part`);
    const body = chunk.slice(chunk.indexOf('\n\n') + 2);
    const cte = /Content-Transfer-Encoding: (\S+)/i.exec(chunk)?.[1]?.toLowerCase();
    if (cte === 'base64') return Buffer.from(body.replace(/\s/g, ''), 'base64').toString('utf8');
    if (cte === 'quoted-printable') return decodeQp(body);
    return body;
  };

  test('standard headers, UTF-8 and a text + HTML alternative', async () => {
    await withStub({}, {}, async (t, stub) => {
      const { subject, text, html } = buildConfirmationEmail(order);
      await t.sendMail({ from: 'VORTEX <no-reply@vortex.test>', to: order.customer.email, subject, text, html });
      const raw = stub.messages.at(-1);
      const h = headersOf(raw);
      assert.match(h, /^MIME-Version: 1\.0$/m);
      assert.match(h, /^From: VORTEX <no-reply@vortex\.test>$/m);
      assert.match(h, /^To: buyer@example\.test$/m);
      assert.match(h, /^Message-ID: <.+@.+>$/im);
      assert.match(h, /^Date: .+$/m);
      assert.match(h, /^Content-Type: multipart\/alternative;/m);
      assert.match(raw, /Content-Type: text\/plain; charset=utf-8/i);
      assert.match(raw, /Content-Type: text\/html; charset=utf-8/i);
      assert.ok(part(raw, 'text/plain').includes('Order number: VTX-261122-STUB2345'));
      assert.ok(part(raw, 'text/html').includes('<strong>VTX-261122-STUB2345</strong>'));
    });
  });

  test('non-ASCII customer names survive intact; HTML special characters are escaped in the HTML part', async () => {
    await withStub({}, {}, async (t, stub) => {
      const unicode = { ...order, customer: { fullName: 'Zoë Ünal عمر', email: 'buyer@example.test' } };
      const evil = { ...order, customer: { fullName: 'Eve <script>alert(1)</script>', email: 'buyer@example.test' } };
      for (const o of [unicode, evil]) { const { subject, text, html } = buildConfirmationEmail(o); await t.sendMail({ from: 'VORTEX <no-reply@vortex.test>', to: o.customer.email, subject, text, html }); }
      const [u, e] = stub.messages.slice(-2);
      assert.ok(part(u, 'text/plain').includes('Zoë Ünal عمر'));
      assert.ok(part(u, 'text/html').includes('Zoë Ünal عمر'));
      assert.ok(!part(e, 'text/html').includes('<script>') && part(e, 'text/html').includes('&lt;script&gt;'), 'script tag is escaped');
    });
  });

  test('CR/LF in contact-form fields cannot add headers or recipients', async () => {
    await withStub({}, {}, async (t, stub) => {
      const { subject, text, html } = buildContactEmail({ name: 'Mallory\r\nBcc: evil@attacker.test', email: 'm@example.test', topic: 'Support\r\nX-Evil: 1', message: 'hello' });
      await t.sendMail({ from: 'VORTEX <no-reply@vortex.test>', to: 'inbox@vortex.test', replyTo: 'm@example.test', subject, text, html });
      const h = headersOf(stub.messages.at(-1));
      assert.ok(!/^Bcc:/im.test(h) && !/^X-Evil:/im.test(h), `no injected header:\n${h}`);
      assert.equal(stub.envelopes.at(-1).to.replace(/[<>]/g, ''), 'inbox@vortex.test', 'only the configured inbox receives it');
    });
  });

  test('a body line that is a single dot does not end the message early (dot-stuffing)', async () => {
    await withStub({}, {}, async (t, stub) => {
      await t.sendMail({ ...plain, text: 'before\n.\nafter the dot', html: '<p>before</p>' });
      assert.ok(part(stub.messages.at(-1), 'text/plain').includes('after the dot'), 'the text after the lone dot arrived');
    });
  });
});
