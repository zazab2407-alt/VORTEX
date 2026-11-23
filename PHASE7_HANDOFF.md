# VORTEX — Phase 7 Handoff Report

Written at the end of a Claude session so another Claude session (or a human) can continue **from the saved state, not restart**.
Project: `C:\Users\ZIAD\Desktop\vortex-source\vortex`

> **Update (later session):** after this report was written, the FAQ, Contact, Privacy and Returns pages and their routes, the footer links, a README, and a currency re-render gate in `App.tsx` were added (see `VORTEX_PROGRESS.md` section 28). The owner-run CA-01 backend results are in `VORTEX_PROGRESS.md` section 27. No TypeScript or build result exists after the Phase 7 frontend edits. The admin Coupons and Customers screens were added later (`VORTEX_PROGRESS.md` section 29): they are written but NOT compiled, built or run. The project is at `F:\vortex`, not the path given below; treat the path below as historical.

> **Update (catalogue and documentation session):** the demo catalogue now has 8 categories and 40 products (added Swimwear, Running Essentials, Yoga & Studio; 24 new products; see `handoff/CHANGELOG.md`). The image checker also validates Unsplash IDs in `server/src/seed/catalog.js`. `README.md` now exists and documents setup, safe seeding against `vortex_playground` and test commands. The source ZIP was not created by the assistant. **Phase 7 is NOT complete:** the remaining items in section D still apply, and nothing from this session was executed.

---

## A. Project overview

**VORTEX** is a full-stack sportswear e-commerce store (black / white / dark gray / electric orange `#FF5A1F`; Barlow Condensed headings, Inter body).

| Part | Technology |
|---|---|
| Client (`client/`) | React 18, TypeScript (~5.6), Vite 5, Tailwind CSS 3, react-router-dom 6, lucide-react |
| Server (`server/`) | Node.js (ES modules), Express 4, MongoDB + Mongoose 8, express-validator, helmet, express-rate-limit, multer + sharp (image upload, re-encoded to WebP), nodemailer 6, cloudinary (optional) |
| Auth | JWT in an httpOnly cookie named `vortex_token`; passwords hashed with bcryptjs (12 rounds); `tokenVersion` invalidates old sessions after a password change |
| Payments | Cash on Delivery only (no online payments) |

Existing features (all working before Phase 7, per the owner): storefront, catalog, product detail, cart, checkout, COD, auth/profile, wishlist, orders and tracking, admin dashboard, product/category management, coupons (checkout side), reviews, product variants with per-size/colour stock.

### Structure
```
vortex/
  client/
    src/ components/  context/  data/  hooks/  pages/  pages/admin/  services/  types/  utils/
    scripts/check-images.mjs   package.json  vite.config.ts  tailwind.config.js  .env.example
  server/
    src/ config/  controllers/  middleware/  models/  routes/  seed/  services/  utils/  validators/
    tests/*.test.mjs  (+ helpers.mjs)   package.json   .env.example
```

### Run locally (PowerShell)
```powershell
# Server (needs MongoDB running locally)
cd C:\Users\ZIAD\Desktop\vortex-source\vortex\server
npm install
# copy .env.example to .env once and fill it in (JWT_SECRET >= 32 chars, MONGO_URI)
npm run seed          # demo catalog + demo coupon VORTEX10 (non-destructive to real accounts)
npm run dev           # API on http://localhost:5000

# Client (second terminal)
cd C:\Users\ZIAD\Desktop\vortex-source\vortex\client
npm install
npm run dev           # http://localhost:5173  (Vite proxies /api to port 5000)
```
Admin account: `npm run create-admin -- --email <email> --name "<name>"`; reset a password with `npm run create-admin -- --email <email> --reset-password` (this was built and saved earlier; see "Earlier work" below). Admin dashboard: `http://localhost:5173/login`, then it redirects admins to `/admin`.

---

## B. Exact current implementation status

