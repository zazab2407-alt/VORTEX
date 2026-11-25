// One-off, NON-DESTRUCTIVE catalogue sync for the live demo database.
// The seed (npm run seed) wipes products, categories, reviews and demo users, so it must not be used for this.
// This script only:
//   - sets the local demo photo on existing demo products (images field only),
//   - sets the local placeholder image on existing categories (image field only),
//   - inserts products and categories that are missing (matched by slug / name),
// and never deletes, reviews, orders, customers, coupons, or any other record.
//
//   node scripts/sync-catalog-images.mjs            dry run: prints the plan, writes nothing
//   node scripts/sync-catalog-images.mjs --apply    writes, after saving a JSON backup outside the project
import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import { config } from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { Category, Product } from '../src/models/index.js';
import { CATEGORIES, PRODUCTS, demoVariants, productImages, slugOf } from '../src/seed/catalog.js';
import { databaseNameFromUri, SEED_DATABASE } from '../src/seed/databaseGuard.js';

const apply = process.argv.includes('--apply');
const ALLOWED = 'vortex_playground'; // the database the running storefront reads (verified against the live API)
const BACKUP_DIR = 'C:/data/vortex-image-sync-backup';

if (databaseNameFromUri(config.mongoUri) !== ALLOWED) {
  console.error(`Refusing: MONGO_URI must name "${ALLOWED}". Nothing changed.`);
  process.exit(1);
}
await connectDB();
try {
  const name = mongoose.connection.name;
  if (name !== ALLOWED || name === 'vortex') throw new Error(`connected to "${name}", not "${ALLOWED}". Nothing changed.`);

  const [products, categories] = await Promise.all([Product.find({}).lean(), Category.find({}).lean()]);
  const catByName = new Map(categories.map((c) => [c.name, c]));
  const prodBySlug = new Map(products.map((p) => [p.slug, p]));

  const catCreate = CATEGORIES.filter((c) => !catByName.has(c.name));
  const catUpdate = CATEGORIES.filter((c) => catByName.has(c.name) && catByName.get(c.name).image !== c.image);
  const prodCreate = PRODUCTS.filter((d) => !prodBySlug.has(slugOf(d.name)));
  const prodUpdate = PRODUCTS.filter((d) => {
    const p = prodBySlug.get(slugOf(d.name));
    return p && JSON.stringify(p.images) !== JSON.stringify(productImages(d));
  });

  console.log(`Database: ${name}`);
  console.log(`Existing: ${products.length} products, ${categories.length} categories, ${await mongoose.connection.db.collection('reviews').countDocuments()} reviews (untouched)`);
  console.log(`Plan: categories create ${catCreate.length}, update image ${catUpdate.length}`);
  console.log(`Plan: products create ${prodCreate.length}, update images ${prodUpdate.length}`);
  console.log(`      create: ${prodCreate.map((d) => slugOf(d.name)).join(', ') || '-'}`);

  if (!apply) { console.log('\nDRY RUN. Re-run with --apply to write.'); process.exitCode = 0; }
  else {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    const file = path.join(BACKUP_DIR, `before-sync-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    await fs.writeFile(file, JSON.stringify({ database: name, products, categories }, null, 2));
    console.log(`Backup written: ${file}`);

    for (const c of catUpdate) await Category.updateOne({ _id: catByName.get(c.name)._id }, { $set: { image: c.image } });
    for (const c of catCreate) await Category.create({ name: c.name, description: c.description, image: c.image });
    const catIds = new Map((await Category.find({}).lean()).map((c) => [c.name, c._id]));

    for (const d of prodUpdate) {
      await Product.updateOne({ _id: prodBySlug.get(slugOf(d.name))._id }, { $set: { images: productImages(d) } });
    }
    for (const d of prodCreate) {
      const slug = await Product.generateUniqueSlug(d.name);
      await Product.create({
        name: d.name, slug, description: d.description, price: d.price, salePrice: d.salePrice,
        images: productImages(d), category: catIds.get(d.category), gender: d.gender,
        sizes: d.sizes, colors: d.colors, variants: demoVariants(slug, d.sizes, d.colors),
        sold: d.sold, isFeatured: Boolean(d.featured),
        createdAt: new Date(Date.now() - d.daysAgo * 864e5),
      });
    }
    console.log('Applied.');
  }
} catch (err) {
  console.error('Sync failed:', err.message);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
