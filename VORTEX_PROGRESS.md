# VORTEX — Progress Tracking (Permanent Handoff)

Last updated: 2026-11-22 (later sessions). CURRENT STATUS: Phase 7 is NOT complete. Admin Coupons and Customers screens are written but not compiled or run. The seed database guard is implemented (sections 31 and 32). Nothing in this session was executed: no seed, tests, builds or ZIP script. The image sourcing plan is awaiting owner approval; no images have been changed (section 32). Sections 1-18 and the early parts of sections 5-17 and 21-23 are HISTORICAL. Where they conflict with this header or with sections 28 onward, the later sections are current.

## 1. Project overview
VORTEX is a sportswear e-commerce store (Cash on Delivery only).
- client/: React 18.3, TypeScript 5.6, Vite 5, Tailwind 3, react-router-dom 6, lucide-react, @fontsource fonts.
- server/: Node.js ES modules, Express 4.21, Mongoose 8.9, express-validator 7, helmet 8, express-rate-limit 7, jsonwebtoken 9, bcryptjs 2, multer 1.4.5-lts, sharp, nodemailer 6.9, slugify, cloudinary (config only).
- Auth: JWT in httpOnly cookie `vortex_token` (7 days), bcrypt cost 12, `tokenVersion` invalidates sessions on password change, user reloaded from DB on every request.
- Not deployed. Do not deploy. No AI features. No online payments.

## 2. Architecture (verified from code)
- Server layers: routes -> controllers -> services -> models; plus validators, middleware, utils, config/settings.js.
- All money (price, sale price, coupon discount, shipping, total) computed on server (services/pricing.js). Client sends only product/size/colour/quantity/coupon code.
- Stock reserved atomically with conditional updates (Product.reserveStock). MongoDB transactions when replica set; compensating rollback on standalone.
- Idempotent checkout: client key + CheckoutAttempt model (TTL 24h) + unique idempotencyKey on Order.
- Admin API under /api/admin, guarded by router-level requireAdmin. Writes also under /api/products and /api/categories with requireAdmin.
- CSRF defence: every non-GET /api request must send `X-Requested-With: vortex-web` (middleware/csrf.js). Client http.ts sends it.
- Client data layer: services/http.ts -> services/api.ts (shop), services/shop.ts (cart, orders, contact, lastOrder), services/auth.ts, services/admin.ts.
- Client state: contexts (Auth, Cart, Wishlist, Toast). Cart and wishlist in localStorage; coupon code in localStorage.

## 3. Current development phase
Phase 7 partly written (PHASE7_HANDOFF.md). Its backend tests were included in the owner's CA-01 run (see below), but Phase 7 is not complete.
- Server Phase 7 code EXISTS: config/settings.js, utils/transaction.js, controllers/couponController.js, controllers/customerController.js, controllers/contactController.js, validators (coupon, customer, contact), routes (admin coupons/customers, /contact), tests (settings, coupons.admin, customers.admin, contact, transactions, phase7).
- Client Phase 7 code PARTIALLY exists: useShopConfig (settings), storeText.ts, Footer/AnnouncementBar/Home/ProductDetail use config, services for coupons/customers/contact.
- Phase 7 NOT done: "$" cleanup in admin pages (not started); compile, build and browser verification of the admin Coupons and Customers screens (written, see section 29, not compiled or run). README now exists (section 30). The currency re-render gate is written (section 28) but not browser-verified. Implemented since this list was written, per saved history: Contact, FAQ, Privacy and Returns pages with routes (batch B2, section 24); newsletter hidden (decision 9, section 19). This implementation is not browser-verified and not build-verified after batch B2 (section 21).
- The owner's CA-01 full-suite run included the Phase 7 backend tests (348 tests, 0 failed on standalone and replica-set MongoDB; section 27). That run does not confirm any individual Phase 7 assertion, does not make all Phase 7 work complete, and does not establish that any frontend change (including batch B2) passed TypeScript or production build.

## 4. Working directory rule
Only F:\vortex. No copies. Do not touch other VORTEX directories.

## 5. Audit scope status (ALL COMPLETED)
Client, every file read:
- pages: Account, Cart, Checkout, Home, Login, NotFound, OrderConfirmation, OrderDetail (customer), ProductDetail, Register, Shop, TrackOrder, Wishlist
- pages/admin: AdminLayout, Categories, Dashboard, OrderDetail, Orders, ProductForm, Products
- components (21): AnnouncementBar, CartDrawer, ConfirmDialog, ErrorState, Field, FilterPanel, Footer, Img, Layout, Logo, Navbar, OrderView, Pagination, ProductCard, ProductGrid, QuantitySelector, Rating, Reveal, RouteGuards, SectionHeading, StatusBadge
- context (4): AuthContext, CartContext, ToastContext, WishlistContext
- hooks (6): useAsync, useCartQuote, useCategories, useDocumentTitle, useLocalStorage, useShopConfig
- services (5): admin, api, auth, http, shop
- data (3): catalog.ts, content.ts, images.ts
- utils (3): format, safeNext, storeText
- types/index.ts, index.css, tailwind.config.js, postcss.config.js, tsconfig.json, vite.config.ts, index.html, main.tsx, App.tsx, scripts/check-images.mjs
- NOT read: client/.env.example (allowed but not needed), client/package-lock.json, server/package-lock.json (large generated lock files).

Server, every file read:
- index.js, app.js, config/ (env, db, settings)
- middleware/ (7): auth, csrf, errorHandler, rateLimiter, sanitize, upload, validate
- routes/ (8), controllers/ (9), services/ (5), models/ (8)
- utils/ (11): ApiError, asyncHandler, currency, duration, money, objectId, orderNumber, productQuery, serializers, tokens, transaction
- validators/ (7): auth, category, contact, coupon, customer, order, product
- seed/ (4): adminAccount, catalog, createAdmin, seed
- .env.example (placeholders only, allowed)

Tests: 22 test files plus helpers.mjs (NOT 21 as previously stated). All read:
admin, adminOrders, auth, authGuard, checkout, contact, coupons.admin, createAdmin, customers.admin, db, mailer, orders, permissions, phase3, phase7, productQuery, products.api, rateLimit, seed, settings, trackLimit, transactions.

## 6. Test suite inventory (what each file verifies; NOT executed)
- helpers.mjs: test DB per file (name must contain "test"), HTTP client, setupApi (seeds, creates admin/alice/bob and logs them in).
- admin.test: dashboard stats, admin lists incl. hidden items, image upload safety (type sniffing, SVG/GIF rejection, 5MB and decompression-bomb limits, EXIF stripping, hostile filenames, file cleanup), createAdmin script.
- adminOrders.test: order permissions, search/filters/dates, regex safety, strict status transitions, concurrent status change, admin cancel restores stock, low-stock warnings.
- auth.test: register/login/session/profile/password change, mass-assignment protection, NoSQL injection, deactivation ends sessions, forged tokens, CSRF header, demoted admin loses access.
- authGuard.test (no DB): every admin route 401 when anonymous, forged/alg:none/expired tokens rejected, production cookie flags.
- checkout.test: server pricing, free-shipping-after-discount, stock problem reporting, coupon rules, checkout validation, guest and logged-in checkout, snapshots, idempotency, 10-way double-click, concurrency (15 shoppers for 5 units, multi-item rollback).
- contact.test: contact form honesty (503/502/200), no storage, header injection, honeypot, no-store header.
- coupons.admin.test: coupon CRUD rules, used-coupon locks, usage limits, checkout enforcement, parallel usage limit.
- customers.admin.test: customer list/detail, cancelled orders not counted as spent, no sensitive fields, activate/deactivate, self-protection. KNOWN DEFECT: asserts `meta.pages`, API returns `meta.totalPages` -> this assertion will fail.
- db.test: model rules, bcrypt hashing, unique indexes, reservation races, review aggregation, order total integrity.
- mailer.test (no DB): confirmation email content, HTML escaping, timeouts, coupon/shipping maths.
- orders.test: owner-only order view, cancel exactly once, cancel race, guest tracking, guest cancel, rate-limited lookup behaviour.
- permissions.test: anonymous/customer/admin on all protected routes, refused requests change nothing.
- phase3.test (no DB): HTTP basics, headers, body limits, CORS, sanitize, model validation, error handler mapping.
- phase7.test: public config allow-list, no-store headers, no reset endpoints, error responses hide stacks, currency formatting, mail address safety.
- productQuery.test (no DB): paging, sorting, filters, regex escaping, word-start search.
- products.api.test: product/category read API, filters, search, sorting stability, admin product/category CRUD, stock editing, mass-assignment protection.
- rateLimit.test: 10 failed logins per 15 min -> 429; successful logins not counted.
- seed.test: seeded data counts, variant mix, reviews computed from documents, demo reviewers cannot log in, reseed idempotent.
- settings.test (no DB): settings validation and defaults, email address rules.
- trackLimit.test: 10 failed lookups -> 429.
- transactions.test: transaction helper, fallback behaviour, checkout/cancel atomicity, replica-set-only tests skip on standalone.

