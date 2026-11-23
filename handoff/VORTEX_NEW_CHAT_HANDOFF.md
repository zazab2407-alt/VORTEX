# VORTEX — New-Chat Handoff

Use this file with the source ZIP (`VORTEX_SOURCE_HANDOFF.zip`) to continue development in a new conversation.
**Status note:** this handoff was written by an assistant that could read and write project files but could not run
`npm`, Node, MongoDB or any Windows command. Nothing below is a test result unless it is marked as owner-run.

## 1. What VORTEX does

VORTEX is a sportswear e-commerce store: a React storefront (catalogue, product pages, cart, checkout, order tracking,
customer accounts, wishlist) and an admin area (dashboard, orders, products, categories). Payments are **Cash on Delivery only**.
The store is not deployed and must not be deployed without owner approval.

## 2. Technologies

- Client: React 18, TypeScript ~5.6, Vite 5, Tailwind CSS 3, react-router-dom 6, lucide-react.
- Server: Node.js ES modules, Express 4, MongoDB with Mongoose 8, express-validator 7, helmet 8, express-rate-limit 7,
  jsonwebtoken, bcryptjs, multer + sharp (uploads re-encoded to WebP), nodemailer 6, cloudinary (configuration only).

## 3. Folder structure

```
README.md, PHASE7_HANDOFF.md, VORTEX_PROGRESS.md, VORTEX_COMPLETE_AUDIT.md, BACKUP_INFO.txt, .gitignore
client/
  index.html, package.json, package-lock.json, vite.config.ts, tsconfig.json, tailwind.config.js, postcss.config.js
  scripts/check-images.mjs
  src/
    App.tsx, main.tsx, index.css
    components/   (shared UI: Layout, Navbar, Footer, Field, ProductCard, CartDrawer, PolicyPage, ...)
    context/      (AuthContext, CartContext, WishlistContext, ToastContext)
    data/         (catalog.ts, content.ts, images.ts, policies.ts)
    hooks/        (useAsync, useCartQuote, useCategories, useDocumentTitle, useLocalStorage, useShopConfig)
    pages/        (Home, Shop, ProductDetail, Cart, Checkout, Login, Register, Account, TrackOrder, Faq, Contact, Privacy, Returns, ...)
    pages/admin/  (AdminLayout, Dashboard, Products, ProductForm, Orders, OrderDetail, Categories)
    services/     (http, api, shop, auth, admin)
    types/        (index.ts)
    utils/        (format, safeNext, storeText)
server/
  package.json, package-lock.json, .env.example
  src/
    index.js, app.js
    config/       (env.js, db.js, settings.js)
    routes/       (index, auth, product, category, cart, order, admin, contact)
    controllers/  (auth, product, category, cart, order, admin, coupon, customer, contact)
    services/     (orderService, pricing, productService, mailer, imageService)
    models/       (User, Product, Category, Order, Coupon, Review, CheckoutAttempt, index)
    middleware/   (auth, csrf, sanitize, rateLimiter, upload, validate, errorHandler)
    validators/   (auth, product, category, order, coupon, customer, contact)
    utils/        (tokens, transaction, serializers, productQuery, money, currency, orderNumber, objectId, ApiError, asyncHandler, duration)
    seed/         (seed.js, catalog.js, createAdmin.js, adminAccount.js)
  tests/          (22 *.test.mjs files plus helpers.mjs)
```

Excluded from the ZIP: `node_modules`, `dist`, build output, `.git`, real `.env` files, uploads, local databases, logs.

## 4. Install and run

**Server** (PowerShell):
```powershell
cd server
npm install
Copy-Item .env.example .env        # then edit the local .env; never share it
npm run dev                        # API on the port set in the server configuration
```

**Client** (second PowerShell window):
```powershell
cd client
npm install
npm run dev                        # Vite dev server; /api is proxied to the server
```

Build and type check:
```powershell
cd client
npx tsc -b
npm run build
```

## 5. Environment variables (names only; never values)

