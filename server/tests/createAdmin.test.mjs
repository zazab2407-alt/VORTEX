import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupApi, testUri } from './helpers.mjs';

const skip = !testUri('createadmin') && 'set MONGO_TEST_URI to run database tests';
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OLD = 'password-12345'; // the password setupApi gives every user
const NEW = 'Brand-New-Secret-42';

describe('create-admin: create, promote and reset password', { skip }, () => {
  let t, applyAdmin, assertValidAdminPassword;
  before(async () => {
    t = await setupApi('createadmin', { seed: false });
    ({ applyAdmin, assertValidAdminPassword } = await import('../src/seed/adminAccount.js'));
  });
  after(async () => { await t?.close(); });

  const load = (email) => t.models.User.findOne({ email }).select('+password');
  const run = (args, env = {}) => spawnSync(process.execPath, ['src/seed/createAdmin.js', ...args], {
    cwd: serverRoot, encoding: 'utf8', input: '', env: { ...process.env, ...env }, // stdin is not a terminal, so no prompts
  });

  test('a new admin can be created and can use the admin API', async () => {
    const r = await applyAdmin(t.models.User, { email: 'new-admin@x.test', name: 'New Admin', password: 'a-long-password-1' });
    assert.equal(r.action, 'created');
    const u = await load('new-admin@x.test');
    assert.equal(u.role, 'admin'); assert.equal(u.tokenVersion, 0);
    assert.ok(await u.comparePassword('a-long-password-1'));
    assert.notEqual(u.password, 'a-long-password-1', 'stored as a bcrypt hash');
    const login = await t.call('POST', '/auth/login', { body: { email: 'new-admin@x.test', password: 'a-long-password-1' } });
    assert.equal(login.status, 200);
    assert.equal((await t.call('GET', '/admin/stats', { cookie: login.cookie })).status, 200);
  });

  test('an existing customer is promoted and keeps their password and sessions', async () => {
    const before = await load('alice@x.test');
    const r = await applyAdmin(t.models.User, { email: 'alice@x.test' });
    assert.equal(r.action, 'promoted'); assert.equal(r.passwordReset, false);
    const after = await load('alice@x.test');
    assert.equal(after.role, 'admin'); assert.equal(after.password, before.password); assert.equal(after.tokenVersion, before.tokenVersion);
    assert.ok(await after.comparePassword(OLD));
    assert.equal((await t.call('GET', '/admin/stats', { cookie: t.aliceCookie })).status, 200, 'her existing session still works and is now admin');
  });

  test('an existing admin without --reset-password is left untouched', async () => {
    const before = await load('admin@x.test');
    const r = await applyAdmin(t.models.User, { email: 'admin@x.test', password: NEW });
    assert.equal(r.action, 'unchanged');
    const after = await load('admin@x.test');
    assert.equal(after.password, before.password); assert.equal(after.tokenVersion, before.tokenVersion);
    assert.ok(await after.comparePassword(OLD));
  });

  test('an existing admin can reset their password: new works, old does not, old sessions end, email and role stay', async () => {
    const before = await load('admin@x.test');
    assert.equal((await t.call('GET', '/auth/me', { cookie: t.adminCookie })).status, 200);
    const r = await applyAdmin(t.models.User, { email: 'admin@x.test', password: NEW, resetPassword: true });
    assert.equal(r.action, 'password-reset'); assert.equal(r.passwordReset, true);

    const after = await load('admin@x.test');
    assert.equal(after.email, 'admin@x.test'); assert.equal(after.role, 'admin'); assert.equal(after.isActive, true);
    assert.ok(await after.comparePassword(NEW), 'new password works with comparePassword()');
    assert.equal(await after.comparePassword(OLD), false, 'old password no longer works');
    assert.notEqual(after.password, before.password); assert.notEqual(after.password, NEW);
    assert.match(after.password, /^\$2[aby]\$12\$/, 'bcrypt hash made by the model hook');
    assert.equal(after.tokenVersion, before.tokenVersion + 1, 'tokenVersion incremented');

    assert.equal((await t.call('GET', '/auth/me', { cookie: t.adminCookie })).status, 401, 'the old JWT session is invalid');
    assert.equal((await t.call('POST', '/auth/login', { body: { email: 'admin@x.test', password: OLD } })).status, 401);
    const login = await t.call('POST', '/auth/login', { body: { email: 'admin@x.test', password: NEW } });
    assert.equal(login.status, 200);
    assert.equal((await t.call('GET', '/admin/stats', { cookie: login.cookie })).status, 200);
  });

  test('invalid or too-short passwords are rejected and change nothing', async () => {
    const bad = {
      'empty': '', 'too short (9 characters)': '123456789', 'undefined': undefined, 'a number': 1234567890123,
      '73 bytes': 'a'.repeat(73), '37 two-byte characters (74 bytes)': 'é'.repeat(37),
    };
    const before = await load('bob@x.test');
    for (const [label, password] of Object.entries(bad)) {
      await assert.rejects(applyAdmin(t.models.User, { email: 'bob@x.test', password, resetPassword: true }), Error, label);
      await assert.rejects(applyAdmin(t.models.User, { email: 'nobody@x.test', password }), Error, `create: ${label}`);
    }
    const after = await load('bob@x.test');
    assert.equal(after.role, 'customer', 'a rejected reset does not promote either');
    assert.equal(after.password, before.password); assert.equal(after.tokenVersion, before.tokenVersion);
    assert.equal(await t.models.User.countDocuments({ email: 'nobody@x.test' }), 0);
    assert.doesNotThrow(() => assertValidAdminPassword('a'.repeat(10)));
    assert.doesNotThrow(() => assertValidAdminPassword('a'.repeat(72)));
  });

  test('a deactivated admin is not silently reactivated by a reset', async () => {
    await t.models.User.create({ name: 'Old Admin', email: 'old@x.test', password: OLD, role: 'admin', isActive: false });
    const r = await applyAdmin(t.models.User, { email: 'old@x.test', password: NEW, resetPassword: true });
    assert.equal(r.inactive, true);
    assert.equal((await load('old@x.test')).isActive, false);
  });

  test('passwords and hashes never appear in results, serialized users or API responses', async () => {
    await t.models.User.create({ name: 'Zed', email: 'zed@x.test', password: OLD, role: 'admin' });
    const r = await applyAdmin(t.models.User, { email: 'zed@x.test', password: 'Another-Secret-77', resetPassword: true });
    const hash = (await load('zed@x.test')).password;
    const login = await t.call('POST', '/auth/login', { body: { email: 'zed@x.test', password: 'Another-Secret-77' } });
    const me = await t.call('GET', '/auth/me', { cookie: login.cookie });
    const bodies = [JSON.stringify(await t.models.User.findOne({ email: 'zed@x.test' })), JSON.stringify(login.body), JSON.stringify(me.body)];
    for (const s of [JSON.stringify(r), ...bodies]) { assert.ok(!s.includes('Another-Secret-77')); assert.ok(!s.includes(hash)); }
    for (const s of bodies) assert.ok(!/"password"/i.test(s), 'no password field in serialized users or API responses');
    assert.equal((await t.models.User.findOne({ email: 'zed@x.test' })).password, undefined, 'password is select:false');
  });

  describe('the command-line script', () => {
    const base = ['--email', 'admin@x.test', '--reset-password'];
    test('resets a password non-interactively and never prints it', async () => {
      const before = await load('admin@x.test');
      const secret = 'Cli-Secret-Value-99';
      const r = run(base, { ADMIN_PASSWORD: secret });
      assert.equal(r.status, 0, r.stderr);
      assert.match(r.stdout, /Password reset for admin admin@x\.test/);
      assert.ok(!(r.stdout + r.stderr).includes(secret), 'plaintext password not in output');
      const after = await load('admin@x.test');
      assert.ok(await after.comparePassword(secret)); assert.equal(after.tokenVersion, before.tokenVersion + 1);
      assert.ok(!(r.stdout + r.stderr).includes(after.password), 'hash not in output');
    });
    test('a too-short password fails with exit code 1, no leak, no change', async () => {
      const before = await load('admin@x.test');
      const r = run(base, { ADMIN_PASSWORD: 'short-pw' });
      assert.equal(r.status, 1); assert.match(r.stderr, /at least 10 characters/);
      assert.ok(!(r.stdout + r.stderr).includes('short-pw'));
      const after = await load('admin@x.test');
      assert.equal(after.password, before.password); assert.equal(after.tokenVersion, before.tokenVersion);
    });
    test('an existing admin without the flag changes nothing and says how to reset', () => {
      const r = run(['--email', 'admin@x.test'], { ADMIN_PASSWORD: 'Ignored-Password-1' });
      assert.equal(r.status, 0); assert.match(r.stdout, /already an admin\. Nothing changed.*--reset-password/);
    });
    test('--password is refused together with --reset-password', () => {
      const r = run([...base, '--password', 'Typed-On-CommandLine-1']);
      assert.equal(r.status, 1); assert.match(r.stderr, /Do not pass --password/);
      assert.ok(!(r.stdout + r.stderr).includes('Typed-On-CommandLine-1'));
    });
    test('without a terminal or ADMIN_PASSWORD a reset fails instead of hanging', () => {
      const r = run(base, { ADMIN_PASSWORD: undefined });
      assert.equal(r.status, 1); assert.match(r.stderr, /Run in a terminal/);
    });
    test('resetting an account that does not exist is refused', () => {
      const r = run(['--email', 'ghost@x.test', '--reset-password'], { ADMIN_PASSWORD: 'Whatever-Password-1' });
      assert.equal(r.status, 1); assert.match(r.stderr, /No account exists/);
    });
    test('creating and promoting still work from the command line', async () => {
      const c = run(['--email', 'cli-new@x.test', '--name', 'Cli New'], { ADMIN_PASSWORD: 'Cli-New-Password-1' });
      assert.equal(c.status, 0, c.stderr); assert.match(c.stdout, /Admin account created/);
      assert.equal((await load('cli-new@x.test')).role, 'admin');
      const p = run(['--email', 'bob@x.test']);
      assert.equal(p.status, 0, p.stderr); assert.match(p.stdout, /promoted to admin\. Its password was not changed/);
      assert.ok(await (await load('bob@x.test')).comparePassword(OLD));
    });
  });
});
