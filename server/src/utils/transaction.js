import mongoose from 'mongoose';
import { config } from '../config/env.js';

// MongoDB transactions need a replica set (MongoDB Atlas always is one) or a sharded cluster.
// A plain standalone `mongod` rejects them, so we detect support once per connection and fall back to the
// compensating rollbacks the services already implement.
let cache = { db: null, supported: null };

async function detect() {
  if (config.mongo.transactions === 'off') return false;
  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    return Boolean(hello.setName) || hello.msg === 'isdbgrid';
  } catch { return false; }
}

export async function transactionsSupported() {
  const db = mongoose.connection.db;
  if (!db) return false; // not connected yet: nothing to detect, and nothing to cache
  if (cache.db !== db) cache = { db, supported: detect() };
  return cache.supported;
}

export const resetTransactionSupport = () => { cache = { db: null, supported: null }; };

const unsupported = (err) => err?.code === 20 && /Transaction numbers are only allowed|replica set|mongos/i.test(err.message ?? '');

/**
 * Runs `work(session)` atomically when transactions are available: either every write inside commits, or none does,
 * even if the process dies halfway. Transient conflicts (two shoppers touching the same product) are retried by the driver.
 * On a standalone server `work(null)` runs without a session, so `work` must clean up after itself in that case.
 * `work` can run more than once (retries), so it must only touch its own local state.
 */
export async function runInTransaction(work) {
  if (!(await transactionsSupported())) return work(null);
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await work(session); }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' });
    return result;
  } catch (err) {
    if (!unsupported(err)) throw err;
    cache = { db: mongoose.connection.db, supported: Promise.resolve(false) }; // detection was wrong; stop trying
    console.warn('[db] Transactions are not supported by this server; falling back to compensating rollbacks.');
    return work(null);
  } finally {
    await session.endSession();
  }
}
