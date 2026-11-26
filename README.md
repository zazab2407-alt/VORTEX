# VORTEX

VORTEX is a sportswear e-commerce store: a React storefront and admin area, backed by an Express API and MongoDB.
Payments are **Cash on Delivery only**. There are no online payments.

> **Status:** Phase 7 is partly complete and has not been fully verified. See `PHASE7_HANDOFF.md` and `VORTEX_PROGRESS.md`
> for the exact state, test results and open items. This README does not claim that the project is production-ready.

## Technology

| Part | Stack |
|---|---|
| Client (`client/`) | React 18, TypeScript, Vite 5, Tailwind CSS 3, react-router-dom 7.18.6, lucide-react |
| Server (`server/`) | Node.js (ES modules), Express 4, MongoDB with Mongoose 8, express-validator, helmet, express-rate-limit, multer + sharp (uploads re-encoded to WebP), nodemailer, cloudinary (optional config) |
| Auth | JWT in an httpOnly cookie `vortex_token`; passwords hashed with bcryptjs (12 rounds); `tokenVersion` invalidates old sessions after a password change |

## Folder structure

```
client/                 React storefront and admin (Vite)
  src/App.tsx, src/main.tsx
  src/components  context  data  hooks  pages  pages/admin  services  types  utils
  scripts/check-images.mjs
  tests/safeNext.test.mjs  client automated tests (npm test)
server/                 Express API
  src/index.js, src/app.js
  src/config  controllers  middleware  models  routes  seed  services  utils  validators
  scripts/fetch-images.mjs (retired, do not run), scripts/sync-catalog-images.mjs
  tests/*.test.mjs      automated tests (plus helpers.mjs)
PHASE7_HANDOFF.md       Phase 7 handoff report
VORTEX_PROGRESS.md      project progress log
VORTEX_COMPLETE_AUDIT.md  audit report
handoff/                CHANGELOG.md and handoff notes for the next session
```

## Requirements

- Node.js 20 or newer is the recommended version, taken from the project handoff (`handoff/VORTEX_NEW_CHAT_HANDOFF.md`, section 4). It is not an enforced project requirement: neither `package.json` declares an `engines` field, and there is no `.nvmrc`. The handoff records testing on Node.js v26.13.0.
- MongoDB. A local standalone instance is enough for most work. Transaction tests need a **replica set** (see below).
- Windows PowerShell commands are shown below. Other shells work with the equivalent commands.

## Server setup

```powershell
cd server
npm install
Copy-Item .env.example .env      # then edit .env on your own machine; never commit it
npm run dev                      # API with file watching
# or
npm start
```

Edit `.env` locally. `server/.env.example` lists every variable with a placeholder value and a comment. Required values include
`JWT_SECRET` (at least 32 characters) and `MONGO_URI`. Never paste real values into documentation, chat, or commits.

**Important:** the example file sets `MONGO_URI` to the database `vortex`. Change it to a development database before you seed
(see "Seeding the demo catalogue" below). The seed will refuse to run against `vortex`.

### Environment variables (names only)

The full, commented list is in `server/.env.example`. Variables used by the store settings include:

- Store: `STORE_NAME`, `CURRENCY` (default `USD`), `CURRENCY_LOCALE`, `SHIPPING_FLAT_RATE`, `FREE_SHIPPING_THRESHOLD`, `PROMO_CODE`
- Public contact: `STORE_EMAIL`, `STORE_PHONE`, `STORE_ADDRESS`, `RETURN_WINDOW_DAYS`
- Contact form: `CONTACT_TO` (also requires working SMTP settings)
- Database: `MONGO_URI`, `MONGO_TRANSACTIONS` (`auto` or `off`), `MONGO_MAX_POOL_SIZE`
- Auth and cookies: `JWT_SECRET`, `COOKIE_SAMESITE`, `CLIENT_URL`
- Email: `SMTP_*` variables and `MAIL_FROM`
- Images: `UPLOADS_DIR`; optional `CLOUDINARY_*`

If an invalid store setting is present, the server refuses to start and prints a message that names the setting.
If SMTP or `CONTACT_TO` is missing, order confirmation emails are not sent and the contact form tells visitors that it is unavailable.

## Client setup

```powershell
cd client
npm install
npm run dev                      # http://localhost:5173 (Vite proxies /api to the server)
```

The client reads store settings from `GET /api/cart/config`. It needs no secrets. The client reads an optional `VITE_API_URL` variable, which is only needed when the API is not reached through the Vite proxy. Check `client/.env.example` for the exact name before creating a local `.env`.

## Database

### Local standalone MongoDB

Use this for normal development. Transactions are not available, so checkout and cancellation use the compensating-rollback path.

```powershell
mongod --dbpath C:\data\vortex-dev --port 27017
```

### Local replica set (for transaction support)

The server uses MongoDB transactions automatically when it connects to a replica set. Set up a single-node replica set once:

```powershell
mkdir C:\data\rs0 -Force
mongod --replSet rs0 --dbpath C:\data\rs0 --port 27018 --bind_ip 127.0.0.1
# in a second window, once:
mongosh --port 27018 --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'127.0.0.1:27018'}]})"
```

Then use a URI such as `mongodb://127.0.0.1:27018/vortex?replicaSet=rs0` in your local `.env`.

### Hosted MongoDB (Atlas)

Use a connection string from your own Atlas project. Keep it only in your local `.env`. Hosted clusters support transactions.

### Seeding the demo catalogue

The demo catalogue contains **8 categories and 40 products**:

- Tops, Bottoms, Hoodies & Jackets, Sports Bras, Accessories (original 5)
- Swimwear, Running Essentials, Yoga & Studio (added)

It uses placeholder prices, descriptions, and Unsplash demo photos. The demo coupons `VORTEX10` and `WELCOME15` are also created.

