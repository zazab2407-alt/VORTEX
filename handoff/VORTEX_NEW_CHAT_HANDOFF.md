# VORTEX: New-Chat Handoff (current state)

Use this file together with the repository to continue work in a new conversation, on any computer or account.
It describes the project as it is now. Anything not marked as verified has not been run.

## 1. What VORTEX is

VORTEX is a sportswear e-commerce store (demo catalogue, for sale as a template to future clients):

- **Storefront:** catalogue with filters and sorting, product pages with variants and stock, cart with a server-side quote,
  checkout (guest or logged in), order confirmation, order tracking and guest cancellation, account and order history, wishlist.
- **Admin:** dashboard, orders, products, categories, uploads, coupons and customers (the coupon and customer screens were
  written but not compiled or run in the last session; see section 10).
- **Payments:** Cash on Delivery only. No payment provider is integrated.
- **Status:** not deployed. Not production-ready. Do not deploy without the owner's approval.

## 2. Technologies

- **Client:** React 18.3, TypeScript 5.6, Vite 5, Tailwind CSS 3, react-router-dom 7.18.6, lucide-react 0.468.
- **Server:** Node.js (ES modules), Express 4, MongoDB with Mongoose 8, express-validator 7, helmet 8, express-rate-limit 7,
  jsonwebtoken 9, bcryptjs 2, multer 2.5.0, sharp 0.35 (uploads re-encoded to WebP), nodemailer 10.6.1, cloudinary (configuration only).
- **Tests:** Node's built-in test runner (`node --test`). No browser test framework.
- **Verified toolchain:** Windows 10/11, Node.js v26.13.0, npm 11.20.0, MongoDB Server 8.2.7 (standalone and single-node replica set).

## 3. Repository layout

```
README.md                      setup notes (older; this file is more current)
.gitignore                     excludes .env, node_modules, client/dist, uploads, logs, test-logs, *.zip archives
client/
  index.html, package.json, package-lock.json, vite.config.ts, tsconfig*.json, tailwind.config.js, postcss.config.js
  .env.example                 client placeholders (see section 5)
  public/images/
    products/demo/photo-01..46.webp   demo product photos (one per product, mapped in server/src/seed/demoPhotos.js)
    products/placeholder.webp         generated placeholder
    categories/*.webp                 generated category placeholders
    site/*.webp                       storefront photos (hero, banners, promo, gallery)
  scripts/check-images.mjs     verifies image references (npm run check:images)
  src/
    App.tsx, main.tsx, index.css
    components/  pages/ (incl. pages/admin/)  context/  data/  hooks/  services/  types/  utils/
  tests/                       safeNext.test.mjs (client unit tests, 47 tests in the client suite)
server/
  package.json, package-lock.json, .env.example
  scripts/
    sync-catalog-images.mjs    one-off, non-destructive sync of demo image fields (see section 6)
    fetch-images.mjs           RETIRED Unsplash downloader. Do not run: it rewrites handoff/IMAGE_LICENSES.md
  src/
    index.js, app.js
    config/       env.js, db.js, settings.js
    routes/       auth, product, category, cart, order, admin, contact
    controllers/  auth, product, category, cart, order, admin, coupon, customer, contact
    services/     orderService, pricing, productService, mailer, imageService
    models/       User, Product, Category, Order, Coupon, Review, CheckoutAttempt
    middleware/   auth, csrf, sanitize, rateLimiter, upload, validate, errorHandler
    validators/   auth, product, category, order, coupon, customer, contact
    utils/        tokens, transaction, serializers, productQuery, money, currency, orderNumber, ...
    seed/         seed.js (destructive; see section 6), catalog.js, createAdmin.js, adminAccount.js,
                  demoPhotos.js (product to photo map), demoImages.json (licence records), imagePaths.js, imageManifest.json (emptied; retired)
  tests/          *.test.mjs (about 30 files), helpers.mjs, stress/
handoff/
  VORTEX_NEW_CHAT_HANDOFF.md   this file
  CHANGELOG.md, MASTER_PROGRESS.md, IMAGE_LICENSES.md
  SECURITY_AUDIT.md, MASTER_ENGINEERING_PLAN.md, IMPLEMENTATION_PLAN.md   earlier audit and planning documents
```

## 4. Install and run

Prerequisites: Node.js 20 or newer (tested on v26), npm, and a MongoDB instance (standalone is enough for development).

**Server** (PowerShell):

```powershell
cd server
npm install
Copy-Item .env.example .env          # then edit the local .env with real local values. Never commit it.
npm run dev                          # API, default port PORT=5000
```

**Client** (second PowerShell window):

```powershell
cd client
npm install
Copy-Item .env.example .env          # optional, only if the API is not on the default address
npm run dev                          # Vite dev server on port 5173, /api proxied to the server
```

