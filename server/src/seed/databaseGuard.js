// Pure database-name rules for the seed and the test helpers. This file has NO imports, so loading it cannot load
// configuration, models or a database driver, and cannot open a database connection.

/** The only non-test database that may ever be reset by the seed. Exact match, no bypass. */
export const SEED_DATABASE = 'vortex_playground';

/** Test databases are named vortex_test_<suffix>, where the suffix is one or more letters, digits, "_" or "-". */
const TEST_DATABASE = /^vortex_test_[a-z0-9_-]+$/i;

/**
 * Returns the database name from a mongodb:// or mongodb+srv:// URI, or '' when none can be read.
 * Only the path part is read, so credentials and hosts are never returned.
 * Fails closed: if a raw "/" appears in the credentials, the result will not match SEED_DATABASE.
 */
export function databaseNameFromUri(uri) {
  const match = /^mongodb(?:\+srv)?:\/\/[^/]*\/([^?]+)/.exec(String(uri ?? ''));
  return match ? match[1] : '';
}

/** True only when the URI's database name is exactly SEED_DATABASE. */
export function isSeedDatabase(uri) {
  return databaseNameFromUri(uri) === SEED_DATABASE;
}

/** True only for a test database: "vortex_test_" followed by a non-empty suffix. "vortex_test" alone is refused. */
export function isTestDatabase(name) {
  return typeof name === 'string' && TEST_DATABASE.test(name);
}

/**
 * True only for databases that a reset may touch: the playground, or a test database.
 * The original "vortex" database, anything else, and a missing name are all refused.
 */
export function isResettableDatabase(name) {
  return name === SEED_DATABASE || isTestDatabase(name);
}