From `server/.env.example`: `JWT_SECRET`, `MONGO_URI`, `MONGO_TRANSACTIONS`, `MONGO_MAX_POOL_SIZE`, `CLIENT_URL`,
`COOKIE_SAMESITE`, `NODE_ENV`, `UPLOADS_DIR`, `STORE_NAME`, `CURRENCY`, `CURRENCY_LOCALE`, `SHIPPING_FLAT_RATE`,
`FREE_SHIPPING_THRESHOLD`, `PROMO_CODE`, `STORE_EMAIL`, `STORE_PHONE`, `STORE_ADDRESS`, `RETURN_WINDOW_DAYS`, `CONTACT_TO`,
`SMTP_*` variables, `MAIL_FROM`, optional `CLOUDINARY_*`.
Client optional: `VITE_API_URL` (see `client/.env.example`).

## 6. Database setup

- Local standalone MongoDB is enough for most development. Transactions are not available there; the server uses a
  compensating-rollback path instead.
- Transaction tests need a **single-node replica set** (`mongod --replSet rs0`, then `rs.initiate`). The server detects it
  automatically. Hosted MongoDB (Atlas) supports transactions.
- `npm run seed` in `server/` **deletes** the products, categories, reviews and demo accounts and recreates the demo catalogue
  (8 categories, 40 products). It is refused in production without `--force`. It is also refused unless `MONGO_URI` names
  exactly `vortex_playground` (checked before and after connecting; no bypass). Set `$env:MONGO_URI` in the same PowerShell window,
  because dotenv does not overwrite shell variables. Never seed `vortex` or any database with real data.
- Admin accounts: `npm run create-admin -- --email <email> --name "<name>"`; password reset with `--reset-password`.
- Models: User (role, tokenVersion, isActive), Product (variants with per-size/colour stock, effectivePrice, sold),
  Category, Order (snapshot items, statusHistory, idempotencyKey), Coupon, Review, CheckoutAttempt (24-hour TTL).

## 7. Main API routes (summarised from the route files)

- `/api/auth`: register, login, logout, session, profile, password change.
- `/api/products`, `/api/categories`: public listing and detail; writes require admin.
- `/api/cart`: quote (server-side pricing, stock, coupon), `GET /config` (public store settings allow-list).
- `/api/orders`: create (idempotent checkout), mine, get by order number, lookup, lookup/cancel, cancel.
- `/api/contact`: contact form (email only; honeypot; rate limited).
- `/api/admin`: dashboard, orders (list, detail, status), products, categories, uploads, coupons (`/coupons`, `/coupons/:id`),
  customers (`/customers`, `/customers/:id`, `/customers/:id/status`).
- Every non-GET request under `/api` must send `X-Requested-With: vortex-web` (CSRF guard).

## 8. Authentication and authorization

- Login sets an httpOnly cookie `vortex_token` (JWT, 7 days, HS256). The server reloads the user on every request and rejects
  inactive accounts and tokens whose `tokenVersion` is stale.
- Password change increments `tokenVersion`, which signs out other sessions.
- Admin routes are protected by router-level `requireAdmin`. The client's role checks are cosmetic; the server enforces access.
- Logout only clears the cookie. Server-side revocation of a copied token is **not** implemented (see Known bugs).
- Rate limits are per IP and in memory: login failures, order submissions, order lookup failures, contact messages.

## 9. Completed features (code exists)

Storefront, catalogue with filters and sorting, product detail with variants and stock, cart with server-side quote and coupon,
checkout (guest or logged in, COD, idempotent), order confirmation, order tracking and guest cancellation, account and order
history, wishlist (browser-stored), admin dashboard, product/category management, image upload, order status flow with stock
restoration on cancel, coupon checkout rules, configurable store settings, contact endpoint, policy pages with placeholders.

## 10. Phase 7 changes

Implemented in code (see `PHASE7_HANDOFF.md` and `VORTEX_PROGRESS.md` for the full list):
- Validated store settings and a public settings endpoint; currency-aware formatting; config-driven announcement, footer and product text.
- MongoDB transactions with a standalone fallback for checkout and cancellation.
- Admin coupon API and customer API, with tests.
- Contact endpoint (email only, honest unavailable states).
- FAQ, Contact, Privacy and Returns pages with placeholder content, and their routes and footer links.
- Newsletter form removed from the home page; fabricated testimonials and fabricated reviews removed (see progress file).
- Currency re-render: a keyed wrapper in `App.tsx` remounts the page tree once when a non-default currency or locale arrives.
- README (`README.md`).

**Built after this handoff, NOT compiled or run:** admin Coupons screen and admin Customers list and detail screens, with their sidebar links (see `VORTEX_PROGRESS.md` section 29). **Not done in Phase 7:** a full sweep of
admin pages for hard-coded `$` (ProductForm is known to contain it); password reset by email (not in Phase 7 scope).