Legend: **SAVED** = written to disk. **UNTESTED** = never executed. Nothing in Phase 7 has been executed.

### B1. Completed and saved (code written, UNTESTED)
1. **Validated store settings** (`server/src/config/settings.js`, wired in `env.js`): currency (default USD), locale, symbol, store name, shipping, public contact details, `RETURN_WINDOW_DAYS`, promo code, Mongo options, SMTP sanity checks. Invalid values make the server refuse to start with a clear message.
2. **Public settings endpoint**: `GET /api/cart/config` now returns an allow-listed object (see C). `currency` and `shipping` keep their original shape (existing tests pin `shipping` to exactly `{ flatRate: 5, freeThreshold: 100 }`).
3. **MongoDB transactions with fallback** (`utils/transaction.js`, `orderService.js`, `Coupon.js`, `db.js`): checkout and order cancellation run inside one transaction when the server is a replica set / Atlas / sharded; on standalone MongoDB the previous compensating-rollback logic is used. Startup logs which mode is active.
4. **Server-side admin coupon management**: `GET/POST /api/admin/coupons`, `GET/PATCH/DELETE /api/admin/coupons/:id` (rules below).
5. **Server-side admin customer management**: `GET /api/admin/customers`, `GET /api/admin/customers/:id`, `PATCH /api/admin/customers/:id/status`.
6. **Contact endpoint** `POST /api/contact` (email only, never stored, honest 503/502 messages, honeypot, rate limit 5/hour/IP).
7. **Mailer hardening**: currency-aware emails, strict recipient check, contact-message sender, non-fatal SMTP verify at startup, logs only error *codes*.
8. **Security tweaks**: `Cache-Control: no-store` on `/auth`, `/orders`, `/admin`, `/contact`; stack traces only when `NODE_ENV === 'development'`; startup warning when a hosted-looking setup is not `NODE_ENV=production`.
9. **Server `.env.example`** rewritten with every new variable (placeholders only).
10. **Client money formatting reads the server's currency/locale** (`utils/format.ts`, `hooks/useShopConfig.ts`); type `ShopConfig` widened; helper text in `utils/storeText.ts`.
11. **Hardcoded business text made config-driven**: announcement bar, footer, home marquee/promo/"why us", product-detail shipping/returns text. The "30-day easy returns" promise was removed (a number of days appears only if `RETURN_WINDOW_DAYS` is set).
12. **Client service methods** for coupons, customers and contact (`services/admin.ts`, `services/shop.ts`).
13. **Backend test files written** for all of the above (see C).

### B2. Partially implemented
- **Footer**: now links to `/faq`, `/contact`, `/privacy`, `/returns` — **those routes/pages do not exist yet**, so the links currently lead to the 404 page.
- **Currency in the UI**: the formatter and settings plumbing exist, but `App.tsx` has NOT been changed, so there is no re-render when non-default settings arrive (see D). With the default USD nothing differs. Other files that may still hardcode `$` were found by grep in: Home/Cart/Checkout/ProductDetail (edited) — a full re-check of admin pages (Dashboard, Orders, ProductForm) for hardcoded `$` was **not** done.
- **Coupon admin API and customer admin API**: written, with tests written, **neither ever run**.

### B3. Not implemented yet
- FAQ, Contact, Privacy Policy, Returns & Refunds pages (client) and their editable placeholder content file.
- Client routes in `App.tsx` for the four pages and for the admin pages.
- (Earlier state; superseded by VORTEX_PROGRESS.md section 29.) Admin **Coupons** page, admin **Customers** list page, admin **Customer detail** page and admin sidebar links: these now EXIST (written, not compiled, built or run).
- Hiding the fake Newsletter form (see D — the edit **failed**, so the form is still visible).
- README / project documentation (none exists in the repo).
- Local MongoDB replica-set instructions (only mentioned in `.env.example`).
- Dependency advisory review decisions (audit was run read-only; nothing was upgraded).
- Frontend tests/checks and any browser-level verification.
- Final report items (test results, etc.).