## 7. Verified bugs (from code reading; NOT yet run)
Severity: H = high, M = medium, L = low.

Frontend
- BUG-01 (H) Broken routes: Footer.tsx links to /faq, /contact, /privacy, /returns; ProductDetail.tsx and content.ts link to /returns. App.tsx defines none of them -> 404.
- BUG-02 (H) Fake newsletter: Home.tsx Newsletter shows "You are on the list" and stores/sends nothing; copy promises "10% off your first order" but seeded coupons are only VORTEX10 (any order) and WELCOME15 (min $50). Phase 7 hide edit NOT applied (no NEWSLETTER_ENABLED in file).
- BUG-03 (H) Fabricated testimonials: data/content.ts TESTIMONIALS (Marcus T., Sara A., Daniel R., Lina M.) rendered on Home as customer quotes under "Athletes love VORTEX".
- BUG-04 (H before launch) Fabricated demo reviews: seed/catalog.js creates 3-5 reviews per product by fictional reviewers (Omar K., Nour H., ...) shown as "Customer reviews" with ratings on ProductDetail and product cards. Must be removed or clearly labelled before any real use.
- BUG-05 (M) False promo claim: Home.tsx Promo heading "Up to 30% off selected gear". Seeded sale discounts are 19%, 23%, 19%, 23% (max 23%): Surge 34/42, Velocity 49/64, Nova 29/36, Pro Cap 20/26.
- BUG-06 (M) Hardcoded "$" (currency inconsistency with configurable CURRENCY): admin/ProductForm.tsx labels "Price ($)" and "Sale price ($, optional)"; Shop.tsx active-filter chip `$${min} - $${max}`; FilterPanel.tsx price labels `$${min}` and `$${max}`.
- BUG-07 (M, only when non-USD configured) formatPrice is not reactive: format.ts is a module-level formatter; components that do not subscribe to useShopConfig keep the old currency until they re-render for another reason.
- BUG-08 (M) Category visibility does not hide products: admin Categories "Visible in the store" only affects GET /categories. buildFilter/listProducts and findPublic ignore category.isActive, so products in a hidden category stay visible, searchable and orderable.
- BUG-09 (M) Stock overwrite from stale admin form: admin/ProductForm.tsx sends absolute stock values for variants the admin edited, computed from a snapshot loaded when the page opened. Concurrent sales of that variant are overwritten (oversell risk). Other variants are protected.
- BUG-10 (M) Wishlist data loss above 50 items: services/api.ts byIds slices to 50 and Wishlist.tsx retain() removes every saved id not returned, so items beyond 50 are silently deleted from localStorage.
- BUG-11 (L-M) Product card hover placeholder: ProductCard.tsx renders second image as `<Img src={p.images[1]}>`; with one image, Img shows the branded gradient "VORTEX" placeholder on hover over the first image. Admin requires only 1 image, so this will happen.
- BUG-12 (M) Hardcoded product copy for every product: ProductDetail.tsx "Details & Care" says "Moisture-wicking performance fabric ... Machine wash cold ... Do not iron over printed logos" for every product (including Core Duffel Bag, Grip Training Gloves, Hydra Shaker Bottle). Content is not product-specific and may be false.
- BUG-13 (L-M) Placeholder links presented as real: Footer social links go to generic https://instagram.com, facebook.com, x.com, youtube.com; Home InstagramGallery links to instagram.com and shows "@vortex.sportswear".
- BUG-14 (L) Home "Why choose us" claims "tested for real training" (content.ts) and "Your details are protected end to end" (unverified claims).
- BUG-15 (L) Shop.tsx debounced search calls `patch` with the params captured at render time; a sort or filter change made within 300 ms can be overwritten.
- BUG-16 (L) Wishlist.tsx retain effect can drop an item added while an earlier byIds request is still in flight (race).
- BUG-17 (L) Navbar.tsx shows the Admin link only in the mobile menu; desktop admins have no direct link (only via Account page).
- BUG-18 (L) ToastContext.tsx: setTimeout for dismiss is not cleared on unmount.
- BUG-19 (L) Checkout.tsx: `useRef(newKey())` calls crypto on every render (value discarded after first). Performance nit only.

Backend
- BUG-20 (M) Account enumeration on register: errorHandler.js maps duplicate email to 409 "That email is already in use"; Register.tsx shows "An account with this email already exists". (Same as SEC-01.)
- BUG-21 (M) Stock race in admin product update: productController.update, when sizes or colours change without variants, reads current variants and writes them back (read-modify-write), which can overwrite concurrent reservations.
- BUG-22 (L) Stuck idempotency claim after crash: orderService.createOrder claims the key before placeOrder; if the process crashes after claim, retries with the same key wait ~10 s then return 409 until the key expires (24 h). Client mitigates by generating a new key per checkout visit.
- BUG-23 (L) Duplicate constant CUSTOMER_CANCELLABLE in models/Order.js and utils/serializers.js (drift risk).
- BUG-24 (L) Unused text index on Product (name, description); search uses regex (productQuery.js).
- BUG-25 (L) Cloudinary configuration parsed in config/env.js but never used by imageService.js.
- BUG-26 (L) tsconfig.tsbuildinfo (generated) is not listed in .gitignore.
- BUG-27 (L) index.js: process.on('unhandledRejection') calls process.exit(1), so any stray rejection takes the API down (availability risk).
- BUG-28 (L) seed/seed.js deletes all products, categories, reviews and demo users on every run (guarded in production by --force).

Tests
- BUG-29 (test defect; FIXED in batch A2, see section 22; historical): customers.admin.test.mjs asserted `meta.pages`; the API returns `meta.totalPages`. Assertion corrected. No failure of this test was reported in the CA-01 standalone or replica-set runs (owner-run, section 27).
- BUG-30 (to verify at runtime) customers.admin.test expects `?q[$ne]=x` to return 400; sanitize.js strips `$`-keys before validation, so the result depends on validator behaviour on the cleaned value. Needs a run.

## 8. Security concerns (from code reading)
- SEC-01 (M) Account enumeration on register (see BUG-20). Login itself is generic (good).
- SEC-02 (M) Logout does not revoke the token server-side. authController.logout only clears the cookie; a copied token remains valid until expiry (7 days) or a password change.
- SEC-03 (M) Brute-force protection is per IP only, in memory (express-rate-limit default store). No per-account lockout. Distributed attacks are not limited. Limits reset on restart and are not shared between instances.
- SEC-04 (M) Product and category image URLs accept any https:// URL (productValidators.js IMAGE_URL, categoryValidators.js IMAGE_URL). Admin-only, but this allows tracking pixels or unexpected third-party content.
- SEC-05 (L-M) Dependency advisories not yet checked: multer 1.4.5-lts (known older line), nodemailer, vite, react-router-dom, esbuild (per handoff). Requires `npm audit` run by owner. Never `npm audit fix --force`.
- SEC-06 (L) Idempotency replay returns the full order (name, phone, address, items) to any caller who has the key and matching email (orderService.replay). Key is client-generated, 16-64 chars.
- SEC-07 (L) Client stores full order details in sessionStorage after checkout (shop.ts lastOrder). Personal data in browser storage.
- SEC-08 (L) No Content-Security-Policy on the client (index.html). Relevant once deployed as static files; not an issue in dev.
- SEC-09 (L) BACKUP_INFO.txt says the backup folder contains .env files with secrets. Handle that backup as sensitive. Do not share or copy it.
- SEC-10 (L) Guest order tracking: 8-character order suffix (32-character alphabet) plus email; lookups limited to 10 failures per 15 min per IP. Acceptable, but depends on per-IP limit (see SEC-03).
- SEC-11 (L) Guest cancellation by number + email (POST /orders/lookup/cancel) has no second factor; anyone holding both can cancel while status is pending/confirmed. Design decision for owner.
- SEC-12 (L) Customer order list and order details are returned with customer phone/email/address to guests via lookup (by design, but document it).
- SEC-13 (L) Error handler logs full error objects for 5xx to console (may contain request data). Production response is generic (good).
- SEC-14 (INFO, positive) Verified strengths: httpOnly cookie, sameSite lax, secure in production, algorithm pinned HS256, role never taken from client, mass assignment blocked on profile/product/coupon/order, NoSQL key stripping, regex escaping in search, file type sniffing and re-encoding for uploads, CORS allow-list, helmet, X-Powered-By disabled, no-store on sensitive routes, SMTP error codes only in logs, header-injection defence in mail.