## 11. Tests and their actual results

**Owner-run, Windows (recorded in `VORTEX_PROGRESS.md` section 27):**
- Backend, standalone MongoDB 8.2.7 (port 27019): 348 tests, 345 passed, 0 failed, 3 skipped (replica-set-only transaction subtests).
- Backend, replica set rs0 MongoDB 8.2.7 (port 27020, PRIMARY): 348 tests, 348 passed, 0 failed, 0 skipped.
- These runs were made before the latest Phase 7 frontend edits and before any later Phase 7 work in this handoff. The owner-run runs cover the server tests as they were at that time; re-run them after any server change.
- The `[transactions] … supported:` log line was not supplied and has not been observed.

**Owner-reported, Windows (historical):** `npx tsc -b` and `npm run build` passed after the first Session 3 client edits only.
Frontend edits made after that (policy pages, contact page, routes, footer links, currency gate, and others listed in `VORTEX_PROGRESS.md` section 21)
have **no** recorded TypeScript or build result.

**Not run by the assistant:** every command. Nothing was executed in the assistant's environment.

## 12. Known bugs and limitations

See `VORTEX_COMPLETE_AUDIT.md` (sections 7 and 10) and `VORTEX_PROGRESS.md` (sections 7 and 11). Most important:
- Frontend changes since the first Session 3 edits have no TypeScript or build result.
- Real-load concurrency and production behaviour are unverified.
- Logout does not revoke tokens server-side (SEC-02).
- Registration reveals whether an email has an account (CA-09 / BUG-20).
- Admin stock edits can overwrite recent sales (BUG-09); stock race on product update (BUG-21).
- Hidden categories still sell (BUG-08 / CA-35).
- Currency labels still hard-coded in places (BUG-06); formatter not reactive except via the new gate (BUG-07).
- Checkout field labels are not associated with inputs (CA-06).
- No error boundary (CA-11). No password reset (CA-05). No email when SMTP is not configured (CA-04).
- Business identity, real product photography, final policy text and tax treatment are owner decisions (CA-02, CA-03, CA-07, CA-08).
- Dependency advisories: server `nodemailer`, client `vite`, `react-router-dom`, `esbuild` (planned upgrades; no `npm audit fix --force`).
- Existing databases may still contain fabricated review documents from the earlier demo seed (owner approval needed to remove).

## 13. Remaining tasks (priority order)

1. Owner runs the frontend checks: `npx tsc -b` and `npm run build` in `client/`. Fix any errors reported.
2. Owner runs the server tests (standalone and replica set) against throwaway databases and reports exact output.
3. Verify the admin Coupons and Customers screens (written, not compiled or run): run `npx tsc -b` and `npm run build`, then test create, edit, activate/deactivate, delete, search, filters, pagination and the customer detail screen against a throwaway database.
4. Sweep admin pages for hard-coded `$`.
5. Owner decides dependency upgrade plan; then perform upgrades locally with `npm install`, not `--force`.
6. Owner decisions listed in `VORTEX_PROGRESS.md` section 11 (logout revocation design, hidden-category semantics, password reset design, reviews scope, business content).

## 14. Exact next recommended step

Run `npx tsc -b` and `npm run build` in `client/` and paste the full output. Based on the result, fix the reported errors
before any new feature work. Do not start the admin screens until the frontend compiles.

## 15. Catalogue expansion (latest session)

- Demo catalogue now has **8 categories and 40 products**. New categories: Swimwear, Running Essentials, Yoga & Studio.
  The 16 original products are unchanged. Featured products: 7. On-sale products: 8. New arrivals (under 30 days): 9.
- Only existing palette colours and existing size values are used. Images reuse existing Unsplash pool IDs.
- `server/tests/seed.test.mjs` asserts the new counts. `client/scripts/check-images.mjs` now also checks photo IDs in
  `server/src/seed/catalog.js`.
- Status: **nothing in this session was executed.** The owner must run `npm test` (server, against a throwaway test database),
  `npx tsc -b`, `npm run build` and `npm run check:images` (client) and paste the output.
- The source ZIP `handoff/VORTEX_COMPLETE_SOURCE.zip` was not created by the assistant (no archive tool is available in its
  environment). See the PowerShell instructions in the session report.
- Full change log: `handoff/CHANGELOG.md`.
