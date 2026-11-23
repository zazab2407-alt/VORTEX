import { isResettableDatabase, isTestDatabase } from '../src/seed/databaseGuard.js';

// Each DB test file gets its own database. MONGO_TEST_URI must name the database "vortex_test"; each test file's
// database is "vortex_test_<name>". Anything else is refused, so a test run can never reach "vortex".
export function testUri(name) {
  const base = process.env.MONGO_TEST_URI;
  if (!base) return null;
  const u = new URL(base);
  const baseDb = u.pathname.replace(/^\/+|\/+$/g, '') || 'vortex_test';
  if (baseDb !== 'vortex_test') {
    throw new Error(`MONGO_TEST_URI must name the database "vortex_test" (found "${baseDb}"). Each test file adds its own suffix.`);
  }
  const db = `vortex_test_${name}`;
  if (!isTestDatabase(db)) throw new Error(`Test database name "${db}" is not allowed (use letters, digits, "-" or "_" in the test name)`);
  u.pathname = `/${db}`;
  return u.toString();
}

/** Minimal HTTP client for the API under test. Pass { cookie } to act as a logged-in user. */
export function makeCall(base) {
  return async function call(method, path, { body, cookie, form, csrf = true, headers = {} } = {}) {
    const h = { ...headers };
    if (csrf) h['x-requested-with'] = 'vortex-web';
    if (cookie) h.cookie = cookie;
    let payload;
    if (form) payload = form;
    else if (body !== undefined && !['GET', 'HEAD'].includes(method)) { h['content-type'] = 'application/json'; payload = JSON.stringify(body); }
    const res = await fetch(base + path, { method, headers: h, body: payload });
    let json = null;
    try { json = await res.json(); } catch { /* not json */ }
    const setCookie = res.headers.getSetCookie?.() ?? [];
    const cookieVal = setCookie.map((c) => c.split(';')[0]).find((c) => c.startsWith('vortex_token='));
    return { status: res.status, body: json, setCookie, cookie: cookieVal, headers: res.headers };
  };
}

export async function login(call, email, password) {
  const r = await call('POST', '/auth/login', { body: { email, password } });
  if (r.status !== 200) throw new Error(`login failed for ${email}: ${r.status} ${JSON.stringify(r.body)}`);
  return r.cookie;
}

/**
 * Boots the real app against a throwaway database seeded with the demo catalogue, with an admin and two customers logged in.
 * Returns null when MONGO_TEST_URI is not set (DB suites skip themselves).
 */
export async function setupApi(name, { seed = true } = {}) {
  const uri = testUri(name);
  if (!uri) return null;
  process.env.MONGO_URI = uri;
  process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123';
  process.env.NODE_ENV = process.env.TEST_NODE_ENV || 'test';
  process.env.CLIENT_URL = 'http://localhost:5173';
  const { default: mongoose } = await import('mongoose');
  const { default: app } = await import('../src/app.js');
  const models = await import('../src/models/index.js');
  const { seedCatalog } = await import('../src/seed/seed.js');
  await mongoose.connect(uri);
  // Safety: refuse before dropping anything unless the connected database is a test database.
  if (!isResettableDatabase(mongoose.connection.name)) {
    await mongoose.disconnect();
    throw new Error(`Refusing to reset database "${mongoose.connection.name}": not a test database. Nothing was changed.`);
  }
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(models).map((m) => m.init()));
  if (seed) await seedCatalog();
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const call = makeCall(`http://127.0.0.1:${server.address().port}/api`);
  const mk = (email, name, role = 'customer') => models.User.create({ name, email, password: 'password-12345', role });
  const [admin, alice, bob] = await Promise.all([mk('admin@x.test', 'Admin Amy', 'admin'), mk('alice@x.test', 'Alice Adams'), mk('bob@x.test', 'Bob Brown')]);
  const [adminCookie, aliceCookie, bobCookie] = await Promise.all([login(call, 'admin@x.test', 'password-12345'), login(call, 'alice@x.test', 'password-12345'), login(call, 'bob@x.test', 'password-12345')]);
  const stockOf = async (slug, size, color) => (await models.Product.findOne({ slug })).getStock(size, color);
  const product = (slug) => models.Product.findOne({ slug });
  /** Checkout payload for one or more lines; override any field (including invalid ones) via `over`. */
  const orderBody = (items, over = {}) => ({
    items, customer: { fullName: 'Guest Buyer', email: 'Guest@Example.com', phone: '+20 100 123 4567' },
    shippingAddress: { address: '12 Nile Corniche, Maadi', city: 'Cairo' }, ...over,
  });
  const line = async (slug, size, color, quantity = 1) => ({ productId: String((await product(slug))._id), size, color, quantity });
  return {
    mongoose, models, call, adminCookie, aliceCookie, bobCookie, users: { admin, alice, bob }, stockOf, product, orderBody, line,
    async close() { await new Promise((r) => server.close(r)); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); },
  };
}