**Warning:** `npm run seed` deletes **all** products, categories, reviews, demo reviewer accounts and the demo coupons in the database
that `MONGO_URI` names, then recreates the demo catalogue. Customers, admins and orders are not deleted, but orders keep their own
copy of product details.

**Database guard:** `npm run seed` runs only when `MONGO_URI` names exactly the database `vortex_playground`. The reset function it calls (`seedCatalog` in `server/src/seed/seed.js`) also accepts a test database named `vortex_test_<name>`, where `<name>` is one or more letters, digits, `_` or `-`. The tests use that path with `MONGO_TEST_URI`. Any other name is refused, including `vortex`, and `vortex_test` on its own.

- It checks the name before connecting and refuses if the name differs.
- It checks the name again after connecting, before anything is deleted, and disconnects if the name differs.
- There is no flag or environment variable that bypasses the guard. `--force` affects only the production check.
- When it refuses, nothing is changed. The message names the database it found, but never prints the URI, because the URI contains the password.
- The guard checks only the name. It cannot tell a playground server from a real server that happens to hold a database with the same name, so keep real data out of any server running `vortex_playground`.

#### Safe seeding against `vortex_playground` (recommended)

Set `MONGO_URI` in the same PowerShell window immediately before running the seed:

```powershell
cd server
$env:MONGO_URI = "mongodb://127.0.0.1:27017/vortex_playground"
npm run seed
```

Why this works: `server/src/config/env.js` loads `server/.env` with dotenv, and dotenv does not overwrite a variable that is
already set in the shell. The value you set in the window therefore takes priority over the value in `.env` for that session only,
and the guard checks that value. Close the window afterwards, or set the variable back to the value you normally use.

Rules for seeding:

- Use `vortex_playground`. `npm run seed` refuses every other name, including `vortex` and `vortex_test_<name>`.
- Always set `$env:MONGO_URI` first, so the guard checks the value you intend to use.

#### Admin accounts

Create the admin account against the same database. Set `MONGO_URI` in the window first, as above:

```powershell
cd server
$env:MONGO_URI = "mongodb://127.0.0.1:27017/vortex_playground"
npm run create-admin -- --email <your-email> --name "<your name>"
npm run create-admin -- --email <your-email> --reset-password
```

`create-admin` has no database-name guard. It uses the same `MONGO_URI` as the seed, so setting the variable first matters.
The seed does not delete admin or customer accounts, so an admin created before seeding stays in place.
Log in at `/login` with that account after starting the server and client.

## Tests

Server tests (use a **throwaway** database name that contains `test`):

```powershell
cd server
$env:MONGO_TEST_URI = "mongodb://127.0.0.1:27017/vortex_test"
npm test
```

Transaction tests run only against a replica set; on a standalone server they are skipped:

```powershell
$env:MONGO_TEST_URI = "mongodb://127.0.0.1:27018/vortex_test?replicaSet=rs0"
node --test tests/transactions.test.mjs
```

Seed tests check the demo catalogue counts (8 categories, 40 products, 7 best sellers, 8 on sale, 9 new arrivals). They use `MONGO_TEST_URI` and never the `vortex` database. The seed database-guard tests (`tests/seedGuard.test.mjs`) need no database.

Client checks:

```powershell
cd client
npx tsc -b
npm run build
npm test                         # client suite: 47 tests in tests/safeNext.test.mjs (Node's built-in test runner)
npm run check:images             # needs internet; checks every Unsplash photo ID (see below)
```

The client suite is the only automated client test. Its single file, `client/tests/safeNext.test.mjs`, contains 47 tests. The project handoff (`handoff/VORTEX_NEW_CHAT_HANDOFF.md`, section 10) records 47 passing and 0 failing in its last recorded run. That is a historical result, not a current one: run `npm test` to see the present status. Client components such as the cart and checkout have no automated tests.

`npm run check:images` sends a request for each unique Unsplash photo ID found in `client/src/data/images.ts` and
`server/src/seed/catalog.js`. It reports `OK` or `BROKEN` for each ID and which file uses it. It exits with a non-zero code if any ID is broken or Unsplash cannot be reached.

Test results must be read from the actual output on your machine. `VORTEX_PROGRESS.md` records what has and has not been run.

## Admin area

Log in at `/login` with an admin account. Admins are redirected to `/admin`. The admin area has Dashboard, Orders, Products,
Categories, Coupons and Customers screens. The Coupons and Customers screens were added in Phase 7 and have not yet been compiled
or browser-tested (see `VORTEX_PROGRESS.md` section 29).

## Known limitations

- Phase 7 has not been fully verified. Frontend TypeScript and production build results after the Phase 7 edits are not recorded.
- The admin Coupons and Customers screens have not been compiled or browser-tested.
- Policy pages (FAQ, Contact, Privacy, Returns) contain **placeholders** that the business must replace. They are not legal advice.
- Product images are Unsplash demo images, not product photographs. Several products currently share photos. An image sourcing plan is awaiting owner approval and no images have been changed; see `VORTEX_PROGRESS.md` section 32.
- Demo catalogue prices, descriptions and sale prices are placeholders.
- Password reset by email is not implemented.
- Product reviews are not submitted by customers; no reviews are seeded.
- Only Cash on Delivery is supported.
- Dependency advisories were reviewed read-only and have not been resolved. Do not run `npm audit fix --force`; upgrades must be planned.
- Real-load concurrency and production behaviour have not been tested.

## Security notes

- Keep `.env` files, passwords, tokens and database dumps out of version control and out of shared archives.
- Use HTTPS and `NODE_ENV=production` in any hosted environment.
- Do not expose the API's error details or stack traces to users; they are shown only in development.
