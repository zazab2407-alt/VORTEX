// Admin operations: dashboard stats, admin lists, secure image uploads, createAdmin script.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { testUri, makeCall, login } from './helpers.mjs';

const uri = testUri('admin');
const skip = !uri && 'set MONGO_TEST_URI to run database tests';
process.env.MONGO_URI = uri || 'mongodb://127.0.0.1:1/unused';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123';
process.env.NODE_ENV = 'test';
process.env.UPLOADS_DIR = path.join(os.tmpdir(), `vortex-test-uploads-${process.pid}`); // never write into the project folder

const { default: mongoose } = await import('mongoose');
const { default: app } = await import('../src/app.js');
const { config } = await import('../src/config/env.js');
const { User, Product, Category, Order } = await import('../src/models/index.js');
const { seedCatalog } = await import('../src/seed/seed.js');
const run = promisify(execFile);

describe('Admin operations', { skip }, () => {
  let server, base, call, admin, customer;
  const mkOrder = (user, total, status = 'pending', n = 1) => Order.create({ user: user?._id, status, customer: { fullName: 'N', email: 'n@x.test', phone: '1' }, shippingAddress: { address: 'a', city: 'c' },
    items: [{ product: new mongoose.Types.ObjectId(), name: 'Thing', size: 'M', color: 'Black', unitPrice: total / n, quantity: n, lineTotal: total }], subtotal: total, total });

  before(async () => {
    await mongoose.connect(uri); await mongoose.connection.dropDatabase(); await Promise.all([User, Product, Category, Order].map((m) => m.init()));
    await seedCatalog();
    await new Promise((r) => { server = app.listen(0, r); });
    base = `http://127.0.0.1:${server.address().port}`; call = makeCall(`${base}/api`);
    await User.create({ name: 'Admin', email: 'admin@x.test', password: 'admin-password-1', role: 'admin' });
    const c1 = await User.create({ name: 'Cust One', email: 'c1@x.test', password: 'password-12345' }); await User.create({ name: 'Cust Two', email: 'c2@x.test', password: 'password-12345' });
    admin = await login(call, 'admin@x.test', 'admin-password-1'); customer = await login(call, 'c1@x.test', 'password-12345');
    await mkOrder(c1, 100); await mkOrder(c1, 50.5, 'shipped'); await mkOrder(null, 999, 'cancelled');
  });
  after(async () => {
    server.close(); await mongoose.connection.dropDatabase(); await mongoose.disconnect();
    // Windows cannot delete a file that is still open. sharp(<path>) in the upload tests leaves libvips holding an uploaded WebP open
    // in its file cache, so release those handles first. maxRetries covers brief antivirus/indexer locks on freshly written files.
    sharp.cache(false);
    await fs.rm(process.env.UPLOADS_DIR, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });

  describe('dashboard stats', () => {
    test('totals: orders, revenue (cancelled excluded), products, customers (demo reviewers and admins excluded)', async () => {
      const r = await call('GET', '/admin/stats', { cookie: admin });
      assert.equal(r.status, 200);
      assert.deepEqual(r.body.data.totals, { orders: 3, revenue: 150.5, products: 16, customers: 2, pendingOrders: 1 });
    });
    test('recent orders newest first; best sellers by units sold', async () => {
      const d = (await call('GET', '/admin/stats', { cookie: admin })).body.data;
      assert.equal(d.recentOrders.length, 3); assert.equal(d.recentOrders[0].status, 'cancelled');
      assert.deepEqual(d.bestSellers.map((p) => p.name).slice(0, 2), ['Flux High-Waist Leggings', 'Aura Seamless Sports Bra']);
      assert.equal(d.bestSellers.length, 5); assert.ok(d.bestSellers[0].sold >= d.bestSellers[1].sold);
    });
  });

  describe('admin lists', () => {
    test('products include hidden ones, and support the shop filters and paging', async () => {
      const cap = await Product.findOne({ slug: 'vortex-pro-cap' }); await Product.updateOne({ _id: cap._id }, { isActive: false });
      const all = await call('GET', '/admin/products?limit=50', { cookie: admin });
      assert.equal(all.body.meta.total, 16); assert.equal(all.body.data.find((p) => p.slug === 'vortex-pro-cap').isActive, false);
      assert.equal((await call('GET', '/products?limit=50')).body.meta.total, 15, 'the public shop hides it');
      assert.equal((await call('GET', '/admin/products?q=cap', { cookie: admin })).body.data[0].slug, 'vortex-pro-cap');
      assert.equal((await call('GET', '/admin/products?limit=5&page=4', { cookie: admin })).body.data.length, 1);
      assert.equal((await call('GET', '/admin/products?sort=nope', { cookie: admin })).status, 400);
      await Product.updateOne({ _id: cap._id }, { isActive: true });
    });
    test('categories include hidden ones, with product counts', async () => {
      await Category.create({ name: 'Hidden Cat', isActive: false });
      const r = await call('GET', '/admin/categories', { cookie: admin });
      assert.equal(r.body.data.length, 6); assert.equal(r.body.data.find((c) => c.name === 'Hidden Cat').isActive, false);
      assert.equal((await call('GET', '/categories')).body.data.length, 5, 'public list still hides it');
    });
  });

  describe('secure image uploads', () => {
    const png = (w = 40, h = 30) => sharp({ create: { width: w, height: h, channels: 3, background: '#ff5a1f' } }).png().toBuffer();
    const upload = (buf, { name = 'photo.png', type = 'image/png', field = 'image', cookie = admin } = {}) => {
      const form = new FormData(); form.append(field, new Blob([buf], { type }), name);
      return call('POST', '/admin/uploads', { form, cookie });
    };
    const onDisk = (url) => path.join(config.uploadsDir, 'products', path.basename(url));
    const exists = (url) => fs.access(onDisk(url)).then(() => true, () => false);

    test('accepts PNG, JPEG and WebP; stores a re-encoded WebP under a random name', async () => {
      for (const [make, name, type] of [[(s) => s.png(), 'a.png', 'image/png'], [(s) => s.jpeg(), 'b.jpg', 'image/jpeg'], [(s) => s.webp(), 'c.webp', 'image/webp']]) {
        const buf = await make(sharp({ create: { width: 64, height: 48, channels: 3, background: '#123456' } })).toBuffer();
        const r = await upload(buf, { name, type });
        assert.equal(r.status, 201, name); assert.match(r.body.data.url, /^\/uploads\/products\/[a-f0-9]{32}\.webp$/);
        assert.deepEqual([r.body.data.width, r.body.data.height], [64, 48]); assert.ok(await exists(r.body.data.url));
        assert.equal((await sharp(onDisk(r.body.data.url)).metadata()).format, 'webp', 'really re-encoded');
      }
    });
    test('uploaded files are served as images with nosniff', async () => {
      const { url } = (await upload(await png())).body.data;
      const res = await fetch(base + url);
      assert.equal(res.status, 200); assert.equal(res.headers.get('content-type'), 'image/webp'); assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      assert.equal((await fetch(base + '/uploads/products/')).status, 404, 'no directory listing');
    });
    test('large images are scaled down; metadata (EXIF) is stripped', async () => {
      const big = await sharp({ create: { width: 3000, height: 3000, channels: 3, background: '#000' } }).jpeg().withExif({ IFD0: { Copyright: 'SECRET-CAMERA-OWNER' } }).toBuffer();
      assert.ok((await sharp(big).metadata()).exif, 'precondition: the source has EXIF');
      const { url, width, height } = (await upload(big, { name: 'big.jpg', type: 'image/jpeg' })).body.data;
      assert.deepEqual([width, height], [1600, 1600]);
      assert.equal((await sharp(onDisk(url)).metadata()).exif, undefined);
      assert.ok(!(await fs.readFile(onDisk(url))).includes('SECRET-CAMERA-OWNER'));
    });
    test('rejects files that merely LOOK like images (renamed text / HTML / scripts)', async () => {
      for (const [content, name, type] of [['just some text', 'x.png', 'image/png'], ['<html><script>alert(1)</script></html>', 'x.jpg', 'image/jpeg'], ['<?php system($_GET["c"]); ?>', 'shell.png', 'image/png'], ['', 'empty.png', 'image/png']]) {
        const r = await upload(Buffer.from(content), { name, type }); assert.equal(r.status, 400, name); assert.match(r.body.message, /not a valid image|Choose an image/);
      }
    });
    test('rejects SVG (script-capable) and GIF even when sent as image/png', async () => {
      const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>');
      const r1 = await upload(svg, { name: 'x.png', type: 'image/png' }); assert.equal(r1.status, 400); assert.match(r1.body.message, /Only JPEG, PNG and WebP/);
      const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } }).gif().toBuffer();
      assert.equal((await upload(gif, { name: 'x.gif', type: 'image/gif' })).status, 400);
    });
    test('rejects oversized files (>5 MB) and decompression bombs', async () => {
      const r = await upload(Buffer.alloc(6 * 1024 * 1024, 1)); assert.equal(r.status, 400); assert.match(r.body.message, /too large/);
      const bomb = await sharp({ create: { width: 7000, height: 7000, channels: 3, background: '#000' } }).png({ compressionLevel: 9 }).toBuffer();
      assert.ok(bomb.length < 5 * 1024 * 1024, 'precondition: small on the wire');
      assert.equal((await upload(bomb)).status, 400);
    });
    test('requires the "image" field and a single file', async () => {
      assert.equal((await call('POST', '/admin/uploads', { cookie: admin })).status, 400);
      assert.equal((await upload(await png(), { field: 'file' })).status, 400);
      const form = new FormData(); form.append('image', new Blob([await png()], { type: 'image/png' }), 'a.png'); form.append('image', new Blob([await png()], { type: 'image/png' }), 'b.png');
      assert.equal((await call('POST', '/admin/uploads', { form, cookie: admin })).status, 400);
    });
    test('a hostile filename never reaches the filesystem', async () => {
      const r = await upload(await png(), { name: '../../../../etc/passwd.png' });
      assert.equal(r.status, 201); assert.match(r.body.data.url, /^\/uploads\/products\/[a-f0-9]{32}\.webp$/);
      assert.equal(await fs.access(path.join(config.uploadsDir, '..', 'passwd.png')).then(() => true, () => false), false);
    });
    test('customers and anonymous visitors cannot upload', async () => {
      assert.equal((await upload(await png(), { cookie: customer })).status, 403);
      assert.equal((await upload(await png(), { cookie: null })).status, 401);
    });
    test('files are removed when no product uses them any more (but never while shared)', async () => {
      const cat = (await Category.findOne({ slug: 'tops' }))._id;
      const a = (await upload(await png())).body.data.url; const b = (await upload(await png(50, 50))).body.data.url;
      const make = (name, images) => call('POST', '/products', { cookie: admin, body: { name, description: 'Test product here.', price: 10, images, category: String(cat), gender: 'men', sizes: ['M'], colors: [{ name: 'Black', hex: '#000000' }] } });
      const p1 = (await make('Upload Test One', [a, b])).body.data; const p2 = (await make('Upload Test Two', [a])).body.data;
      await call('PATCH', `/products/${p1.id}`, { cookie: admin, body: { images: [b] } });
      assert.ok(await exists(a), 'still used by product two'); assert.ok(await exists(b));
      await call('DELETE', `/products/${p2.id}`, { cookie: admin });
      assert.equal(await exists(a), false, 'now unused, deleted');
      await call('DELETE', `/products/${p1.id}`, { cookie: admin });
      assert.equal(await exists(b), false);
    });
  });

  describe('createAdmin script', () => {
    const env = (over) => ({ ...process.env, MONGO_URI: uri, JWT_SECRET: process.env.JWT_SECRET, ...over });
    const script = path.resolve('src/seed/createAdmin.js');
    const exec = (over) => run('node', [script], { env: env(over), cwd: path.resolve('.') }).then((r) => ({ code: 0, out: r.stdout }), (e) => ({ code: e.code, out: e.stdout + e.stderr }));

    test('creates an admin who can really log in', async () => {
      const r = await exec({ ADMIN_EMAIL: 'Owner@Shop.test', ADMIN_NAME: 'Shop Owner', ADMIN_PASSWORD: 'a-strong-password-1' });
      assert.equal(r.code, 0, r.out); assert.match(r.out, /Admin account created/);
      const cookie = await login(call, 'owner@shop.test', 'a-strong-password-1');
      assert.equal((await call('GET', '/admin/stats', { cookie })).status, 200);
    });
    test('running it again changes nothing', async () => {
      const r = await exec({ ADMIN_EMAIL: 'owner@shop.test', ADMIN_PASSWORD: 'a-different-password-2' });
      assert.equal(r.code, 0); assert.match(r.out, /already an admin/);
      assert.equal((await call('POST', '/auth/login', { body: { email: 'owner@shop.test', password: 'a-different-password-2' } })).status, 401, 'password not overwritten');
    });
    test('promotes an existing customer without touching their password', async () => {
      const r = await exec({ ADMIN_EMAIL: 'c2@x.test' });
      assert.equal(r.code, 0, r.out); assert.match(r.out, /promoted to admin/);
      assert.equal((await User.findOne({ email: 'c2@x.test' })).role, 'admin');
      assert.equal((await call('POST', '/auth/login', { body: { email: 'c2@x.test', password: 'password-12345' } })).status, 200);
    });
    test('refuses weak passwords and invalid emails', async () => {
      let r = await exec({ ADMIN_EMAIL: 'weak@shop.test', ADMIN_PASSWORD: 'short' }); assert.equal(r.code, 1); assert.match(r.out, /at least 10 characters/);
      r = await exec({ ADMIN_EMAIL: 'not-an-email', ADMIN_PASSWORD: 'long-enough-password' }); assert.equal(r.code, 1); assert.match(r.out, /valid --email/);
      assert.equal(await User.countDocuments({ email: 'weak@shop.test' }), 0);
    });
  });
});