## 9. Missing features (verified absent)
- Pages: /faq, /contact, /privacy, /returns were missing when this list was written. They are now implemented per batch B2 (section 24) and the footer links (section 25). This is not browser-verified and not build-verified after batch B2. Phase 7 plan exists in PHASE7_HANDOFF.md section D1.
- Admin UI for coupons: WRITTEN (section 29): client/src/pages/admin/Coupons.tsx, route in client/src/App.tsx, sidebar link in client/src/pages/admin/AdminLayout.tsx. Not compiled or browser-tested.
- Admin UI for customers: WRITTEN (section 29): client/src/pages/admin/Customers.tsx and CustomerDetail.tsx, routes in client/src/App.tsx, sidebar link in client/src/pages/admin/AdminLayout.tsx. Not compiled or browser-tested.
- Password reset by email (no route, test phase7 asserts none exists).
- Writing product reviews (Review model exists; no create endpoint; reviews only come from seed).
- README / setup documentation (none).
- Order status emails (only the initial confirmation exists).
- Cloudinary upload path (config only).
- Real newsletter storage or provider integration.
- Customer account: saved addresses (single address on profile only).
- Admin category image upload (URL only).

## 10. Runtime checks: items 1–2 complete (CA-01, owner-run); items 3–11 remain open (not run by Claude)
Owner must run on the Windows PC (or confirm the sandbox run is labelled as sandbox):
1. [DONE, CA-01, owner-run] `npm test` on standalone MongoDB 8.2.7 (port 27019): 348 tests, 345 passed, 0 failed, 3 skipped (replica-set-only). See section 27.
2. [DONE, CA-01, owner-run] `npm test` on replica set rs0, MongoDB 8.2.7 (port 27020, state PRIMARY): 348 tests, 348 passed, 0 failed, 0 skipped. See section 27.
BUG-29 status: the assertion fix (batch A2) is applied. No failure of customers.admin.test.mjs appears in either CA-01 run. This is verified only by those owner-run results. The earlier text expecting BUG-29 to fail is superseded.
3. `npx tsc -b` and `npm run build` in client/. Check for TypeScript errors (possible: React.* type references without import in FilterPanel.tsx, Checkout.tsx, Account.tsx; OrderConfirmation useAsync union typing).
4. `npm run check:images` (needs internet; verifies Unsplash IDs in client/src/data/images.ts and server seed).
5. `npm audit` in server/ and client/ (read-only; never --force).
6. Browser run (dev servers): full guest checkout, logged-in checkout, coupon apply/remove, cart quantity limits, wishlist >50 items, product hover with one image, filters and price labels, mobile menu, cart drawer, admin product edit and stock save, admin order status flow, image upload.
7. Currency switch test: set CURRENCY=EGP, CURRENCY_LOCALE=ar-EG in a local .env (owner does this; do not share) and check every price, label and email.
8. Concurrency under real load (beyond unit tests): many simultaneous checkouts.
9. SMTP behaviour against the real provider (order email, contact form).
10. Cookie behaviour through the Vite proxy in dev and on the real domain (sameSite, secure).
11. Verify seeded demo data displays correctly (variants, low stock, sale badges).

## 11. Prioritized repair plan (proposal — awaiting owner approval; NO code changed yet)
P0 — Baseline (owner runs commands; no code change)
- Server tests: DONE in the owner-run CA-01 (standalone 348 tests, 345 passed, 3 skipped; replica set 348 tests, 348 passed; section 27). tsc and build: owner-reported as passed after the first Session 3 client edits only (historical; section 21). npm audit: NOT run.

P1 — Critical trust and security (small, targeted)
- BUG-01 + Phase 7 pages: IMPLEMENTED in batch B2 (section 24) and the footer links (section 25). Not browser-verified. Not build-verified after batch B2 (section 21). Pending: owner replacement of placeholder content.
- BUG-02: IMPLEMENTED in code. The newsletter is removed from the home page render and its component code is deleted (section 20; decision 9). The NEWSLETTER_ENABLED flag was never used; do not rely on it. Build status of this change is historical and uncertain (section 21).
- BUG-03 and BUG-04: IMPLEMENTED in code. Fabricated testimonials removed (Session 3, section 20). Seeded reviews and ratings removed from display and from seeding (batch B1, section 22). REMAINING: existing fabricated Review documents in already-seeded databases are not deleted and need owner approval (section 22 caveat). Frontend parts not build-verified after batch B1 (section 21).
- BUG-05: IMPLEMENTED in code. The promo headline now reads "Selected gear at a lower price" (section 20). Build status historical and uncertain (section 21).
- SEC-01 / BUG-20: return one generic message for register conflicts (and keep the UX hint without confirming the account).
- SEC-02: decide revocation design (per-session id or tokenVersion bump on logout). Owner decision: logout-everywhere vs per-device.
- SEC-03: add per-account failed-login limiter (in addition to IP). Design decision on thresholds.
- SEC-04: restrict image URLs to https allowlist or /uploads only, if owner agrees.
- SEC-05: run npm audit; plan upgrades with risk notes (no --force).

P2 — Correctness (high-value fixes)
- BUG-06 and BUG-07: remove hardcoded "$" and make currency reactive (App-level re-render on config load).
- BUG-08: decide semantics of hidden categories; then enforce in listProducts/findPublic.
- BUG-09 and BUG-21: make admin stock edits atomic (delta-based or versioned) and remove read-modify-write on variants.
- BUG-10: paginate or chunk wishlist fetches; never retain-delete ids that were not confirmed missing.
- BUG-12 and BUG-13: PARTLY IMPLEMENTED. The generic care accordion is removed (batch B2). Footer social links and the gallery's Instagram links are removed (Session 3). REMAINING: generic brand claims in content.ts and product descriptions (CA-15, CA-17), and the gallery's stock photos (CA-02).
- BUG-11: show only the first image on hover when there is no second image.
- BUG-15, BUG-16: fix stale closure and race in Shop search and Wishlist retain.

P3 — Missing features (after P1 and P2; each needs an approved scope)
- Admin Coupons UI and Admin Customers UI: WRITTEN (section 29); need owner compile, build and browser testing.
- Password reset (needs email token design; owner approval first).
- Product reviews (needs scope decision: who may review, moderation).
- README and setup documentation.

P4 — Quality and cleanup
- BUG-29: DONE (batch A2). No failure of this test was reported in the CA-01 runs, which covered the full suite; the individual assertion has not been separately confirmed. BUG-30: no failure reported in the CA-01 runs; treat as passing in those runs only (section 27).
- BUG-22 (stuck idempotency claim), BUG-23 (duplicate constant), BUG-24 (unused index), BUG-25 (Cloudinary decision), BUG-26 (.gitignore), BUG-27 (process exit policy), BUG-28 (seed safety wording).
- BUG-17 (admin link on desktop), BUG-18 (toast timers), BUG-19 (key generation).

Items needing owner decision before work: demo reviews policy (decided: remove, section 19 item 2; the database cleanup of existing reviews still needs owner approval, section 22 caveat); hidden-category semantics (BUG-08); logout revocation design (SEC-02); password reset design; reviews scope; placeholder vs real business content for policy pages and social links.

## 12. Files created so far (HISTORICAL, as of Session 2; current list in section 32)
- F:\vortex\VORTEX_PROGRESS.md (this file)
- [HISTORICAL, as of Session 2 only. Later files are listed in section 32.]

## 13. Files modified so far (HISTORICAL, as of Session 2; current list in section 32)
- [HISTORICAL, as of Session 2] None. No application source code had been changed at that time. Later changes are listed in section 32 and in `handoff/CHANGELOG.md`.

## 14. Environment limitations
- Filesystem tools operate on the owner's Windows machine (F:\vortex).
- bash_tool runs in a separate Linux sandbox, NOT on the owner's PC. Results from it must be labelled as sandbox results.
- Claude cannot run npm/node on the owner's PC unless the owner runs commands and pastes output.