### B4. Not tested (everything above)
See section E.

### B5. Earlier work (before Phase 7), saved earlier
Admin password reset: `server/src/seed/adminAccount.js` (new), `server/src/seed/createAdmin.js` (rewritten, `--reset-password`), `server/tests/createAdmin.test.mjs` (new). The owner reported 248/248 backend tests and 14/14 admin-account tests passing **before** Phase 7. These have not been re-run since Phase 7 changes.

---

## C. Exact file changes

### C1. Newly created — server
| File | Purpose |
|---|---|
| `server/src/config/settings.js` | Pure env validator: currency/locale/symbol, shipping, contact details, return window, promo code, Mongo and SMTP checks. Also exports `isPlainEmail`. |
| `server/src/utils/currency.js` | `formatMoney()` using configured currency + locale (used by coupon messages and emails). |
| `server/src/utils/transaction.js` | `transactionsSupported()` (replica-set/sharded detection, cached per connection), `runInTransaction(work)`, `resetTransactionSupport()`. Falls back to `work(null)` on standalone. |
| `server/src/controllers/couponController.js` | Admin coupon list/get/create/update/delete + `serializeCoupon`. |
| `server/src/controllers/customerController.js` | Admin customer list/detail/status with an allow-list serializer. |
| `server/src/controllers/contactController.js` | `POST /api/contact` logic. |
| `server/src/validators/couponValidators.js` | Coupon body/list validation. |
| `server/src/validators/customerValidators.js` | Customer list query / status body validation. |
| `server/src/validators/contactValidators.js` | Contact body validation + honeypot field `website`. |
| `server/src/routes/contactRoutes.js` | Mounts the contact limiter + validation + controller. |

### C2. Modified — server
| File | What changed |
|---|---|
| `server/src/config/env.js` | Uses `parseSettings`; new config keys `store`, `contact`, `returns`, `promoCode`, `mongo`; fatal on invalid settings; extra startup warnings. |
| `server/src/config/db.js` | Pool size option; logs transaction mode; no URI logging. |
| `server/src/models/Coupon.js` | `redeem`/`unredeem` accept `{ session }`; minimum-order message uses `formatMoney`. |
| `server/src/services/orderService.js` | `placeOrder`/`cancelOrder` rewritten around `runInTransaction` (idempotency, replay, email notification logic preserved). |
| `server/src/services/mailer.js` | Rewritten: `formatMoney`, `isPlainEmail` check, `sendContactMessage`, `isContactFormEnabled`, `verifySmtp`, timeouts, error-code-only logging. |
| `server/src/controllers/cartController.js` | `shopConfig` now returns the public allow-list. |
| `server/src/routes/adminRoutes.js` | Added coupon and customer routes. |
| `server/src/routes/index.js` | Mounted `/contact`; `no-store` header on sensitive prefixes. |
| `server/src/middleware/rateLimiter.js` | Added `contactLimiter`. |
| `server/src/middleware/errorHandler.js` | Stack trace only when `NODE_ENV === 'development'`. |
| `server/src/index.js` | Non-blocking SMTP verification / "not configured" log at startup. |
| `server/.env.example` | Full documented placeholder list incl. Atlas and replica-set URIs. |

### C3. New tests — server (all UNRUN)
| File | Covers |
|---|---|
| `server/tests/settings.test.mjs` | Pure settings validation, `isPlainEmail`. No database needed. |
| `server/tests/coupons.admin.test.mjs` | Coupon access control, validation, edit/delete rules, checkout ignoring client discounts, usage limit race. |
| `server/tests/customers.admin.test.mjs` | Customer access control, search, detail/history, no sensitive fields, activate/deactivate, self-protection. |
| `server/tests/contact.test.mjs` | Contact form: SMTP unconfigured / accepted / failing, validation, honeypot, header injection, no storage, no leaked logs. |
| `server/tests/transactions.test.mjs` | `runInTransaction`, oversell protection, rollback, exactly-once cancel; replica-set-only crash-safety tests (auto-skip on standalone). |
| `server/tests/phase7.test.mjs` | Public config allow-list, cache headers, no reset endpoint, error output, currency formatting, mail safety. |

