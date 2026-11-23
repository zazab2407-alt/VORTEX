import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { Category, Coupon, Product, Review, User } from '../models/index.js';
import { CATEGORIES, COUPONS, PRODUCTS, demoVariants, productImages } from './catalog.js';
import { SEED_DATABASE, databaseNameFromUri, isSeedDatabase, isResettableDatabase } from './databaseGuard.js';

// The guard helpers live in databaseGuard.js. They are re-exported here so existing imports keep working.
export { SEED_DATABASE, databaseNameFromUri, isSeedDatabase };

const DEMO_EMAIL = /@demo\.vortex\.test$/;

/**
 * Resets the demo catalogue: categories, products, demo coupons and any demo reviewer accounts left by older seeds.
 * No reviews or ratings are created: the shop must not show fabricated customer feedback.
 * Customers, admins and orders are never touched. Safe to run repeatedly.
 */
export async function seedCatalog({ log = () => {} } = {}) {
  // Refuse before ANY delete unless the connected database is the playground or a test database (vortex_test_<name>).
  // A refusal changes nothing. The original "vortex" database is never allowed here.
  const dbName = mongoose.connection.name;
  if (!isResettableDatabase(dbName)) {
    throw new Error(`Refusing to reset the catalogue in "${dbName || 'no database'}": only ${SEED_DATABASE} or vortex_test_<name> may be reset. Nothing was changed.`);
  }
  await Review.deleteMany({});
  await Product.deleteMany({});
  await Category.deleteMany({});
  await User.deleteMany({ email: DEMO_EMAIL });
  await Coupon.deleteMany({ code: { $in: COUPONS.map((c) => c.code) } });

  const categories = new Map();
  for (const c of CATEGORIES) categories.set(c.name, await Category.create(c)); // create() so slug hooks run
  log(`  categories: ${categories.size}`);

  for (const def of PRODUCTS) {
    const slug = await Product.generateUniqueSlug(def.name);
    await Product.create({
      name: def.name, slug, description: def.description, price: def.price, salePrice: def.salePrice,
      images: productImages(def), category: categories.get(def.category)._id, gender: def.gender,
      sizes: def.sizes, colors: def.colors, variants: demoVariants(slug, def.sizes, def.colors),
      sold: def.sold, isFeatured: Boolean(def.featured),
      createdAt: new Date(Date.now() - def.daysAgo * 864e5),
    });
  }
  log(`  products: ${PRODUCTS.length}, reviews: 0`);

  for (const c of COUPONS) await Coupon.create(c);
  log(`  coupons: ${COUPONS.map((c) => c.code).join(', ')}`);
  return { categories: categories.size, products: PRODUCTS.length, reviews: 0, coupons: COUPONS.length };
}

// CLI:  npm run seed
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { config } = await import('../config/env.js');
  const { connectDB, disconnectDB } = await import('../config/db.js');
  if (config.isProd && !process.argv.includes('--force')) {
    console.error('Refusing to reseed in production: this replaces the whole catalogue. Re-run with --force if you really mean it.');
    process.exit(1);
  }
  // Database guard, check 1 of 2: refuse before connecting. There is no flag or environment variable that bypasses this.
  const dbName = databaseNameFromUri(config.mongoUri);
  if (dbName !== SEED_DATABASE) {
    console.error(`Refusing to seed: MONGO_URI must name the database "${SEED_DATABASE}" (found "${dbName || 'none'}"). Nothing was changed. The URI is not printed because it contains credentials.`);
    process.exit(1);
  }
  try {
    await connectDB();
    // Database guard, check 2 of 2: confirm the live connection before anything is deleted.
    if (mongoose.connection.name !== SEED_DATABASE) {
      throw new Error(`connected to "${mongoose.connection.name}", not "${SEED_DATABASE}". Nothing was changed.`);
    }
    console.log('Seeding demo catalogue...');
    await seedCatalog({ log: console.log });
    console.log('Done.');
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}