Important: if `NODE_ENV` is set to `production` in the shell, npm skips development dependencies (TypeScript, Vite).
Use `npm ci --include=dev` (or clear `NODE_ENV`) in `client/`, otherwise `npx tsc -b` and `npm run build` fail with "tsc not recognized".
This was found when verifying a fresh clone.

**Checks:**

```powershell
cd client
npx tsc -b
npm run build
npm test
npm run check:images

cd ..\server
npm test                             # needs MONGO_TEST_URI, see section 6
```

Scripts that exist in `server/package.json`: `dev`, `start`, `seed`, `create-admin`, `test`, `images:fetch` (retired, do not use),
`images:apply` (**broken: `src/seed/applyImages.js` does not exist**).

## 5. Environment variables (names only, never values)

Server (`server/.env.example` lists them with placeholders):

`PORT`, `NODE_ENV`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLIENT_URL`, `COOKIE_SAMESITE`, `MONGO_URI`, `MONGO_TRANSACTIONS`,
`MONGO_MAX_POOL_SIZE`, `STORE_NAME`, `CURRENCY`, `CURRENCY_LOCALE`, `SHIPPING_FLAT_RATE`, `FREE_SHIPPING_THRESHOLD`, `PROMO_CODE`,
`STORE_EMAIL`, `STORE_PHONE`, `STORE_ADDRESS`, `RETURN_WINDOW_DAYS`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
`MAIL_FROM`, `CONTACT_TO`, `UPLOADS_DIR`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

Tests: `MONGO_TEST_URI` (the test database URI; the tests never read `MONGO_URI`).

Client (`client/.env.example`): `VITE_API_URL` (optional).

Required for a working server: `JWT_SECRET` (at least 32 random characters) and `MONGO_URI`. Everything else has a default or is optional.
SMTP is optional: without it, order emails are skipped and the contact form reports that email is unavailable.

## 6. Database setup

- **Standalone MongoDB** (for example `mongodb://127.0.0.1:27017/<name>`): fine for development. Transactions are unavailable
  there, so checkout and cancellation use a compensating-rollback path.
- **Replica set** (needed for the transaction tests and to match production): run `mongod --replSet rs0`, then `rs.initiate`
  once in `mongosh`. The server detects transaction support automatically. Hosted MongoDB (Atlas) is a replica set.
- **Seed (`npm run seed`) is destructive.** It deletes products, categories, reviews and demo accounts, then recreates the demo catalogue
  (8 categories, 40 products, 2 coupons). It refuses to run unless `MONGO_URI` names exactly `vortex_playground`, and it refuses
  in production without `--force`. Never seed a database that holds real data.
- **Live-data image sync (`server/scripts/sync-catalog-images.mjs`)**: a one-off, non-destructive script. It refuses any database
  except `vortex_playground`, takes a JSON backup before writing, and only updates image fields or inserts missing catalogue rows.
  Default is a dry run; `--apply` writes. It was used once for the current demo images.
- **Admin account:** `npm run create-admin -- --email <email> --name "<name>"`; add `--reset-password` to reset an existing one.
- **Models (summary):** User (role, tokenVersion, isActive), Product (variants with per-size and per-colour stock, effectivePrice,
  sold), Category, Order (snapshot items, statusHistory, idempotencyKey), Coupon, Review, CheckoutAttempt (24-hour TTL).

## 7. API overview

- `/api/auth`: register, login, logout, session, profile, password change.
- `/api/products`, `/api/categories`: public read; writes need an admin.
- `/api/cart`: server-side quote (pricing, stock, coupon) and public store settings.
- `/api/orders`: create (idempotent checkout), own orders, lookup by order number, guest cancel.
- `/api/contact`: contact form (email only; honeypot; rate limited).
- `/api/admin`: dashboard, orders, products, categories, uploads, coupons, customers.
- Every non-GET request under `/api` must send `X-Requested-With: vortex-web` (CSRF guard).

## 8. Authentication and authorization

- Login sets an httpOnly cookie `vortex_token` (JWT, 7 days, HS256). The server reloads the user on every request and rejects
  inactive accounts and stale `tokenVersion` values.
- Password change increments `tokenVersion`, which signs out other sessions.
- Admin routes use router-level `requireAdmin`. Client-side role checks are cosmetic; the server enforces access.
- Logout only clears the cookie. Server-side revocation of a copied token is **not** implemented.
- Rate limits are per IP and in memory (login failures, order submissions, order lookup failures, contact messages).

## 9. Current demo content and images

- 8 categories and 40 products. Each product shows one demo photo, chosen by visual audit: men's products show male models
  or neutral equipment, women's products show female models or neutral equipment, unisex products show neutral imagery.
- 46 product photos (`photo-01` to `photo-46`), 10 storefront photos, 8 generated category placeholders, 1 product placeholder.
- All photos come from Wikimedia Commons under CC0, public domain, or CC BY 2.0/4.0. Source, photographer and licence for every
  file are in `server/src/seed/demoImages.json` and `handoff/IMAGE_LICENSES.md`.