### C4. Modified — client
| File | What changed |
|---|---|
| `client/src/types/index.ts` | `ShopConfig` widened; added `CouponState`, `AdminCoupon`, `AdminCustomer`, `AdminCustomerDetail`. |
| `client/src/utils/format.ts` | `formatPrice` uses configurable currency/locale via `setMoneyFormat`. |
| `client/src/hooks/useShopConfig.ts` | Rewritten: `DEFAULT_CONFIG`, `useShopSettings()` (`{config, loaded}`), `useShopConfig()`. |
| `client/src/components/AnnouncementBar.tsx` | Threshold/promo from config. |
| `client/src/components/Footer.tsx` | Config-driven shipping text, links to FAQ/Contact/Returns/Privacy; removed 30-day claim. |
| `client/src/data/content.ts` | `WHY_US` constant replaced by `whyUs(config)` function. |
| `client/src/pages/Home.tsx` | Marquee, promo and "why us" read config. (**Newsletter hiding edit FAILED**, see D.) |
| `client/src/pages/ProductDetail.tsx` | Shipping/returns text from config; links to `/returns`. |
| `client/src/pages/Cart.tsx` | Coupon placeholder text no longer shows a hardcoded code. |
| `client/src/services/admin.ts` | `coupons`, `createCoupon`, `updateCoupon`, `deleteCoupon`, `customers`, `customer`, `setCustomerActive`; `CouponInput` type. |
| `client/src/services/shop.ts` | `contactService.send`. |

### C5. Newly created — client
| File | Purpose |
|---|---|
| `client/src/utils/storeText.ts` | `freeShippingLabel(config)`, `returnsLabel(config)`. |

### C6. Planned list (historical). Several items below now exist: `client/src/data/policies.ts`, the policy pages, the admin Coupons and Customers screens, and `README.md` (see VORTEX_PROGRESS.md sections 24, 28-30).
`client/src/data/policies.ts`, `components/PolicyPage` (or similar), `pages/Faq.tsx`, `Contact.tsx`, `Privacy.tsx`, `Returns.tsx`, `pages/admin/Coupons.tsx`, `pages/admin/Customers.tsx`, `pages/admin/CustomerDetail.tsx`, `README.md`.

### C7. Behaviour details of the saved server code (for whoever tests it)
- **Coupons (admin)**: code is upper-cased, 3–30 chars `[A-Za-z0-9_-]`; `percentage` 1–100, `fixed` > 0; `minSubtotal` ≥ 0; a date-only `expiresAt` means end of that day (UTC) and must be in the future when set/changed; `usageLimit` ≥ 1 or null; `usedCount` can never be set by the client; a coupon that has been used (counter > 0 **or** any order carries its code) cannot be deleted or renamed (409) but can be deactivated; usage limit cannot go below `usedCount`.
- **Customers (admin)**: only `role: 'customer'` accounts, excluding demo reviewer emails ending `@demo.vortex.test`; search over name/email/phone (regex-escaped); history = orders linked to the account (guest orders by the same email are not included); an admin cannot change their own status (400) and admins are not manageable through this endpoint (404).
- **Contact**: needs SMTP **and** `CONTACT_TO`; otherwise 503 `email_unavailable`; SMTP failure → 502 `email_failed`; success only after the SMTP server accepts; honeypot field `website` → 400.
- **Public config shape** (`GET /api/cart/config`): `currency, currencySymbol, locale, storeName, shipping{flatRate,freeThreshold}, contact{formEnabled,email,phone,address}, returns{windowDays}, promoCode`.
- **New env variables**: `STORE_NAME, CURRENCY, CURRENCY_LOCALE, SHIPPING_FLAT_RATE, FREE_SHIPPING_THRESHOLD, PROMO_CODE, STORE_EMAIL, STORE_PHONE, STORE_ADDRESS, RETURN_WINDOW_DAYS, CONTACT_TO, MONGO_TRANSACTIONS (auto|off), MONGO_MAX_POOL_SIZE`. Existing ones kept (`SMTP_*`, `MAIL_FROM`, `JWT_*`, `CLIENT_URL`, `COOKIE_SAMESITE`, `UPLOADS_DIR`, `CLOUDINARY_*`). `PROMO_CODE` defaults to `VORTEX10` only outside production when the variable is absent.

