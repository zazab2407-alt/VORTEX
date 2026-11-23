import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { testUri, makeCall } from './helpers.mjs';

const uri = testUri('ratelimit');
const skip = !uri && 'set MONGO_TEST_URI to run database tests';
process.env.MONGO_URI = uri || 'mongodb://127.0.0.1:1/unused';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123';
process.env.NODE_ENV = 'development'; // limiters are switched off only when NODE_ENV=test

const { default: mongoose } = await import('mongoose');
const { default: app } = await import('../src/app.js');
const { User } = await import('../src/models/index.js');

describe('Login rate limiting', { skip }, () => {
  let server, call;
  before(async () => {
    await mongoose.connect(uri); await mongoose.connection.dropDatabase(); await User.init();
    await User.create({ name: 'Real User', email: 'real@example.com', password: 'real-password-1' });
    await new Promise((r) => { server = app.listen(0, r); });
    call = makeCall(`http://127.0.0.1:${server.address().port}/api`);
  });
  after(async () => { server.close(); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });

  test('successful logins are not counted; the 11th FAILED attempt is blocked with 429', async () => {
    for (let i = 0; i < 12; i++) assert.equal((await call('POST', '/auth/login', { body: { email: 'real@example.com', password: 'real-password-1' } })).status, 200, 'legit logins never get locked out');
    for (let i = 0; i < 10; i++) assert.equal((await call('POST', '/auth/login', { body: { email: 'real@example.com', password: `wrong-${i}` } })).status, 401);
    const blocked = await call('POST', '/auth/login', { body: { email: 'real@example.com', password: 'wrong-again' } });
    assert.equal(blocked.status, 429); assert.match(blocked.body.message, /Too many attempts/);
    assert.ok(blocked.headers.get('ratelimit-limit'));
  });
});
