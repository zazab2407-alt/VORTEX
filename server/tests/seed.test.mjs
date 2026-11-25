import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { testUri } from './helpers.mjs';
import { LOCAL_IMAGE, PLACEHOLDER_IMAGE } from '../src/seed/imagePaths.js';
import demoImages from '../src/seed/demoImages.json' with { type: 'json' };

// Licences accepted for demo photos (all permit commercial use). Share-alike and non-commercial licences are excluded.
const ALLOWED_LICENCES = new Set(['CC0', 'CC BY 2.0', 'CC BY 4.0', 'Public domain']);
const publicPath = (p) => path.join(fileURLToPath(new URL('../../client/public', import.meta.url)), p);


const uri = testUri('seed');
const skip = !uri && 'set MONGO_TEST_URI to run database tests';
process.env.MONGO_URI = uri || 'mongodb://127.0.0.1:1/unused';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123';

const { default: mongoose } = await import('mongoose');
const { User, Category, Product, Review, Coupon } = await import('../src/models/index.js');
const { seedCatalog } = await import('../src/seed/seed.js');

describe('Seed script', { skip }, () => {
  before(async () => { await mongoose.connect(uri); await mongoose.connection.dropDatabase(); await Promise.all([User, Category, Product, Review, Coupon].map((m) => m.init())); });
  after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });

  test('creates 8 categories, 40 valid products and 2 coupons, and NO reviews', async () => {
    const summary = await seedCatalog();
    assert.deepEqual([summary.categories, summary.products, summary.coupons, summary.reviews], [8, 40, 2, 0]);
    assert.equal(await Category.countDocuments(), 8); assert.equal(await Product.countDocuments(), 40); assert.equal(await Coupon.countDocuments(), 2);
    assert.equal(await Review.countDocuments(), 0, 'no fabricated reviews are seeded');
    for (const p of await Product.find()) await p.validate(); // every seeded product passes the schema rules
  });
  test('variants: one stock row per size x colour; mix of healthy, low and sold-out; every product sellable', async () => {
    const all = await Product.find(); let zero = 0, low = 0;
    for (const p of all) {
      assert.equal(p.variants.length, p.sizes.length * p.colors.length, p.name);
      assert.ok(p.totalStock > 0, `${p.name} must have something in stock`);
      for (const v of p.variants) { if (v.stock === 0) zero++; else if (v.stock <= 3) low++; }
    }
    assert.ok(zero > 0 && low > 0, `demo data should include sold-out (${zero}) and low-stock (${low}) variants`);
  });
  test('catalogue mix: 7 best sellers, 8 on sale, 9 new arrivals, 3 genders', async () => {
    const all = await Product.find();
    assert.equal(all.filter((p) => p.isFeatured).length, 7); assert.equal(all.filter((p) => p.salePrice != null).length, 8); assert.equal(all.filter((p) => p.isNewArrival).length, 9);
    assert.deepEqual([...new Set(all.map((p) => p.gender))].sort(), ['men', 'unisex', 'women']);
    assert.ok(all.every((p) => p.effectivePrice === (p.salePrice ?? p.price)));
  });
  test('every product has exactly one local demo photo that is a valid path and exists on disk', async () => {
    const all = await Product.find();
    assert.equal(all.length, 40);
    for (const p of all) {
      assert.equal(p.images.length, 1, `${p.name} should have one demo photo`);
      const [img] = p.images;
      assert.match(img, LOCAL_IMAGE, `${p.name}: ${img} is not a local demo image path`);
      assert.ok(!/^https?:/i.test(img) && !img.includes('unsplash'), `${p.name} must not hotlink external photos`);
      assert.ok(fs.existsSync(publicPath(img)), `${p.name}: file missing: ${img}`);
    }
  });
  test('demo photos are assigned without unintended duplicates across all 40 products', async () => {
    const all = await Product.find();
    const assigned = all.map((p) => p.images[0]);
    assert.equal(new Set(assigned).size, assigned.length, 'two products share one photo');
  });
  test('every product photo has a complete licence record (source, photographer, licence, licence URL)', async () => {
    const records = new Map(demoImages.records.map((r) => [r.file, r]));
    const all = await Product.find();
    for (const p of all) {
      const r = records.get(p.images[0]);
      assert.ok(r, `${p.name}: ${p.images[0]} has no licence record in demoImages.json`);
      assert.ok(ALLOWED_LICENCES.has(r.licence), `${p.name}: licence "${r.licence}" is not permitted`);
      assert.ok(r.artist && r.sourcePage && r.licenceUrl, `${p.name}: incomplete licence record`);
    }
  });
  test('storefront and category images are local, exist, and are licensed or generated placeholders', async () => {
    const categories = await Category.find();
    assert.equal(categories.length, 8);
    for (const c of categories) {
      assert.match(c.image, LOCAL_IMAGE, `${c.name}: ${c.image} is not local`);
      assert.ok(fs.existsSync(publicPath(c.image)), `${c.name}: missing ${c.image}`);
    }
    assert.ok(fs.existsSync(publicPath(PLACEHOLDER_IMAGE)), 'the generated placeholder must exist');
    for (const f of ['/images/site/hero.webp', '/images/site/men-banner.webp', '/images/site/women-banner.webp', '/images/site/promo.webp', ...[1, 2, 3, 4, 5, 6].map((n) => `/images/site/gallery-${n}.webp`)]) {
      assert.ok(fs.existsSync(publicPath(f)), `missing storefront image ${f}`);
      assert.ok(demoImages.records.some((r) => r.file === f), `${f} has no licence record`);
    }
  });
  test('the old Unsplash images are gone from the active catalogue data', async () => {
    const all = await Product.find();
    assert.ok(all.every((p) => p.images.every((u) => !u.includes('unsplash'))), 'an active product still uses an old Unsplash image');
    const cats = await Category.find();
    assert.ok(cats.every((c) => !String(c.image).includes('unsplash')), 'a category still uses an old Unsplash image');
    assert.ok(!demoImages.records.some((r) => /unsplash/i.test(r.file)), 'a storefront image is an Unsplash URL');
  });
  test('the demo image catalogue is complete and sourced', async () => {
    const { PHOTO_BY_SLUG } = await import('../src/seed/demoPhotos.js');
    const { PRODUCTS, slugOf } = await import('../src/seed/catalog.js');
    assert.equal(PRODUCTS.every((d) => PHOTO_BY_SLUG[slugOf(d.name)]), true, 'every product has a photo assignment');
    const photoFiles = demoImages.records.filter((r) => r.kind === 'product-photo');
    assert.equal(photoFiles.length, 46, 'photo-01..46 are all recorded');
    for (const photo of new Set(Object.values(PHOTO_BY_SLUG))) assert.ok(photoFiles.some((r) => r.photo === photo), `${photo} has no licence record`);
    assert.equal(demoImages.records.filter((r) => r.kind === 'site').length, 10);
    for (const r of demoImages.records) assert.ok(ALLOWED_LICENCES.has(r.licence) && r.sourcePage.startsWith('https://commons.wikimedia.org/'), `${r.file} source/licence`);
  });

  test('seeded products have no rating and no review count', async () => {
    for (const p of await Product.find()) { assert.equal(p.reviewCount, 0, p.name); assert.equal(p.rating, 0, p.name); }
  });
  test('demo reviewer accounts are NOT created', async () => {
    assert.equal(await User.countDocuments({ email: /@demo\.vortex\.test$/ }), 0);
  });
  test('re-running is idempotent and never touches real customers', async () => {
    const real = await User.create({ name: 'Real Customer', email: 'real@example.com', password: 'a-long-password-1' });
    await seedCatalog(); await seedCatalog();
    assert.equal(await Product.countDocuments(), 40); assert.equal(await Category.countDocuments(), 8); assert.equal(await Coupon.countDocuments(), 2);
    assert.equal(await User.countDocuments({ email: /@demo\.vortex\.test$/ }), 0);
    assert.ok(await User.findById(real._id), 'real customer survived reseeding');
  });
});
