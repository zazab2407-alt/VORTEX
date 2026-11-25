// Multer 2.x robustness: malformed, truncated and aborted multipart requests must never crash or wedge the server
// (the two high-severity Multer 1.x flaws were a crash on a malformed request and a leak when the request stream errored).
// Needs MONGO_TEST_URI. Uploads go to a temp folder, never into the project.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { testUri, makeCall, login } from './helpers.mjs';

const uri = testUri('uploadrobust');
const skip = !uri && 'set MONGO_TEST_URI to run database tests';
process.env.MONGO_URI = uri || 'mongodb://127.0.0.1:1/unused';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123';
process.env.NODE_ENV = 'test';
process.env.UPLOADS_DIR = path.join(os.tmpdir(), `vortex-test-uploads-robust-${process.pid}`);

const { default: mongoose } = await import('mongoose');
const { default: app } = await import('../src/app.js');
const { User } = await import('../src/models/index.js');

describe('Multer 2.x upload robustness', { skip }, () => {
  let server, port, call, admin;
  const png = () => sharp({ create: { width: 8, height: 8, channels: 3, background: '#e63' } }).png().toBuffer();
  const BOUNDARY = 'vortexTestBoundary';

  /** Raw HTTP request so tests can send bodies a well-behaved client never would. `abortAfterMs` destroys the socket mid-request. */
  function raw({ contentType = `multipart/form-data; boundary=${BOUNDARY}`, body = '', declaredLength, abortAfterMs } = {}) {
    return new Promise((resolve) => {
      const req = http.request({ host: '127.0.0.1', port, method: 'POST', path: '/api/admin/uploads', agent: false, headers: {
        'content-type': contentType, 'content-length': String(declaredLength ?? Buffer.byteLength(body)), cookie: admin, 'x-requested-with': 'vortex-web',
      } }, (res) => { let b = ''; res.on('data', (c) => { b += c; }); res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(b) }); } catch { resolve({ status: res.statusCode, body: null }); } }); });
      req.on('error', () => resolve({ status: 0, aborted: true }));
      req.write(body);
      if (abortAfterMs !== undefined) setTimeout(() => { req.destroy(); resolve({ status: 0, aborted: true }); }, abortAfterMs);
      else req.end();
    });
  }
  const goodUpload = async () => { const f = new FormData(); f.append('image', new Blob([await png()], { type: 'image/png' }), 'ok.png'); return call('POST', '/admin/uploads', { form: f, cookie: admin }); };
  const stillHealthy = async (label) => { assert.equal((await call('GET', '/admin/stats', { cookie: admin })).status, 200, `${label}: server still answers`); assert.equal((await goodUpload()).status, 201, `${label}: a valid upload still works`); };
  const part = (name, filename, type, content) => `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${name}"${filename ? `; filename="${filename}"` : ''}\r\n${type ? `Content-Type: ${type}\r\n` : ''}\r\n${content}\r\n`;

  before(async () => {
    await mongoose.connect(uri); await mongoose.connection.dropDatabase(); await User.init();
    await new Promise((r) => { server = app.listen(0, r); });
    port = server.address().port; call = makeCall(`http://127.0.0.1:${port}/api`);
    await User.create({ name: 'Admin', email: 'admin@x.test', password: 'admin-password-1', role: 'admin' });
    admin = await login(call, 'admin@x.test', 'admin-password-1');
  });
  after(async () => {
    server.closeAllConnections?.(); await new Promise((r) => server.close(r));
    await mongoose.connection.dropDatabase(); await mongoose.disconnect();
    sharp.cache(false); await fs.rm(process.env.UPLOADS_DIR, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });

  test('a body that is not valid multipart gets a client error, not a crash', async () => {
    const r = await raw({ body: 'this is not multipart at all' });
    assert.ok(r.status >= 400 && r.status < 500, `status ${r.status}`);
    await stillHealthy('garbage body');
  });

  test('a multipart request with no closing boundary is rejected cleanly', async () => {
    const r = await raw({ body: `--${BOUNDARY}\r\nContent-Disposition: form-data; name="image"; filename="a.png"\r\nContent-Type: image/png\r\n\r\npartial-bytes` });
    assert.ok(r.status >= 400 && r.status < 500, `status ${r.status}`);
    await stillHealthy('unterminated multipart');
  });

  test('a malformed part header is rejected cleanly', async () => {
    const r = await raw({ body: `--${BOUNDARY}\r\nContent-Disposition form-data name=image\r\n\r\nx\r\n--${BOUNDARY}--\r\n` });
    assert.ok(r.status >= 400 && r.status < 500, `status ${r.status}`);
    await stillHealthy('malformed header');
  });

  test('multipart content type with no boundary is rejected cleanly', async () => {
    const r = await raw({ contentType: 'multipart/form-data', body: 'x' });
    assert.ok(r.status >= 400 && r.status < 500, `status ${r.status}`);
    await stillHealthy('missing boundary');
  });

  test('a part without a field name is rejected, not accepted as the image', async () => {
    const body = `--${BOUNDARY}\r\nContent-Disposition: form-data; filename="a.png"\r\nContent-Type: image/png\r\n\r\n${(await png()).toString('latin1')}\r\n--${BOUNDARY}--\r\n`;
    const r = await raw({ body });
    assert.ok(r.status >= 400 && r.status < 500, `status ${r.status}`);
    await stillHealthy('nameless part');
  });

  test('a text field next to the image is refused (fields: 0) with a client error', async () => {
    const f = new FormData(); f.append('image', new Blob([await png()], { type: 'image/png' }), 'ok.png'); f.append('note', 'extra');
    const r = await call('POST', '/admin/uploads', { form: f, cookie: admin });
    assert.equal(r.status, 400);
    await stillHealthy('extra field');
  });

  test('a non-multipart request to the upload endpoint is a clear 400', async () => {
    const r = await call('POST', '/admin/uploads', { body: { image: 'x' }, cookie: admin });
    assert.equal(r.status, 400);
  });

  test('requests aborted mid-upload do not crash or wedge the server (stream-error leak, fixed in Multer 2.0)', async () => {
    const head = `--${BOUNDARY}\r\nContent-Disposition: form-data; name="image"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n`;
    const aborts = [];
    for (let i = 0; i < 40; i++) aborts.push(raw({ body: head + 'A'.repeat(2000), declaredLength: 200000, abortAfterMs: 5 + (i % 5) * 5 }));
    await Promise.all(aborts);
    await new Promise((r) => setTimeout(r, 250));
    await stillHealthy('after 40 aborted uploads');
  });

  test('the process survives a burst of mixed malformed requests', async () => {
    const bodies = ['', '--', `--${BOUNDARY}`, `--${BOUNDARY}--`, `--${BOUNDARY}\r\n\r\n`, '\r\n\r\n', `--${BOUNDARY}\r\nContent-Disposition: form-data; name="image"\r\n\r\n`];
    const results = await Promise.all(bodies.flatMap((b) => [raw({ body: b }), raw({ body: b, declaredLength: b.length + 50, abortAfterMs: 20 })]));
    for (const r of results) assert.ok(r.aborted || r.status < 500, `no 5xx for malformed input (got ${r.status})`);
    await stillHealthy('mixed burst');
  });
});