## 15. Baseline tests (reported by owner, Windows PC, Session 3)
VERIFIED ON OWNER'S WINDOWS MACHINE (owner-reported; not executed by Claude):
- Backend `npm test` (server/): reported ALL PASSED at the time. Exact pass/fail counts were NOT supplied at the time (historical; counts were later supplied in section 27). Database used at the time: NOT stated.
- Frontend `npx tsc -b` (client/): reported PASSED.
- Frontend `npm run build` (client/): reported PASSED.

OPEN QUESTIONS ON BASELINE (historical list; questions 2 and 3 are addressed in part by the CA-01 runs below):
1. Did the owner run these BEFORE or AFTER the Session 3 client edits (Home.tsx, content.ts, Footer.tsx)? If before, tsc/build do not cover those edits.
2. (Answered in part by CA-01, section 27.) The owner's CA-01 backend run (`npm test`, which runs all test files) reported 0 failures on standalone and on the replica set. No per-file breakdown was supplied, so the result of customers.admin.test.mjs is not separately confirmed beyond that run total.
3. (Answered in part by CA-01, section 27.) The replica-set run reported 0 skipped tests in total, so the three replica-set-only transaction subtests were not skipped on that run. The `[transactions] MongoDB transactions supported:` line was not supplied and has not been observed.
4. Were the `npm audit` checks run? (Not reported.)

No Claude-run test result exists in this file. Questions 1 and 4 remain open. The CA-01 runs did not cover the frontend or npm audit.

## 16. Current task
As of the CA-01 verification (section 27), the owner-run database test verification is COMPLETE.
Current activity: documentation consistency cleanup only.
The earlier text in this section is historical. Baseline counts were supplied later (section 23). No audit item is in progress. CA-02 and later items are not started.

## 19. Owner decisions (approved)
1. Remove fabricated testimonials. DONE (client).
2. Remove fabricated product reviews and ratings from display. IMPLEMENTED in code (batch B1, section 22): the seed creates no reviews; ProductDetail and ProductCard show reviews and ratings only when reviewCount > 0. REMAINING: (a) existing fabricated Review documents in already-seeded databases are not deleted and need owner approval (section 22 caveat); (b) the frontend change is not covered by an owner-reported tsc or build run (section 21); (c) no browser check has been done.
3. Hidden categories -> products unavailable in listings, search, direct access, checkout (enforce on backend). PENDING.
4. Logout revokes current session only. PENDING.
5. Password reset by email (hashed single-use expiring token, rate limited). PENDING.
6. Product reviews: only verified completed purchasers, no duplicates, moderation. PENDING.
7. FAQ, Contact, Privacy, Returns pages with clearly marked editable placeholders. IMPLEMENTED in code (batch B2, section 24; footer links, section 25). REMAINING: (a) the placeholders in client/src/data/policies.ts and the Contact page text must be replaced with real business information by the owner; (b) legal review of the final policy text is an owner decision; (c) the B2 and footer changes are not covered by an owner-reported tsc or build run (section 21); (d) no browser check has been done.
8. Hide generic social links. DONE (Footer.tsx).
9. Hide newsletter completely. DONE (removed from Home.tsx render; component code removed).
10. USD default, configurable currency kept. Unchanged.

## 20. Changes made in Session 3
- client/src/pages/Home.tsx: removed Testimonials, Newsletter, Instagram links and '@vortex.sportswear' handle; replaced 'Up to 30% off' promo with 'Selected gear at a lower price' (no numeric claim); gallery heading renamed 'Gallery' (images are still Unsplash stock photos, not customer photos; consider removing gallery entirely).
- client/src/data/content.ts: removed TESTIMONIALS; whyUs text no longer claims 'tested for real training' or 'protected end to end'; 4th card now states Cash on Delivery.
- client/src/components/Footer.tsx: removed social links and their icon imports.
- Files modified: 3 (client). Backend untouched.
- Tests run (historical, Session 3 at the time): NONE (no baseline supplied; sandbox cannot run Windows commands).
- Known regressions risk (historical, Session 3 at the time): Home no longer imports TESTIMONIALS/Newsletter; TypeScript was not compiled at that time. Needs tsc.
- Route status (updated in batch B2, section 24): /faq, /contact, /privacy and /returns now exist in App.tsx, and the footer links to them (section 25). Owner tsc and build verification of these changes is pending (section 21). Browser verification has not been done.

## 21. Exact next step (historical, Session 3; superseded by section 17)
The steps below were written in Session 3 and are kept for history. The owner's tsc and build were reported as passed after the first Session 3 client edits only (section 23). The frontend changes listed below have no owner-reported tsc or build run after them, so their TypeScript and build status is UNVERIFIED. Step 2 (BUG-01 pages) was implemented in batch B2 (section 24). Step 3 was implemented in batch B1 (section 22), except for the database-cleanup caveat. Step 4 remains open as listed in section 19.

Frontend changes with UNVERIFIED TypeScript and build status:
- client/src/components/ProductCard.tsx: batch B1 (rating shown only when reviewCount > 0).
- client/src/pages/ProductDetail.tsx: batch B1 (rating and reviews section conditional); batch B2 ("Details & Care" accordion removed).
- client/src/pages/Contact.tsx: batch B2 (new); later edits (id prop removed from the name field, success text and hint wording changed).
- client/src/components/PolicyPage.tsx: batch B2 (new).
- client/src/data/policies.ts: batch B2 (new).
- client/src/pages/Faq.tsx, client/src/pages/Privacy.tsx, client/src/pages/Returns.tsx: batch B2 (new).
- client/src/App.tsx: batch B2 (imports and routes for faq, contact, privacy, returns).
- client/src/components/Footer.tsx: section 25 (Returns and Privacy links added to Quick Links). This edit came after the first Session 3 edit to the same file.

Historical owner-reported run, timing uncertain: client/src/pages/Home.tsx, client/src/data/content.ts, and the first Session 3 edit to client/src/components/Footer.tsx were reported as passing tsc and build. The owner's report does not state whether any later edit to these three files was included, so their current state is not confirmed by that report.

Backend changes from batches A2 and B1 are covered by the owner-run CA-01 backend suite (section 27), which ran after those edits. That covers the server only and implies nothing about the frontend.

