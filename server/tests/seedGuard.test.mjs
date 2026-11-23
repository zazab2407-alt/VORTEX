import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Pure tests. databaseGuard.js has no imports, and helpers.mjs imports only databaseGuard.js at load time,
// so nothing here loads configuration, models or a database driver, or opens a connection.
import { SEED_DATABASE, databaseNameFromUri, isSeedDatabase, isTestDatabase, isResettableDatabase } from '../src/seed/databaseGuard.js';
import { testUri } from './helpers.mjs';

describe('seed database guard (no database needed)', () => {
  test('the only accepted database name is exactly vortex_playground', () => {
    assert.equal(SEED_DATABASE, 'vortex_playground');
  });

  test('accepts the playground database on local, replica-set, multi-host and Atlas-style URIs', () => {
    assert.equal(isSeedDatabase('mongodb://127.0.0.1:27017/vortex_playground'), true);
    assert.equal(isSeedDatabase('mongodb://127.0.0.1:27018/vortex_playground?replicaSet=rs0'), true);
    assert.equal(isSeedDatabase('mongodb://a.example:27017,b.example:27017/vortex_playground'), true);
    assert.equal(isSeedDatabase('mongodb+srv://user:secret@cluster0.example.net/vortex_playground?retryWrites=true&w=majority'), true);
  });

  test('refuses the original database and near-miss names', () => {
    for (const name of ['vortex', 'vortex_test', 'vortex_playground2', 'vortex_playgrounds', 'vortex_playground_test', 'Vortex_Playground']) {
      assert.equal(isSeedDatabase(`mongodb://127.0.0.1:27017/${name}`), false, name);
    }
  });

  test('refuses a trailing slash after the name', () => {
    assert.equal(isSeedDatabase('mongodb://127.0.0.1:27017/vortex_playground/'), false);
  });

  test('refuses when the name appears only in the host part', () => {
    assert.equal(isSeedDatabase('mongodb://vortex_playground:27017/vortex'), false);
  });

  test('refuses URIs with no database name, or no URI at all', () => {
    for (const uri of ['mongodb://127.0.0.1:27017', 'mongodb://127.0.0.1:27017/', 'mongodb://127.0.0.1:27017/?x=1', '', 'not a uri', undefined, null]) {
      assert.equal(isSeedDatabase(uri), false, String(uri));
    }
  });

  test('fails closed when a raw slash appears in the credentials', () => {
    assert.equal(isSeedDatabase('mongodb://user:pa/ss@host/vortex_playground'), false);
  });

  test('returns the database name only, never credentials or hosts', () => {
    assert.equal(databaseNameFromUri('mongodb+srv://user:secret@cluster0.example.net/vortex_playground?x=1'), 'vortex_playground');
    assert.equal(databaseNameFromUri('mongodb://u:p@h:27017/vortex'), 'vortex');
    assert.equal(databaseNameFromUri('mongodb://127.0.0.1:27017'), '');
  });
});

describe('reset permission: playground or test database only', () => {
  test('allows vortex_playground and vortex_test_<non-empty suffix>', () => {
    for (const name of ['vortex_playground', 'vortex_test_admin', 'vortex_test_seed', 'vortex_test_perm', 'vortex_test_api_2', 'vortex_test_coupons-admin']) {
      assert.equal(isResettableDatabase(name), true, name);
    }
  });

  test('rejects the original vortex database', () => {
    assert.equal(isResettableDatabase('vortex'), false);
    assert.equal(isTestDatabase('vortex'), false);
  });

  test('rejects vortex_test with no suffix, and an empty suffix', () => {
    assert.equal(isResettableDatabase('vortex_test'), false);
    assert.equal(isResettableDatabase('vortex_test_'), false);
    assert.equal(isTestDatabase('vortex_test_'), false);
  });

  test('rejects names that only contain "test" somewhere else', () => {
    for (const name of ['vortex_latest', 'mytest', 'contest', 'vortex_playground_test', 'test_vortex', 'vortex_testing_x']) {
      assert.equal(isResettableDatabase(name), false, name);
    }
  });

  test('rejects suffixes with separators, dots or spaces, and unrelated names', () => {
    for (const name of ['vortex_test_a/b', 'vortex_test_a.b', 'vortex_test_a b', 'vortex_test_a$b', 'other_db', '', undefined, null, 42]) {
      assert.equal(isResettableDatabase(name), false, String(name));
    }
  });
});

describe('testUri(): test database names', () => {
  const withEnv = (value, fn) => {
    const prev = process.env.MONGO_TEST_URI;
    if (value === undefined) delete process.env.MONGO_TEST_URI; else process.env.MONGO_TEST_URI = value;
    try { return fn(); } finally {
      if (prev === undefined) delete process.env.MONGO_TEST_URI; else process.env.MONGO_TEST_URI = prev;
    }
  };

  test('returns null when MONGO_TEST_URI is not set', () => {
    assert.equal(withEnv(undefined, () => testUri('admin')), null);
  });

  test('builds vortex_test_<name> from a vortex_test base', () => {
    const uri = withEnv('mongodb://127.0.0.1:27019/vortex_test', () => testUri('admin'));
    assert.equal(uri, 'mongodb://127.0.0.1:27019/vortex_test_admin');
  });

  test('keeps query options such as replicaSet', () => {
    const uri = withEnv('mongodb://127.0.0.1:27020/vortex_test?replicaSet=rs0', () => testUri('transactions'));
    assert.equal(uri, 'mongodb://127.0.0.1:27020/vortex_test_transactions?replicaSet=rs0');
  });

  test('refuses a base database other than vortex_test, including the original and the playground', () => {
    for (const base of ['mongodb://127.0.0.1:27017/vortex', 'mongodb://127.0.0.1:27017/vortex_playground', 'mongodb://127.0.0.1:27017/mytest']) {
      assert.throws(() => withEnv(base, () => testUri('admin')), /must name the database "vortex_test"/, base);
    }
  });

  test('refuses test names that would produce a disallowed database name', () => {
    for (const name of ['', 'a/b', 'a.b', 'a b']) {
      assert.throws(() => withEnv('mongodb://127.0.0.1:27019/vortex_test', () => testUri(name)), /not allowed/, JSON.stringify(name));
    }
  });

  test('error messages never include the URI', () => {
    try {
      withEnv('mongodb://user:secret@127.0.0.1:27019/vortex', () => testUri('admin'));
      assert.fail('expected testUri to throw');
    } catch (err) {
      assert.equal(err.message.includes('secret'), false);
      assert.equal(err.message.includes('user:'), false);
    }
  });
});
