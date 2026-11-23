import mongoose from 'mongoose';
import { config } from './env.js';
import { transactionsSupported } from '../utils/transaction.js';

mongoose.set('strictQuery', true);

/**
 * Works with a local MongoDB and with MongoDB Atlas (mongodb+srv://...). For Atlas, put the full connection string in MONGO_URI;
 * keep retryWrites=true&w=majority (Atlas adds them by default). The URI is never logged because it contains the password.
 */
export async function connectDB() {
  mongoose.connection.on('disconnected', () => console.warn('[db] MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => console.log('[db] MongoDB reconnected'));
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 8000, maxPoolSize: config.mongo.maxPoolSize });
  console.log(`[db] Connected to MongoDB (${mongoose.connection.name})`);

  if (await transactionsSupported()) console.log('[db] Transactions available: checkout and order cancellation are atomic.');
  else if (config.mongo.transactions === 'off') console.log('[db] Transactions disabled by MONGO_TRANSACTIONS=off: using compensating rollbacks.');
  else console.warn(`[db] Standalone MongoDB detected (no transactions): checkout and cancellation use compensating rollbacks.${config.isProd ? ' For production use a replica set such as MongoDB Atlas.' : ''}`);
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