Note: the ProductCard and ProductDetail batch B1 edits are listed as unverified because the record does not show that the owner's run came after batch B1. If you can confirm that it did, this list can be updated.
1. Owner runs: `npx tsc -b` in client/ and paste output (verifies this session's edits).
2. Then implement BUG-01: add Faq, Contact, Privacy, Returns pages + routes in App.tsx (placeholder content file client/src/data/policies.ts).
3. (Implemented in batch B1, section 22; not covered by a tsc or build run.) Stop ProductDetail rendering p.reviews and remove seed reviews. Existing database reviews remain and need owner approval.
4. Then decision 3 (backend hidden categories), 4 (logout), 5 (password reset), 6 (reviews).

Audit complete (Session 2). Previously waiting for owner approval; approval received.

## 22. Batch log (Session 3, approved scope: Phase A + B1 only)

Owner decisions received (Session 3, later):
- D-care: remove misleading generic care text (ProductDetail 'Details & Care' accordion) — PENDING, next batch after B2 is approved (BUG-12). Product-specific care info later.
- D-imagehosts: do NOT restrict hosts yet. Inspect all product/category image URLs first, report every host, recommend allowlist, then implement C4 only after approval.
- D-reviews: reviews stay PENDING until admin approval; only published reviews affect ratings.
- D-resetnosmtp: password reset disabled when SMTP not configured; never print reset links/tokens in logs.
- D-session: approved (session record per login; logout revokes current session only; password change and reset revoke all sessions).
- Baseline: owner ran backend tests, tsc and build after the first client edits and reported success; no raw output or counts provided. Owner-reported only.

### Batch A2 — test assertion fix (DONE, NOT RUN)
- server/tests/customers.admin.test.mjs: `meta.pages` -> `meta.totalPages` (line in 'filters by status and validates paging').
- Tests: NOT executed by Claude. Owner must run `npm test` (or `node --test tests/customers.admin.test.mjs` with MONGO_TEST_URI set) and send exact output.

### Batch B1 — remove fabricated reviews and ratings (DONE, NOT RUN)
Changes:
- server/src/seed/seed.js: no review documents, no demo reviewer accounts. Summary returns reviews: 0. Still deletes old Review and demo-user documents on each run (existing behaviour).
- server/tests/seed.test.mjs: rewritten expectations (0 reviews, seeded ratings 0, no demo users, idempotent).
- server/tests/products.api.test.mjs: getOne expects reviews [] and reviewCount 0; delete test no longer requires seeded reviews to exist (still checks they are removed).
- client/src/pages/ProductDetail.tsx: rating line and whole 'Customer reviews' section shown only when reviewCount > 0.
- client/src/components/ProductCard.tsx: rating shown only when reviewCount > 0.
- Unchanged: server/src/seed/catalog.js (REVIEWERS / REVIEW_POOL exports remain but are unused), Review model, reviews API (none exists yet).

Known caveat (IMPORTANT): databases already seeded before this change still contain the old fabricated Review documents, and those products still have rating/reviewCount > 0. This batch does NOT delete them. Removing them needs a one-time cleanup, which is a destructive operation and requires your explicit approval. Options: (a) owner re-runs `npm run seed` on a DEVELOPMENT database only (wipes the demo catalogue, which is demo data), or (b) a targeted script that deletes only reviews whose author is a demo reviewer and recalculates ratings. Not done yet.

Tests run for B1: NONE by Claude. Owner-reported baseline predates these edits.
Remaining in B1: none beyond the caveat above.

## 23. Windows test results (owner-run, Session 3) — HISTORICAL; database results SUPERSEDED by section 27
Backend (server/, `npm test`) — run on Windows by owner:
- 87 passed, 0 failed.
- [Historical, superseded by section 27] 18 database-dependent test groups SKIPPED because MONGO_TEST_URI was not set.
- [Historical, superseded by section 27] Database integration and transaction tests were NOT verified in this run. The CA-01 run (section 27) executed them on standalone and replica-set MongoDB.
Frontend (client/, Windows):
- `npx tsc -b`: PASSED.
- `npm run build`: PASSED (build completed successfully).
Note: these runs were reported after the first client edits; the owner has not stated whether they included the later Session 3 edits (Home.tsx, content.ts, Footer.tsx, ProductDetail.tsx, ProductCard.tsx). Treat as partial.
NOT run: npm audit, check:images, browser walkthrough. (Replica-set transaction run: completed in CA-01, section 27.)

## 24. Batch B2 — policy pages + routes + care-text removal (DONE, NOT RUN)

Changes:
- NEW client/src/data/policies.ts: FAQ_DOC, PRIVACY_DOC, RETURNS_DOC. Verified facts only (COD only; cancel while pending/confirmed; tracking by order number + email; guest checkout; cart/wishlist/coupon in browser storage; httpOnly vortex_token cookie; no analytics scripts in code). Everything else is a [PLACEHOLDER ...].
- NEW client/src/components/PolicyPage.tsx: shared layout; highlights [PLACEHOLDER] text; shows a draft notice when placeholders exist.
- NEW client/src/pages/Faq.tsx, Privacy.tsx, Returns.tsx: thin wrappers.
- NEW client/src/pages/Contact.tsx: uses useShopSettings (waits for config), contactService.send, client validation, honeypot 'website' field (hidden), shows an honest 'form unavailable' notice when contact.formEnabled is false, shows email/phone/address only when configured in server settings.
- client/src/App.tsx: imports and routes faq, contact, privacy, returns (inside the public Layout, before the 404 route).
- client/src/pages/ProductDetail.tsx (SEPARATE CHANGE, care-text removal): removed the 'Details & Care' accordion (generic 'Moisture-wicking ... Machine wash cold ... Do not iron over printed logos' text shown for every product). Shipping & Returns accordion kept. Product-specific care info to be added later.
- Navigation: footer links (/faq, /contact, /privacy, /returns) and the ProductDetail returns link already existed in the code; they now resolve to real routes.

NOT changed: database reviews (not touched), seed script (not run), backend (no changes in this batch), reviews/ratings UI from B1, Newsletter, social links, currency code.

Risks noted:
- Contact page depends on the server returning contact.formEnabled; with SMTP or CONTACT_TO missing, the form is replaced by the honest notice (intended).
- Contact.tsx and other pages use React.ChangeEvent/React.* types without importing React, the same pattern already used in existing files that compiled under the owner's tsc run.

Tests run for B2: NONE by Claude. Required by owner: `npx tsc -b` and `npm run build` in client/ on Windows, then manual check: visit /faq /contact /privacy /returns, check placeholder highlighting, check contact form states (loaded/unavailable/normal), and confirm the product page no longer shows 'Details & Care'.

## 25. Footer navigation discoverability (DONE, NOT RUN)

Inspection (read-only, before change):
- Footer.tsx already contained all four routes, but only as: FAQ and Contact Us in the 'Quick Links' column; Privacy Policy and Returns & Refunds only in the small grey legal strip at the bottom (text-xs); Returns only inside a shipping sentence.
- Routes in App.tsx exist (faq, contact, privacy, returns). Navbar.tsx has no links to these pages (unchanged, out of scope).

Change (one file):
- client/src/components/Footer.tsx: added React Router <Link> entries for Returns & Refunds (/returns) and Privacy Policy (/privacy) in the existing 'Quick Links' column, using the same `link` style. FAQ and Contact Us were already there.

Not changed: routes, page content, Navbar, legal strip, other pages, backend, database, environment files, grid layout (still 4 columns; the Quick Links column is taller on desktop and stacks in the existing responsive grid on mobile).

Optional follow-up for owner decision (NOT done): the legal strip uses text-xs text-neutral-500, which is low contrast. Raising it would be a styling change and was not requested.

Verification status: NOT RUN. Claude could not run `npm run build` or `tsc` on the Windows project. Required by owner: `npx tsc -b` and `npm run build` in client/, then a visual check of the footer at desktop and mobile widths and clicking each of the four links (must not reload the page).

## 26. Complete E-commerce audit (AUDIT ONLY, DONE)

Report location: F:\vortex\VORTEX_COMPLETE_AUDIT.md
Method: source-code inspection only. No browser, no interaction, no mobile viewport check, no performance measurement, no database connection, no SMTP test. No application code was modified.

Main findings (see report for full IDs):
- CA-01 (P0): verified for the test suite on standalone and replica-set MongoDB (section 27). The earlier finding that these tests were skipped is historical. Real-load concurrency remains unverified.
- CA-02 (P0): all product, banner, and gallery images are Unsplash stock photos, not VORTEX products; catalogue is demo data.
- CA-03 (P0): no business identity or contact channel by default; policy pages contain placeholders; Terms of sale page does not exist.
- CA-04 (P0): order confirmation email depends on SMTP; no on-screen fallback when email is not sent.
- CA-07 (P0, business decision): currency and tax treatment not decided.
- P1: no password reset (CA-05); Field label association broken in checkout (CA-06); registration enumeration (CA-09); no error boundary (CA-11); no size guide or product specs (CA-14); no social proof until reviews are built (CA-16); hidden categories still sell (CA-35); no SEO basics (CA-41); legal strip contrast (CA-44).

Critical blockers before real customers (open): CA-02, CA-03, CA-04, CA-07. CA-01 is verified for the test suite (section 27); real-load concurrency remains unverified.
Recommended next phase: none assigned in this file. The remaining work and owner decisions are listed in sections 11 and 19. No code changes until the owner approves.

Not inspected or verified: browser behaviour, mobile layouts, visual rendering, live performance, email delivery, real-load database behaviour and production data (the CA-01 test run is the only database verification), third-party image availability, accessibility with assistive technology, legal wording, npm audit.

## 27. Phase 1 / CA-01 — Database test verification (VERIFIED BY OWNER, WINDOWS)

Status: COMPLETE. Owner-run on Windows; results taken from the PowerShell output the owner provided. Claude did not run any test or command for this item. No application code, test code, dependency, configuration, or database data was modified by this documentation update.

Findings from reading server/package.json and tests/helpers.mjs (this session):
- `npm test` runs `node --test "tests/**/*.test.mjs"` from server/.
- testUri(name) returns null unless MONGO_TEST_URI is set. Each DB test file then uses database `<base>_<name>`. The pathname must contain "test" or the helper throws.
- setupApi() drops and recreates its own database (`dropDatabase`) and seeds the demo catalogue. It never touches a database name without the per-file suffix.
- DB-dependent files (gated by testUri): admin, adminOrders, auth, checkout, contact, coupons.admin, createAdmin, customers.admin, db, orders, permissions, phase7, products.api, rateLimit, seed, trackLimit, transactions (17 files; owner reported 18 groups, the difference is describe-level grouping, to be confirmed from output).
- Replica-set-only tests: three subtests inside transactions.test.mjs (crash during checkout, crash during cancellation, customer-initiated cancel). They skip on standalone and run only when MongoDB reports a replica set.
- Non-DB tests (always run): authGuard, mailer, phase3, productQuery, settings.
- Accidental-dev-database risk: no test connects unless MONGO_TEST_URI is set. Test files set MONGO_URI before importing the app; dotenv does not override existing variables. Residual risk: if MONGO_TEST_URI points at the developer's own mongod, setupApi drops databases named <base>_<suffix>. Mitigation: a separate mongod on dedicated ports (27019 standalone, 27020 replica set) with new empty data directories outside the project.

Required setup (owner, Windows PowerShell):
1. Confirm MongoDB Community Server is installed: `mongod --version` and `mongosh --version`. If mongosh is missing, install it from MongoDB's official site (it is needed to check and stop the test instances).
2. New empty data folders outside the project: C:\vortex-test-data\standalone and C:\vortex-test-data\rs0. Confirm they are new before use.
3. Standalone run: mongod on 127.0.0.1:27019. Full suite. Expect transaction replica-only subtests to skip.
4. Replica-set run: mongod --replSet rs0 on 127.0.0.1:27020, initiated once. Full suite plus focused run of tests/transactions.test.mjs.

Safety confirmation procedure (before every run): list databases on the test port; expect no databases outside the test namespace; confirm the process was started with the test data folder.

Stop procedure: shut down each test mongod with mongosh on its port. Do not delete data folders without owner approval.

RESULTS (owner-run, Windows, verified from PowerShell output):

Standalone MongoDB, port 27019 (run: `npm test` with MONGO_TEST_URI=mongodb://127.0.0.1:27019/vortex_test):
- MongoDB version: 8.2.7
- Total: 348 | Passed: 345 | Failed: 0 | Skipped: 3
- The 3 skipped tests are the replica-set-only transaction subtests (they require replica-set transaction support).

Replica set MongoDB, port 27020 (run: `npm test` with MONGO_TEST_URI=mongodb://127.0.0.1:27020/vortex_test?replicaSet=rs0):
- MongoDB version: 8.2.7
- Replica set name: rs0; state verified as PRIMARY.
- Total: 348 | Passed: 348 | Failed: 0 | Skipped: 0

Failures: none in either run. No failure classification required.

Cleanup verification (owner-reported):
- Both temporary MongoDB servers were shut down.
- Ports 27019 and 27020 verified to have no listening processes.
- Both test instances showed only the system databases (admin, config, local) after the test runs.
- Temporary test data directories left in place (C:\vortex-test-data\standalone and C:\vortex-test-data\rs0). Not deleted.

Notes:
- These counts are individual tests. The earlier owner-reported run (87 passed, 18 database-dependent groups skipped) was a different run without MONGO_TEST_URI and is superseded for database coverage by these results.
- The owner-provided output did not include the `[transactions] MongoDB transactions supported:` line; it is not claimed here.
- Watch item BUG-30 (customers.admin `?q[$ne]=x` expects 400): no failure was reported in either run. Treat as passing in these runs only.
- Scope of this result: database-dependent test verification only. It does not verify browser behaviour, email delivery, performance, or any other audit item.

Watch items (from reading, NOT results): BUG-30 (customers.admin `?q[$ne]=x` expects 400); the phase7 Product.find stub; rateLimit and trackLimit switch NODE_ENV; Windows file locks in admin.test around sharp (handled in code); createAdmin tests spawn node and depend on working directory being server/.

## 17. Exact next step
[Superseded] The baseline and database test runs listed in earlier versions of this step are complete (sections 23 and 27).
Next step: the owner decides whether to start the next audit item. Claude will not start CA-02 or any other item without approval.
Open owner decisions: section 19 and section 11.

## 28. Phase 7 completion session (later session; partial, UNVERIFIED)

Scope: Phase 7 only. CA-01 remains the only completed CA item. CA-02, CA-03, CA-04, CA-07 and other audit items were not started.

Work completed in this session:
- client/src/App.tsx: added `ConfigGate`, a component that calls `useShopSettings()` and wraps the routed tree in a keyed `Fragment` (key = `currency|locale` from the server config). The key only changes when the server currency or locale differs from the defaults, so a USD store never remounts and a non-default store remounts once when its settings arrive. Imports updated (`Fragment`, `ReactNode`, `useShopSettings`). NOT compiled or run.
- README.md created at the project root (overview, structure, setup, env variable names without values, database setup including local replica set, seeding warning, tests, known limitations).
- handoff/VORTEX_NEW_CHAT_HANDOFF.md created (directory handoff/ created). Covers what the project does, stack, structure, setup, env names, database, routes, auth, completed features, Phase 7 changes, test status, known bugs, remaining tasks and next step.
- PHASE7_HANDOFF.md: status block at the top replaced with a current update (the rest of the document is unchanged and still describes the earlier state in places).

NOT completed in this session (blockers and reasons):
- Admin Coupons screen and admin Customers list/detail screens: not built AT THE TIME OF THIS SECTION (superseded: written later, see section 29). They need UI code that cannot be type-checked or run here; building them unverified was judged riskier than leaving them open. Owner or a session with a working build environment should build them.
- Full sweep of admin pages for hard-coded `$` (ProductForm is known to contain it): not done.
- ZIP handoff (handoff/VORTEX_SOURCE_HANDOFF.zip): NOT created. The assistant's environment cannot create a ZIP of the Windows project. The owner's PowerShell commands to create it are given in the session report; they are not stored in the handoff file.

Tests executed in this session: NONE. No npm, Node, MongoDB, tsc or build command was run by the assistant. Results from section 27 (owner-run CA-01) still reflect the server at that time; re-run after any server change.

Tests still pending (owner must run and paste output): `npx tsc -b` and `npm run build` in client/ (covers all frontend edits since the first Session 3 edits, including App.tsx ConfigGate, policy pages, contact page, routes, footer, and the README is documentation only).

Known risks from this session: ConfigGate's remount behaviour is untested in a browser; if a non-default currency is configured, page state in the routed tree resets once when settings arrive.

## 29. Admin UI for coupons and customers (implemented; NOT compiled or run)

Scope: admin frontend only. No backend, database, seed, environment or credential changes. CA-01 remains the only completed CA item; no other audit item was started.

Backend APIs used (existing, unchanged):
- Coupons: `GET /api/admin/coupons?q&status` (returns an array, no pagination, up to 500 rows), `POST /api/admin/coupons`, `PATCH /api/admin/coupons/:id`, `DELETE /api/admin/coupons/:id` (409 when used).
- Customers: `GET /api/admin/customers?q&status&page&limit` (paginated, limit 1-50), `GET /api/admin/customers/:id` (customer, orders, ordersShown, ordersTotal), `PATCH /api/admin/customers/:id/status` ({ isActive }).

Files created:
- client/src/pages/admin/Coupons.tsx: searchable list with status filter; create and edit form with client validation that mirrors couponValidators.js and models/Coupon.js; code field locked when the coupon has been used (matches the server's 409 rule); activate/deactivate per row; delete only when the API reports canDelete, with a confirmation dialog; loading, empty, filtered-empty and error states; field errors mapped from the API.
- client/src/pages/admin/Customers.tsx: URL-driven search (name, email, phone), status filter, pagination (20 per page), loading, empty and error states, links to the detail screen.
- client/src/pages/admin/CustomerDetail.tsx: profile, activity stats (total spent excludes cancelled orders, as the server does), order history (the 50 most recent, with a note when more exist), activate/deactivate with a confirmation dialog, not-found and error states.

Files modified:
- client/src/pages/admin/AdminLayout.tsx: Coupons and Customers sidebar links (Ticket and Users icons from lucide-react, already used elsewhere in the project's icon set).
- client/src/App.tsx: lazy imports and routes for `coupons`, `customers`, `customers/:id` under the existing RequireAdmin admin route.

Access control: the admin route group is already protected by RequireAdmin on the client and by requireAdmin on every /api/admin route on the server (unchanged).

Static review findings (no execution performed):
- The coupons list has no paging controls because the API returns all matching coupons (up to 500). Acceptable for a small catalogue; revisit if the number of coupons grows.
- Search on coupons matches the code only, as the API does.
- The client's deactivation wording assumes the server stops inactive accounts from logging in and from using existing sessions; this is what the auth middleware and the auth tests describe, but it has not been run.
- No frontend test framework exists in the project, so these screens have no automated tests.

Verification status:
- TypeScript (`npx tsc -b`): NOT RUN. Pending owner.
- Production build (`npm run build`): NOT RUN. Pending owner.
- Browser testing of create, edit, activate/deactivate, delete, search, filters, pagination and the detail screen: NOT RUN. Pending owner.
- Backend tests: not re-run; no server file was changed in this step.

## 30. Approved fixes from the admin screen review and checkout deactivation (applied; NOT compiled, built or run)

Approved by the owner: M1, M3, M4, L1, L2, L3, L4, L5, and M2 option (a) with decision (i) (guest checkout stays available, including with the same email). The 403 message was approved exactly as written. No test, build, seed, database operation, image change, or ZIP was run or created.

optionalAuth search (verified by reading, not by running a search tool):
- The only route that uses `optionalAuth` is `POST /api/orders` in `server/src/routes/orderRoutes.js` (checkout). Other route files read: `cartRoutes.js`, `authRoutes.js`, `index.js`, `productRoutes.js`, `contactRoutes.js`, `categoryRoutes.js`, `adminRoutes.js`, and `app.js` (none import or use `optionalAuth`).
- Not verified by reading: controllers and other files under `server/src`. Owner to confirm with: `findstr /s /n /c:"optionalAuth" F:\vortex\server\src\*.js`
- Cart quote (`POST /api/cart/quote`) uses no auth and is not changed.

Files changed:
1. server/src/middleware/auth.js: `optionalAuth` rewritten as an async handler. No cookie, an invalid or expired cookie, an unknown user, or an ended session (tokenVersion mismatch) continues as a guest, as before. A cookie for a deactivated account is refused with 403: "This account has been deactivated, so orders cannot be placed while signed in. Please contact the store." Otherwise req.user is set. No new imports were needed.
2. client/src/pages/admin/Coupons.tsx:
   - M1: expiry dates are formatted with timeZone 'UTC'.
   - M4: a 409 whose message mentions the code is shown on the code field; a duplicate code shows "This code already exists".
   - L1: a used coupon with no orders shows "Used N times" instead of "Used on 0 orders".
   - L5: the explanation is visible text instead of a hover-only title.
3. client/src/pages/admin/CustomerDetail.tsx:
   - M3: the stats grid is one column on phones and three from the sm breakpoint.
   - L2: the skeleton shows only when there is no data yet, and the page stays visible during a reload.
4. client/src/pages/admin/Customers.tsx:
   - L3: an out-of-range page shows "No customers on this page" with a link back to page 1.
   - L4: the search box follows the URL on back and forward, and never overwrites text the admin is typing (a typing flag).

Not changed: App.tsx (L7 was not approved), AdminLayout.tsx, route files, controllers, orderService, and models.

Not added at the time: a backend test for the new 403 behaviour. It was not in the approved list. [SUPERSEDED by section 32: a backend test was added in server/tests/optionalAuth.test.mjs; it has not been run.]

Verification status:
- Backend tests: NOT RUN.
- TypeScript (`npx tsc -b`): NOT RUN.
- Production build (`npm run build`): NOT RUN.
- Browser testing: NOT RUN.
- Behaviour of the 403 path, the M4 message mapping, and the L4 typing flag: verified by reading the code only.

Known limitation (decision i): a deactivated customer can still place a guest order with the same email. Signed-in access is blocked; guest checkout is not.

## 31. L2 regression correction (applied; NOT compiled, built or run)

Approved by the owner: ensure CustomerDetail renders customer data only when `c.id === id`, and prevent actions on a previously displayed customer after navigating to another customer.

Changes in client/src/pages/admin/CustomerDetail.tsx:
- `toggle` returns early when `!c || c.id !== id`.
- The loading skeleton shows when `loading && (!data || data.customer.id !== id)`.
- The customer detail block renders only when `!error && c && c.id === id && data`.
- The activate/deactivate confirmation dialog is open only when `confirming && !!c && c.id === id`.

Verification status:
- Behaviour verified by reading the saved file only.
- Backend tests: NOT RUN. TypeScript (`npx tsc -b`): NOT RUN. Production build (`npm run build`): NOT RUN. Browser testing: NOT RUN.
- Still open for the owner: the authentication questions raised in this review (see the investigation report). No authentication logic was changed.

## 32. Stale-cookie clearing for deactivated customers (IMPLEMENTED; tests written; NOT run)

Approved by the owner: option (a). When optionalAuth detects an inactive account, clear the authentication cookie and return the approved 403 message. Genuine guest checkout is unchanged.

Implemented change:
- server/src/middleware/auth.js: imports `clearAuthCookie` alongside `verifyToken` from `../utils/tokens.js`. The `optionalAuth` handler now takes `res`. In the inactive-account branch it calls `clearAuthCookie(res)` before returning the 403 with the approved message, unchanged.
- Cookie options: the existing logout endpoint (`authController.logout`) uses `clearAuthCookie`, which uses `cookieOptions()` in `server/src/utils/tokens.js`: `httpOnly: true`, `secure: config.cookie.secure` (true only in production), `sameSite: config.cookie.sameSite` (from COOKIE_SAMESITE, default lax), `path: '/'`. The same function is reused here, so the options are identical to logout's. Nothing was guessed or copied.
- No change to authenticate, customer status logic, the 403 message, Layout.tsx, or any client file in this step.

Tests added (not run):
- server/tests/optionalAuth.test.mjs (new, database suite, skipped without MONGO_TEST_URI):
  1. Active customer: order placed, linked to the account, cookie kept.
  2. Deactivated customer: 403 with the exact approved message; cookie-clearing Set-Cookie with Expires=Thu, 01 Jan 1970, Path=/, HttpOnly.
  3. The cleared cookie's attributes match logout's Set-Cookie attributes.
  4. Genuine guest without a cookie: 201, no cookie touched.
  5. A stale deactivated cookie re-sent: 403 again (documents that the server does not revoke it).
  6. Invalid token: treated as guest (201), not cleared.
  7. Expired token: treated as guest (201); the account stays active.

Later correction (pre-test): each optionalAuth test now prepares its own state. Tests that need a deactivated customer deactivate Bob through the admin API themselves, and checkout() tops up the stock it needs. No test deactivates Alice. Each test therefore passes alone and under --test-name-pattern. Assertions are unchanged. Not run.

Layout.tsx: read in this step; no logout control (it only composes AnnouncementBar, Navbar, Footer, CartDrawer). Not modified. CartDrawer.tsx and AnnouncementBar.tsx were not read, so a logout control in them is not ruled out.

Verification status:
- Backend tests (including optionalAuth.test.mjs): NOT RUN.
- TypeScript and production build: NOT RUN (no client file changed in this step).
- Browser test of the deactivated-customer checkout flow: NOT RUN.
- No seed command, database operation, or ZIP was run or created.

Remaining concerns:
- The server still accepts a copied deactivated cookie until the customer's browser drops it; the server keeps no revocation list (test 5 documents this).
- Reactivating a customer makes their old cookies valid again, because deactivation does not change tokenVersion. This was not changed.
- Decision (i) still allows a deactivated customer's email to place guest orders.

## 33. Frontend state correction after a deactivated-account 403 (IMPLEMENTED; NOT run)

Approved by the owner: refreshSession in AuthContext, ACCOUNT_DEACTIVATED_MESSAGE exported from auth.ts, and Checkout handles only the matching 403.

Changes:
- client/src/context/AuthContext.tsx: new `refreshSession()` (added to the context type and the memoised value). It calls `authService.me()` (GET /auth/session) and sets the user to the result. It sends no logout request. A failed call keeps the current state.
- client/src/services/auth.ts: exports `ACCOUNT_DEACTIVATED_MESSAGE`, with the same text as the server's 403 in server/src/middleware/auth.js.
- client/src/pages/Checkout.tsx: imports the constant and `refreshSession`. In the catch block, a 403 whose message equals the constant calls `refreshSession()` and shows the toast. Every other error path is unchanged; the 409 branch is kept as it was.

Behaviour: the "Signed in as" text disappears because the user becomes null; the form keeps the customer's values; the next submit carries no cookie and can complete as a guest. No logout request is made. Other 403 responses (admin, role, CSRF header) do not match the constant and are unaffected.

Known risks: the match is on message text, so a server text change would silently skip the refresh; the approved message is unchanged. If the browser ignores the cleared cookie (for example some cross-origin setups), the refresh correctly shows the signed-in state again.

Verification status:
- TypeScript (`npx tsc -b`): NOT RUN.
- Production build (`npm run build`): NOT RUN.
- Browser test of the deactivated-customer checkout (cookie cleared, state refreshed, guest retry succeeds): NOT RUN.
- Backend tests: NOT RUN. No server file was changed in this step.
- No seed command, database operation, or ZIP was run or created.

## 18. Warnings and restrictions
- Never read or display .env files. .env.example is allowed.
- No seed, reset, migration or destructive DB commands without owner approval.
- No `npm audit fix --force`. No major dependency upgrades without explaining risk first.
- No deployment. No AI features. No online payment gateway.
- Do not remove working features. Preserve VORTEX visual identity.
- Do not claim sandbox results are owner PC results.
- Do not modify application source code until the owner approves the repair plan.

## 30. Catalogue expansion, documentation and database safety (this session)

Status: documentation and source changes made as approved; NOTHING EXECUTED by the assistant. Phase 7 is NOT complete.

Source changes (approved plan):
- `F:\vortex\server\src\seed\catalog.js`: 8 categories (added Swimwear, Running Essentials, Yoga & Studio) and 40 products (24 added). Existing palette colours and existing size values only. Featured 7, on sale 8, new arrivals (under 30 days) 9.
- `F:\vortex\server\tests\seed.test.mjs`: expected counts updated to 8 / 40 / 7 / 8 / 9.
- `F:\vortex\client\scripts\check-images.mjs`: now also checks Unsplash IDs in `F:\vortex\server\src\seed\catalog.js`; same output format and exit codes.

Documentation changes:
- `F:\vortex\README.md`: rewritten. Documents the 8/40 catalogue, the seeding warning (it deletes data in whichever database `MONGO_URI` points to), safe seeding against `vortex_playground`, admin creation, test commands and `npm run check:images`. Corrects the admin-area line: Coupons and Customers screens exist but are not compiled or browser-tested.
- `F:\vortex\PHASE7_HANDOFF.md`: one update note added at the top. Phase 7 remains incomplete.
- `F:\vortex\handoff\VORTEX_NEW_CHAT_HANDOFF.md`: seed bullet corrected in section 6; section 15 added.
- `F:\vortex\handoff\CHANGELOG.md`: updated with every change, including the ZIP status.

Database safety (from reading `server/src/config/env.js`, `server/package.json` and `server/.env.example`; the real `.env` was not read):
- `env.js` loads `server/.env` with dotenv. dotenv does not overwrite variables already set in the process environment, so a `$env:MONGO_URI` set in the PowerShell window takes priority over the file for that session.
- `npm run seed` (`server/src/seed/seed.js`) deletes demo data only when `MONGO_URI` names exactly `vortex_playground`. The guard is checked before connecting and again after connecting; there is no bypass (see section 31).
- `server/.env.example` defaults `MONGO_URI` to `vortex`. The seed guard now refuses that value, so seeding fails safely. Changing the example itself is still a recommended follow-up (not done).
- Safe command for the playground (recommended in README): `cd server`, then `$env:MONGO_URI = "mongodb://127.0.0.1:27017/vortex_playground"`, then `npm run seed`.

Not done / pending:
- Source ZIP `F:\vortex\handoff\VORTEX_COMPLETE_SOURCE.zip`: NOT created. The assistant has no archive tool that can write a binary file to the owner's PC.
- Owner-run checks: `npx tsc -b`, `npm run build`, `npm run check:images` (client); `npm test` (server, against a throwaway test database). Nothing has been run by the assistant.
- Browser checks of the Coupons and Customers screens and of the new categories.
- `createAdmin.js` was not read in this session; its database connection path is assumed to match the README and needs confirming.

## 31. Seed database guard (implemented; NOT run)

- `F:\vortex\server\src\seed\databaseGuard.js` (CREATED; see section 32): holds `SEED_DATABASE`, `databaseNameFromUri(uri)` and `isSeedDatabase(uri)`. It has no imports.
- `F:\vortex\server\src\seed\seed.js` (MODIFIED; see section 32): imports the helpers from `databaseGuard.js` and re-exports them. Two checks in the CLI block only: check 1 before connecting (the database name from `config.mongoUri` must equal `vortex_playground`), and check 2 after connecting (`mongoose.connection.name` must equal it) before any delete. No bypass flag or environment variable. `seedCatalog()` is unchanged and has no guard of its own, so tests can use their own databases. Known gap, NOT yet changed: `seedCatalog()` can be called by any code that imports `seed.js`, so the guard does not cover it.
- `F:\vortex\server\tests\seedGuard.test.mjs` (CREATED): no-database unit tests for the helpers. It imports `databaseGuard.js` directly and sets no environment variables. (The earlier wording that it set environment variables to load the models is no longer true.)
- Status: NOT run. The seed, tests and builds were not executed.

## 32. Current file summary and image sourcing status (current)

### 32a. Current status
- Phase 7: NOT complete.
- Verification: nothing in the later sessions has been executed by the assistant. Owner-run checks are pending: `npx tsc -b`, `npm run build`, `npm run check:images` (client); `npm test` (server, against a throwaway test database).
- The source ZIP `F:\vortex\handoff\VORTEX_COMPLETE_SOURCE.zip` does NOT exist. The ZIP script has not been run.

### 32b. Files created or modified since Session 2 (summary; the full record with dates is in `handoff/CHANGELOG.md`)
- Catalogue: `F:\vortex\server\src\seed\catalog.js` (8 categories, 40 products); `F:\vortex\server\tests\seed.test.mjs` (counts).
- Database guard: `F:\vortex\server\src\seed\databaseGuard.js` (CREATED; helpers with no imports); `F:\vortex\server\src\seed\seed.js` (imports and re-exports the helpers; `seedCatalog()` and both CLI checks unchanged); `F:\vortex\server\tests\seedGuard.test.mjs` (CREATED; imports `databaseGuard.js` directly).
- Images checker: `F:\vortex\client\scripts\check-images.mjs` (also checks `catalog.js`).
- Documentation: `F:\vortex\README.md`; `F:\vortex\PHASE7_HANDOFF.md`; `F:\vortex\handoff\VORTEX_NEW_CHAT_HANDOFF.md`; `F:\vortex\handoff\CHANGELOG.md` (CREATED, then updated).
- Admin screens (written, not compiled): `F:\vortex\client\src\pages\admin\Coupons.tsx`, `Customers.tsx`, `CustomerDetail.tsx` (CREATED); `AdminLayout.tsx` and `F:\vortex\client\src\App.tsx` (MODIFIED).
- Earlier Phase 7 and batch work (policy pages, contact page, footer, reviews removal, currency gate, test assertion fix): listed in sections 20, 22, 24, 25 and 28, and in `PHASE7_HANDOFF.md` section C.

### 32c. Image sourcing status (plan awaiting approval)
- No images have been downloaded, selected, implemented or changed.
- Primary source: Pexels (manual, owner-reviewed downloads; no bulk or automated copying, per Pexels' terms). Secondary: Pixabay, only after its current API and licence terms are checked.
- Target: 120 unique product images (40 products x 3) plus 8 unique category images, none reused as a primary image.
- Approved in principle: the 13 product name changes and the move of Calm Oversized Crewneck to Hoodies & Jackets.
- Images that show visible logos or brands are excluded.
- Local hosting under `client/public` is proposed but not approved in implementation form.
- Next step: the owner reviews the sourcing workflow before any candidate search or download.

## 33. Destructive-operation protection (implemented; NOT run)

Each destructive path now checks the connected database name before its first delete. Rules live in one place: `F:\vortex\server\src\seed\databaseGuard.js`.

- Allowed: `vortex_playground` (exact), and `vortex_test_<suffix>` where the suffix is one or more letters, digits, `_` or `-`.
- Refused: `vortex`, `vortex_test` with no suffix, names that merely contain "test", any other name, and a missing name.
- `seedCatalog()` (`F:\vortex\server\src\seed\seed.js`): refuses before any delete if the connected name is not allowed. The two CLI checks are unchanged.
- `setupApi()` (`F:\vortex\server\tests\helpers.mjs`): refuses and disconnects before `dropDatabase()` if the connected name is not allowed.
- `testUri()` (`F:\vortex\server\tests\helpers.mjs`): `MONGO_TEST_URI` must name the database `vortex_test`; each test database is `vortex_test_<name>`, validated by the same rule.
- Unit tests: `F:\vortex\server\tests\seedGuard.test.mjs` (no database).
- Owner action: `MONGO_TEST_URI` must end in `/vortex_test`. The README already documents this.
- Status: NOT run. The seed, tests and builds were not executed. Existing test names are assumed to produce valid `vortex_test_<name>` databases; the owner's full run will confirm this.