- The six old product folders under `client/public/images/products/` (core-duffel-bag, current-swim-shorts, hydra-shaker-bottle,
  pacific-swim-cap, riptide-training-swim-trunks, tide-racerback-swimsuit) hold 8 Unsplash photos that **must not be reused**.
  They are not in the repository and are not referenced by the code.
- All demo data is temporary. The owner replaces it through the admin product form.

## 10. Current state

**Verified in the last session (exact results):**
- Server, standalone MongoDB: 428 tests, 425 passed, 0 failed, 3 skipped (the replica-set-only transaction tests).
- Client: 47 tests, 47 passed. `tsc -b` clean. `npm run build` succeeds.
- Earlier, a replica-set run (`rs0`) on an earlier code state: all three transaction tests passed; the only failure then was an
  outdated seed image assertion, since fixed. **The replica-set run has not been repeated on the current code.**
- Live site, checked in a headless browser: homepage 24 of 24 images load, shop 12 of 12, product pages 6 of 6, no fallback boxes.

**Not verified:**
- Coupon and customer admin screens: written, not compiled or run in a browser.
- Client components beyond routing and `safeNext` have no automated tests (cart, checkout, admin).
- Replica-set tests on the current code.
- (Verified now: a fresh clone of `project-sync/full-project` installs with `npm ci` and `npm ci --include=dev`, and passes
  the client suite (47/47), `tsc -b`, `npm run build`, and the server suite (428 total, 425 passed, 0 failed, 3 skipped on standalone).)

## 11. Known problems (not fixed)

Most items below come from the earlier audit documents (`SECURITY_AUDIT.md`, `MASTER_ENGINEERING_PLAN.md`). They are not
re-verified in the current code. Re-check each one with a test before fixing it.

Security and data integrity:
- Logout does not revoke tokens on the server (tokens are stateless; only `tokenVersion` changes on password change).
- Login-failure throttling exists per IP and per email (see `server/tests/loginThrottle.test.mjs`). Its counters are in
  memory, so they are per process and do not share state across several servers. Confirm the storage before relying on it in production.
- Registration reveals whether an email already has an account.
- No password reset by email (not implemented; behaviour without SMTP is undecided).
- Replayed idempotent checkout returns the full order, including the customer's address.
- Idempotency keys can stay "in progress" after a crash.
- Admin stock edits can overwrite sales made after the page loaded; stock updates have a race.
- Products in hidden categories are still purchasable (filtering is frontend only).
- Guest cancellation uses order number and email only.
- Failed confirmation emails are not retried.
- Cash on Delivery becomes "paid" automatically on delivery, with no separate collection step.
- The seed script deletes data in any database named `vortex_playground`; the guard is by name only.
- Some old demo reviews may still exist in databases seeded earlier.
- Image URL validation accepts any HTTPS host.
- No Content-Security-Policy in the client; no React error boundary.

Data and content:
- Order records created before the image change still store the old Unsplash photo URLs in their item snapshots (8 items in 6 orders
  in `vortex_playground`). Changing them is an owner decision.
- The database named `vortex` still contains 16 products with Unsplash URLs and older data. The running app does not read it.
- Business identity, real product photography, final policy text, shipping and tax treatment are owner decisions.
- No tax is calculated.
- Category thumbnails are generated placeholders.
- Credit notices for CC BY photos are not shown on the storefront yet (40 files require credit; see `IMAGE_LICENSES.md`).
- Three men's products use neutral equipment photos because no further suitable permitted male-model photos were found.
- Some photo crops are tight (legs or equipment only).
- Six demo photos (`photo-06`, `22`, `26`, `27`, `38`, `40`) are not used by any product.

Tooling:
- `npm run images:apply` is broken (missing file).
- `server/scripts/fetch-images.mjs` is retired but still present and would rewrite `IMAGE_LICENSES.md` with an empty table if run.
- The commit author email in the existing history is a placeholder.
- Dependency advisories remain open; no `npm audit fix --force` was run.

## 12. Environment notes from the last session

- Development ran on Windows with two dev servers started by hand: API on port 5000 and Vite on port 5173. Both had stopped
  during the session and were restarted, so they are not persistent.
- A second MongoDB instance used for tests was on port 27019 (standalone). The original development instance on port 27017 held
  the `vortex` and `vortex_playground` databases.
- Local-only directories that are not in the repository: `C:\data\vortex-test-baseline`, `C:\data\vortex-test-rs0`,
  `C:\data\vortex-image-sync-backup` (database backup from the image sync).

## 13. Next steps (in order, owner-approved only)

1. Run the checks in section 4 on a clean clone and record the exact output.
2. Run the server suite against a replica set (`MONGO_TEST_URI` with `replicaSet=rs0`) on the current code.
3. Decide the order-snapshot image question and the old `vortex` database question.
4. Add the CC BY credits to the storefront.
5. Fix the broken `images:apply` script or remove it from `package.json`.
6. Work through section 11 by priority, one item at a time, with a test for each fix.