---

## D. Remaining Phase 7 tasks

1. **Pages**: FAQ, Contact, Privacy, Returns. Use the existing design (`container-x`, `SectionHeading`, `Field`, brand classes). Policy text must be **clearly marked placeholder** (visible banner + highlighted `[[PLACEHOLDER …]]` fragments), editable in one file, never inventing legal guarantees. Facts that are verified true of this app and may be stated: payment is Cash on Delivery only; customers can cancel their own order while it is `pending` or `confirmed` (staff can cancel up to `processing`); guests can track an order with order number + email; cart, wishlist and applied coupon are kept in the browser's localStorage (`vortex_cart`, `vortex_wishlist`, `vortex_coupon_code`); login uses the httpOnly cookie `vortex_token`; no analytics/ad scripts were found in the client; contact messages are emailed and not stored. Retention periods, legal bases, rights, jurisdiction, courier/provider names, refund method and return conditions must stay placeholders.
   - Contact page: use `useShopSettings()` (`loaded` flag) so the form is not shown as "unavailable" before the settings arrive; when `loaded && !contact.formEnabled` show an honest notice (+ `STORE_EMAIL` if set) instead of the form; accessible labels, `aria-invalid`, `role="alert"`/`role="status"`, hidden honeypot field `website`.
2. **Routes + navigation** in `client/src/App.tsx` (storefront pages under the existing layout; admin pages under `/admin`), and sidebar links in `pages/admin/AdminLayout.tsx`.
3. **Admin Coupons UI** (WRITTEN, not compiled or run; see VORTEX_PROGRESS.md section 29): list with search + status filter, create/edit form (type, value, minimum, expiry date, usage limit, active toggle), delete only when `canDelete`, otherwise offer "Deactivate"; label money fields with `currencySymbol`; follow the pattern in `pages/admin/Categories.tsx` and `ConfirmDialog`.
4. **Admin Customers UI + detail page** (WRITTEN, not compiled or run; see VORTEX_PROGRESS.md section 29): list with search, status filter and pagination (follow `pages/admin/Orders.tsx`); detail with profile, stats and order history; activate/deactivate with confirmation; show "cannot change your own account" errors.
5. **Currency re-render**: `formatPrice` is not reactive. Plan: in `App.tsx` wrap the `<Suspense><Routes/></Suspense>` in a small component that calls `useShopConfig()`, then `setMoneyFormat(...)` and uses `key={`${currency}|${locale}`}` so pages re-render once when non-default settings arrive. Also grep the admin pages (Dashboard, Orders, OrderDetail, ProductForm) for hardcoded `$`.
6. **Newsletter**: the "Join the pack" form on the home page shows "You are on the list" but stores/sends nothing and promises "10% off your first order" with no matching coupon. Intended fix (the edit failed and is **not applied**): add `const NEWSLETTER_ENABLED = false;` near `ICONS` in `pages/Home.tsx` and render `{NEWSLETTER_ENABLED && <Newsletter />}`; report it to the owner as a deliberate removal of an unsupported promise, with a note on how to re-enable it.
7. **Also in Home**: the "Up to 30% off selected gear" heading is marketing copy tied to demo sale prices; left as-is, mention it to the owner.
8. **README / docs** (none exists): overview, architecture, client + server setup, local MongoDB, **local single-node replica set** (see E), Atlas setup (placeholders only), env variable table, seeding, admin creation and password reset, running tests, production configuration (`NODE_ENV=production`, secrets, CORS, cookies), known limitations. Add `client/.env.example` notes if needed.
9. **Security/config work still open**: re-read `app.js` CORS/helmet settings and confirm nothing regressed; confirm upload restrictions unchanged; decide whether to raise the 8-character customer password minimum (admin script uses 10) — owner has not asked; review logging of unexpected errors (`console.error(err)`) for sensitive data.
10. **Dependency advisories** (from a read-only `npm audit` on the lock files; nothing changed): server `nodemailer` (high; the suggested fix is a **major** upgrade — check the changelog/compatibility first, and note the code now rejects quoting/list characters in recipient addresses); client `vite` (high, dev-server only; fix is a major upgrade), `react-router-dom` and `esbuild` (moderate; fixes are major upgrades). **Never** run `npm audit fix --force`. Upgrading requires `npm install` locally so the lock file stays consistent.
11. **Product images**: keep the Unsplash demo images (owner decision). Verified in source: `ProductCard` and `ProductDetail` render images through the `Img` component, which provides a fallback. Real photography still needs to be supplied by the owner; `client/scripts/check-images.mjs` (`npm run check:images`) exists. If seed images ever change, `server/tests/seed.test.mjs` asserts Unsplash URLs and must be updated.
12. **Final verification and report** (section E).

---

## E. Testing status

**Phase 7 has NOT been tested.** No Phase 7 test, existing test, TypeScript check or build was run after the Phase 7 edits. The owner reported 248/248 backend and 14/14 admin-account tests *before* Phase 7; the state after is unknown. Specific unverified assumptions in the new test files (fix the tests if these are wrong, do not weaken the product code):
- They use these `setupApi` helper members from `tests/helpers.mjs`: `call` (returning `{status, body, headers}`; `csrf:false` option), `models`, `mongoose`, `users`, `adminCookie`, `aliceCookie`, `bobCookie`, `line()`, `orderBody()`, `product()`, `stockOf()`, `close()`, plus an exported `login()`. Existence/semantics of each was recalled from reading the file earlier and **not re-verified**.
- `customers.admin.test.mjs` assumes `?q[$ne]=x` yields 400 (it may be removed by the sanitize middleware and return 200).
- `phase7.test.mjs` forces a 500 by stubbing `Product.find`; the products route may use another query method.
- Client TypeScript has not been compiled: widening `ShopConfig`, replacing `WHY_US` with `whyUs()` and the rewritten `useShopConfig` may break other importers.

### Verification commands (PowerShell)
```powershell
# 1) Backend suite against standalone local MongoDB (transaction-only tests will SKIP)
cd C:\Users\ZIAD\Desktop\vortex-source\vortex\server
$env:MONGO_TEST_URI = "mongodb://127.0.0.1:27017/vortex_test"   # the DB name must contain "test"
npm test

# 2) New files only
node --test tests/settings.test.mjs tests/coupons.admin.test.mjs tests/customers.admin.test.mjs tests/contact.test.mjs tests/transactions.test.mjs tests/phase7.test.mjs

# 3) Frontend type check + production build
cd C:\Users\ZIAD\Desktop\vortex-source\vortex\client
npx tsc -b
npm run build
```
Replica-set run (needed for the transaction-only tests) — **standard MongoDB commands, not yet verified on this machine**; adjust paths/`mongosh` availability:
```powershell
mkdir C:\data\rs0 -Force
mongod --replSet rs0 --dbpath C:\data\rs0 --port 27018 --bind_ip 127.0.0.1
# in a second window, once:
mongosh --port 27018 --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'127.0.0.1:27018'}]})"
# then:
cd C:\Users\ZIAD\Desktop\vortex-source\vortex\server
$env:MONGO_TEST_URI = "mongodb://127.0.0.1:27018/vortex_test?replicaSet=rs0"
node --test tests/transactions.test.mjs
npm test
```
The console line `[transactions] MongoDB transactions supported: true/false` in the transactions test shows which mode ran.

Also manually check (cannot be automated here): storefront navigation and footer links, product browsing/detail, cart, checkout, auth, wishlist, order tracking, admin dashboard, responsive layout, no broken images, no console errors, no API errors in normal flows.

---

## F. Important project decisions (all approved by the owner — preserve them)
- USD is the default currency; currency/locale/shipping must be configurable (`CURRENCY`, `CURRENCY_LOCALE`, ...), so EGP can be used later.
- Business contact details and policy/return text use **clearly marked placeholders**; make business-specific terms configurable or easy to edit.
- Remove unsupported promises (e.g. the 30-day returns guarantee, hardcoded "$100" claims).
- Contact messages are **email-only, never stored in MongoDB**; if SMTP (or `CONTACT_TO`) is missing the form must say so honestly and never claim a message was sent.
- Keep the current Unsplash demo images until real photography is supplied.
- Use MongoDB transactions when supported (replica set / Atlas) with a safe fallback on standalone local MongoDB; local development must not require Atlas or SMTP credentials.
- Preserve the existing UI, branding, layout, typography and responsive behaviour; do not redesign.
- **No deployment. No AI features. No online payment integration. No destructive database operations. Never `npm audit fix --force`.** Avoid new dependencies and unjustified major upgrades. Never expose secrets or `.env` contents.

---

## G. Instructions for the next Claude account

Paste this as your first message:

```
I am continuing PHASE 7 of my VORTEX sportswear e-commerce project. The project is at
C:\Users\ZIAD\Desktop\vortex-source\vortex   (backup: C:\Users\ZIAD\Desktop\vortex-source\vortex-phase7-handoff-backup)
A previous Claude session saved a handoff report at C:\Users\ZIAD\Desktop\vortex-source\PHASE7_HANDOFF.md.

Rules for this session:
1. Read PHASE7_HANDOFF.md first, completely.
2. Inspect the actual project files before changing anything. Do not trust the report over the code.
3. Continue from the saved state. Do NOT restart Phase 7 and do not rewrite working modules.
4. Preserve all existing functionality and the current VORTEX UI (colors, typography, layout, responsiveness).
5. Complete the remaining Phase 7 work listed in section D of the report, respecting the decisions in section F.
6. Run the required checks: backend tests (standalone Mongo, and a local replica set for the transaction tests),
   `npx tsc -b`, and `npm run build` in the client. If you cannot run commands on my machine, tell me exactly which
   commands to run and wait for my pasted output (or mirror the project into your own sandbox and say so).
7. Report exact results, including failures and remaining issues. Fix regressions before continuing.
8. Never claim anything is implemented, working or tested unless you verified it. Do not invent test results.
9. Never print or send my .env contents. Do not deploy. Do not run destructive database operations.
Start by listing which files from section C exist on disk and whether they match the report, then proceed with section D.
```

### Practical notes for the next session
- The assistant's shell may be a separate sandbox, not the owner's PC. File reads/writes to the project may go through a filesystem connector; the copy tool flattens directory structure and renames duplicates (`index.js` becomes `index_1.js`), so mirror carefully.
- In a previous sandbox, a real `mongod` 8.0 could be installed from conda-forge using micromamba and started on a spare port (also as a single-node replica set via `replSetInitiate`) to run the backend suite; client `tsc`/`vite build` needs the whole client mirrored plus `npm install`.
- Windows/PowerShell paths are used throughout; the project uses ES modules (`"type": "module"`) on both sides.
