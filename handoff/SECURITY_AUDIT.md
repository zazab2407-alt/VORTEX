# VORTEX — Security and Engineering Audit (read-only)

Date of audit: 2026-11-22 (this session)
Scope: source as it currently exists under `F:\vortex`. No application code was changed.
Method: read the source files listed under each finding. No command was run: no tests, no `npm audit`, no build. Items that need a command are marked **Unverified — needs tool run**.

Severity scale: **High** = exploitable or data-exposing in a realistic scenario; **Medium** = weakens a control or causes wrong behaviour under plausible conditions; **Low** = hardening or edge case; **Info** = observation, no defect.

## A. Authentication and session

### SEC-A1 — Logout does not revoke the token
- **Location:** `server/src/controllers/authController.js` (`logout`), `server/src/utils/tokens.js` (`clearAuthCookie`).
- **Behaviour:** logout clears the cookie in the browser only. A copy of the JWT remains valid until it expires.
- **Root cause:** tokens are stateless; the only server-side revocation is `tokenVersion`, which changes on password change or deactivation.
- **Severity:** Medium.
- **Scenario:** a cookie captured from a shared computer keeps working after the user logs out, for up to the token lifetime (default 7 days, `JWT_EXPIRES_IN`).
- **Fix:** owner decision (logout scope). Options: bump `tokenVersion` on logout (signs out every device), or add a per-session id; and/or shorten the default lifetime.
- **Regression test:** after logout, the old token returns 401 on `/auth/me`. Depends on the decision.
- **Status:** DEFERRED — OWNER DECISION.

### SEC-A2 — Long default token lifetime
- **Location:** `server/src/config/env.js` (`jwt.expiresIn` default `'7d'`).
- **Severity:** Low. Combined with SEC-A1 it lengthens the window for a stolen cookie.
- **Fix:** consider 24h with a refresh flow, or document the trade-off. Owner decision.
- **Status:** DEFERRED — OWNER DECISION.

### SEC-A3 — No per-account brute-force protection
- **Location:** `server/src/middleware/rateLimiter.js` (`authLimiter`), `server/src/routes/authRoutes.js`.
- **Behaviour:** login is limited to 10 failed attempts per 15 minutes **per IP**. There is no limit per account.
- **Root cause:** the limiter keys on IP only.
- **Severity:** Medium.
- **Scenario:** a botnet with many IPs can try many passwords against one account without tripping the IP limit.
- **Fix:** add a second limiter keyed on the submitted email (normalised), with a generic response. Keep the IP limit.
- **Regression test:** 11th failed attempt for one email from many IPs is refused; a correct password for another account is unaffected.
- **Status:** NOT STARTED. Implementable without an owner decision (it does not change business rules); confirm before implementing.

### SEC-A4 — Registration reveals whether an email is registered
- **Location:** `server/src/middleware/errorHandler.js` (code 11000 → 409 "That email is already in use"); `client/src/pages/Register.tsx` (409 → "An account with this email already exists").
- **Behaviour:** the response differs for existing and new emails.
- **Root cause:** duplicate-key error is mapped to a specific message.
- **Severity:** Low. The shop must tell a customer that the account exists to be usable, so this is a usability trade-off, not a defect.
- **Mitigation already present:** failed registrations count towards `authLimiter` (10 per 15 minutes per IP).
- **Fix options:** keep as is (documented trade-off), or send "check your email" for both cases.
- **Status:** DEFERRED — OWNER DECISION (product trade-off).

### SEC-A5 — No password reset flow
- **Behaviour:** a user who forgets their password cannot recover the account.
- **Severity:** Info (functional gap, not a vulnerability). Already an owner decision.
- **Status:** DEFERRED — OWNER DECISION.

### Confirmed sound (no defect found)
- Password hashing with bcrypt, 12 rounds; dummy hash used for unknown emails to equalise timing (`authController.js`).
- Password length 8 to 72 bytes enforced (bcrypt truncation avoided) (`authValidators.js`).
- Token algorithm pinned to HS256 (`tokens.js`), so `alg: none` is refused.
- Every request reloads the user; a deactivated account or changed password takes effect immediately (`middleware/auth.js`).
- Password change bumps `tokenVersion`, ending other sessions (`User.js`, `authController.js`).
- Cookie is `httpOnly`, `secure` in production, `SameSite=Lax` by default (`tokens.js`, `env.js`).
- `role` cannot be set by registration or profile update (`authController.js`, `User.js`).
- Profile update allow-lists fields (`updateMe`).
- JWT secret must be at least 32 characters in production (`env.js`).

## B. Authorization

### SEC-B1 — Admin routes are guarded at the router level
- **Location:** `server/src/routes/adminRoutes.js`: `router.use(requireAdmin)`.
- **Status:** VERIFIED by reading. Every `/api/admin` route inherits `authenticate` + `requireRole('admin')`.

### SEC-B2 — Object-level access to orders and customers
- **Location:** `server/src/controllers/orderController.js` (`findOwn`), `customerController.js` (`customersOnly`, `loadCustomer`).
- **Behaviour:** `GET /orders/:orderNumber` and cancel require the order to belong to the caller; a missing order and someone else's order return the same 404. Admin customer endpoints exclude admins and demo accounts.
- **Status:** VERIFIED by reading. No IDOR found in these paths.

### SEC-B3 — Admin can deactivate customers but cannot deactivate self
- **Location:** `customerController.js` (`setCustomerStatus`).
- **Status:** VERIFIED by reading.

## C. Application security and input handling

### SEC-C1 — NoSQL operator injection
- **Location:** `server/src/middleware/sanitize.js` drops keys starting with `$` or containing `.` from body, params and query.
- **Status:** VERIFIED by reading. Regex search terms are escaped (`escapeRegex` in `productQuery.js`, `adminController.js`, `customerController.js`, `couponController.js`).

### SEC-C2 — ReDoS through search
- **Location:** `productQuery.js` (`wordStartRegex`).
- **Behaviour:** the pattern is `(^|[^a-z0-9])<escaped term>` with terms limited to 80 characters.
- **Severity:** Low. Simple pattern, no nested quantifiers.
- **Status:** VERIFIED by reading.

### SEC-C3 — CSRF
- **Location:** `server/src/middleware/csrf.js`, applied in `app.js` to `/api`.
- **Behaviour:** every non-safe request needs `X-Requested-With: vortex-web`, which a cross-site form cannot add without a CORS preflight. CORS only allows configured origins.
- **Status:** VERIFIED by reading.

### SEC-C4 — CORS
- **Location:** `server/src/app.js`.
- **Behaviour:** origins limited to `CLIENT_URL`; `credentials: true` only with that list. Requests with no `Origin` header are allowed (intended for server-to-server).
- **Status:** VERIFIED by reading.

### SEC-C5 — Security headers and error leakage
- **Location:** `app.js` (helmet), `middleware/errorHandler.js`.
- **Behaviour:** helmet defaults; `x-powered-by` disabled. 5xx messages are generic in production. Stack traces only when `NODE_ENV === 'development'`.
- **Status:** VERIFIED by reading. Note: helmet's default CSP is set for the API; the web app's own CSP (`client/index.html` or the host) was not reviewed.

### SEC-C6 — Upload handling
- **Location:** `middleware/upload.js`, `services/imageService.js`.
- **Behaviour:** memory storage; content decoded by sharp and must be JPEG, PNG or WebP; single-page only; pixel limit 40 million; re-encoded to WebP (removes metadata); random 32-hex file names; `wx` flag avoids overwriting.
- **Status:** VERIFIED by reading. Strong.

### SEC-C7 — Admin-supplied image URLs
- **Location:** `server/src/validators/productValidators.js` (`IMAGE_URL`).
- **Behaviour:** product images may be any `https://` or `http://` URL, or an `/uploads/` path.
- **Severity:** Low. Admin-only input. Consequence: arbitrary external image hosts (tracking pixels, mixed content for `http://`). `javascript:` and `data:` are refused by the pattern.
- **Fix:** allow `https://` only, and/or only uploaded paths. Owner decision on whether external hosts are still wanted.
- **Regression test:** `http://` and external URLs are rejected if the decision is taken.
- **Status:** DEFERRED — OWNER DECISION (may break existing catalogue, which uses Unsplash URLs).

### SEC-C8 — Coupon usage-limit race
- **Location:** `server/src/controllers/couponController.js` (`updateCoupon`).
- **Behaviour:** the "limit cannot be lower than used count" check reads `usedCount` and then saves. A checkout that redeems the coupon between the read and the save can leave `usedCount > usageLimit`.
- **Mitigation:** checkout's redeem only succeeds while `usedCount < usageLimit`, so no extra redemption can happen.
- **Severity:** Low.
- **Fix:** conditional update: `findOneAndUpdate({_id, usedCount: {$lte: newLimit}}, {...})`.
- **Regression test:** concurrent redeem and limit reduction leave `usedCount <= usageLimit`, or the update is refused.
- **Status:** NOT STARTED.

### SEC-C9 — Guest order cancellation
- **Location:** `orderRoutes.js` (`/lookup/cancel`), `orderController.js` (`cancelLookup`).
- **Behaviour:** anyone with an order number and the order email can cancel it, if still `pending` or `confirmed`.
- **Severity:** Low. A leaked order number plus email enables a cancellation nuisance. Design choice, not a defect.
- **Status:** NOT APPLICABLE as a defect. Recorded for the owner. Owner decision if they want guest cancel removed.

## D. Business logic: checkout, inventory, coupons, orders

### SEC-D1 — Prices and totals are server-authoritative
- **Location:** `services/pricing.js` (`buildQuote`), `models/Order.js` (`checkTotals`), `controllers/orderController.js` (`create` reads only whitelisted fields).
- **Status:** VERIFIED by reading. Client cannot set prices or discounts.

### SEC-D2 — Stock cannot go negative under concurrency
- **Location:** `models/Product.js` (`reserveStock`, `releaseStock`), `services/orderService.js` (`placeOrder`).
- **Behaviour:** conditional `$gte` update per variant; transaction when available; otherwise rollback on failure.
- **Status:** VERIFIED by reading. Phase 1 tests exercised the seed; concurrency tests exist in the server suite (not re-read this session).

### SEC-D3 — Duplicate submissions (idempotency)
- **Location:** `services/orderService.js` (`createOrder`, `awaitClaimedOrder`), `models/Order.js` (`idempotencyKey` unique, sparse).
- **Behaviour:** key claimed first; duplicates return the original order; mismatched details are refused.
- **Status:** VERIFIED by reading.

### SEC-D4 — Standalone-MongoDB cancellation can leave stock unrestored after a crash
- **Location:** `services/orderService.js` (`cancelOrder`).
- **Behaviour:** without a transaction, the status flips to `cancelled` before stock is restored. A crash in between leaves `stockRestoredAt` empty, which the code documents.
- **Severity:** Medium on standalone MongoDB; **Low on Atlas or a replica set**, where it is atomic.
- **Fix:** a recovery job, or run production only on a replica set (already the deployment guidance).
- **Status:** DOCUMENTED LIMITATION. Requires a deployment decision.

### SEC-D5 — Order-number guessing
- **Location:** `utils/orderNumber.js`.
- **Behaviour:** 8 random characters from a 32-character alphabet (about 10^12 combinations) plus the date. Guest lookup also needs the email, and failures are limited per IP (10 per 15 minutes).
- **Severity:** Low.
- **Status:** VERIFIED by reading.

### SEC-D6 — Deactivated customer and checkout
- **Location:** `middleware/auth.js` (`optionalAuth`).
- **Behaviour:** a deactivated customer with a signed-in cookie is refused at checkout and the cookie is cleared. Guest checkout with the same email remains possible.
- **Severity:** Info. Documented behaviour.
- **Status:** VERIFIED by reading.

### SEC-D7 — Customer order history limited to 50
- **Location:** `orderController.js` (`mine`).
- **Behaviour:** `limit(50)`, no pagination. A customer with more than 50 orders cannot see older ones.
- **Severity:** Medium (functional, not security).
- **Fix:** paginate with the existing `parsePaging` helper.
- **Regression test:** page 2 returns the older orders.
- **Status:** NOT STARTED. Behaviour change; confirm before implementing.

## E. Database models and indexes

- **Indexes present:** `User.email` (unique); `Product.slug` (unique), `category`, `gender`, `effectivePrice`, `isActive`, text index on name and description, `price`, `sold`, `isFeatured`, `isActive+createdAt`; `Order.orderNumber` (unique), `user`, `customer.email`, `status`, `createdAt`, `idempotencyKey` (unique, sparse); `Coupon.code` (unique).
- **Finding SEC-E1 — Search does not use the text index.** `productQuery.js` builds regex searches on `name` and `description`, so each search scans the collection. **Severity:** Low at current size. **Fix:** use `$text` for relevance search, or accept scans until the catalogue grows. **Status:** DEFERRED — performance decision.
- **Finding SEC-E2 — Admin customer and order search scans.** Same cause as E1. **Severity:** Low. **Status:** NOT STARTED.
- **N+1 queries:** none found in the paths read. Customer list uses one aggregate for all rows; order and product lists use `populate` or a single query.

## F. Frontend API handling and error states

- **`client/src/services/http.ts`:** all failures become `ApiClientError` with a message safe to show; network timeout after 15 seconds; `X-Requested-With` added to every request; 401 on non-auth paths clears the signed-in state.
- **`client/src/context/AuthContext.tsx`:** loading state while the session is checked; offline treated as signed out.
- **`client/src/components/RouteGuards.tsx`:** admin guard shows a 403 page. Client guards are convenience only; the server enforces the same rules.
- **Finding SEC-F1 — Redirect parameter.** `safeNext` (`client/src/utils/safeNext.ts`) accepts only paths that start with a single `/`, with no backslash. Login and Register both use it, and redirects go through react-router `navigate`, so an external URL cannot be reached. **Severity:** Info (mitigated). **Status:** VERIFIED by reading. **Regression test:** not yet written. There is no client test runner in `client/package.json`, so this needs one (see section G).
- **Finding SEC-F2 — No client test runner.** `client/package.json` has no test script and no test dependency. Client routing, validation and redirect rules are untested. **Severity:** Medium (test coverage). **Status:** NOT STARTED.
- **Finding SEC-F3 — Field, Img, ErrorState, Pagination not reviewed.** These were not read in this session, so accessibility and error-state claims for them are unverified.

## G. Dependencies

**Unverified — needs `npm audit` run by the owner.** The assistant cannot execute `npm audit`.

- **React Router (client):** `client/package.json` declares `react-router-dom` `^6.28.1`. `client/package-lock.json` resolves `react-router-dom` **6.30.6**, `react-router` **6.30.6** and `@remix-run/router` **1.23.4** (read this session; the brief's figure is confirmed). Whether any advisory applies to 6.30.6 is **Unverified — needs `npm audit`**. Do not upgrade blindly. Application-level exposure to check: the only navigation that takes user input is `Login`/`Register` via `safeNext`, which returns internal paths only (SEC-F1).
- **Client build tooling (dev-only):** `vite` 5.4.21, `esbuild` 0.21.5, `typescript` 5.6.3, `tailwindcss` 3.4.19. These do not run in production; advisories against the dev server are relevant only if it is exposed on a network.
- **multer (server):** `server/package.json` declares `multer` `^1.4.5-lts.1`. multer 1.x is the line that has published denial-of-service advisories fixed in 2.x. This is a **major upgrade** (requires approval under the safety rules), and the audit must confirm applicability. **Severity: Medium to High if confirmed, because uploads are reachable by any admin session.**
- **Other server packages:** express ^4.21.2, mongoose ^8.9.5, jsonwebtoken ^9, bcryptjs ^2.4.3, sharp ^0.35.5, helmet ^8, express-rate-limit ^7.5, nodemailer ^6.9.16. Each needs an audit result to classify (production versus development, direct versus transitive).
- **Development-only:** vite, typescript, tailwind, autoprefixer, postcss — no runtime exposure, but still listed by the audit.

## H. Existing image architecture

- **Catalogue images:** external Unsplash URLs in `server/src/seed/catalog.js` (`POOLS`, `productImages`) and `client/src/data/images.ts`. Several products share photos (the repetition problem already in the register).
- **Admin uploads:** `server/src/services/imageService.js` writes to `config.uploadsDir/products`, served at `/uploads/products/<random>.webp` by `app.js` with `maxAge: '7d'`.
- **Checker:** `client/scripts/check-images.mjs` checks Unsplash IDs only. It does not validate local `/uploads` files, which the brief requires.
- **Finding SEC-H1 — Uploaded images are not deleted when a product changes.** `deleteUploadIfUnused` exists in `imageService.js`. Whether every product edit path calls it was not verified in this session. **Severity:** Low (storage). **Status:** NOT VERIFIED.

## I. Test engineering

- **Server:** 374 tests, last recorded owner run 371 passed, 0 failed, 3 skipped (replica-set transaction tests, standalone MongoDB).
- **Client:** no automated tests (SEC-F2).
- **Recorded gap:** transaction tests need a replica set. The skipped tests must not be reported as passed.

## J. Second pass (reviewed; no new defects unless stated)

- `server/src/controllers/productController.js` (create, update, setStock, remove) and `services/productService.js`: field allow-list (`EDITABLE`), category existence check, slug generation, variant blank-row generation, image clean-up after save. **No defect.** `setStock` creates a missing variant with a conditional `$push` (`variants: { $not: { $elemMatch } }`). MongoDB applies single-document updates atomically, so two concurrent requests cannot create a duplicate row. The push skips schema validation, but size and colour membership is checked first.
- `server/src/services/mailer.js`: HTML escaped throughout; header-injection characters stripped from subject and name; recipient addresses checked with `isPlainEmail`; only error codes are logged; delivery is reported as sent only after the server accepts it. **No defect.**
- `client/src/components/Field.tsx`: label bound with `htmlFor`, `aria-invalid`, `aria-describedby`, and an inline error with `role="alert"`. Good. **No defect.**
- `client/src/components/ErrorState.tsx`: `role="alert"`, offline-specific wording, retry action. **No defect.**
- `client/src/components/Img.tsx`: lazy loading and a branded fallback on load error. Minor: `{...rest}` is spread after `onError`, so a caller passing `onError` would replace the fallback. **Low.** Fix: compose the handlers.

## L. Third pass: shell, pagination, grid, cart drawer

- **SEC-L1 — Cart drawer has no focus management (accessibility, Medium).** `client/src/components/CartDrawer.tsx`. It is a `role="dialog" aria-modal="true"`, with Escape to close and body scroll locked. But focus is not moved into the dialog when it opens, Tab can move to the page behind it, and focus is not returned to the trigger on close. Scenario: a keyboard or screen-reader user opens the cart and cannot tell that the page behind is inert. Fix: move focus to the close button on open, trap Tab inside the dialog, restore focus on close. Regression test: needs a client test runner (SEC-F2) or a browser check.
- **SEC-L2 — Pagination focus can be lost (accessibility, Low).** `client/src/components/Pagination.tsx`. Page buttons use the key `` `${p}-${i}` ``, which includes the array index, so React can remount the focused button after a page change. Fix: key on the page number only. Regression test: needs a client test runner or a browser check.
- **SEC-L3 — Loading state not announced (accessibility, Low).** `client/src/components/ProductGrid.tsx`. Skeletons have no `aria-busy` or live-region text, so screen-reader users get no feedback while products load. The `animate-pulse` class does not respect `prefers-reduced-motion` unless a rule in `index.css` disables it; that was not checked. Fix: a visually hidden status message, and a reduced-motion rule.
- **SEC-L4 — No meta description (SEO, Low).** `client/index.html` has a title and viewport, but no `<meta name="description">` and no social tags. Per-page titles are set through `useDocumentTitle`. Fix: a default description in `index.html` and per-page descriptions where useful.
- **Confirmed sound:** `lang="en"`; fonts self-hosted through `@fontsource`, so no third-party font requests; the Vite dev proxy forwards only `/api` and `/uploads` to the API; `Field` and `ErrorState` are accessible (section J); `Pagination` provides `nav` with `aria-label`, `aria-current` on the active page, and a results summary.
- **Not verified:** a Content-Security-Policy. No CSP is set in `index.html`, so it must come from the host or the API response headers; neither was checked.

## K. Still not reviewed

- Client CSP and hosting headers.
- Accessibility and responsive layout as rendered (requires a browser).
- Concurrency tests in the server suite (not re-read this session).


## K. Summary of priority

| Priority | Item | Why | Needs approval? |
|---|---|---|---|
| 1 | Dependency audit results (SEC-G, both packages) | Cannot classify risk without `npm audit` | No — owner runs the command |
| 2 | Per-account login throttle (SEC-A3) | Medium, no business-rule change | Confirm before implementing |
| 3 | Coupon limit race (SEC-C8) | Low, contained by the redeem condition | No |
| 4 | Customer order history pagination (SEC-D7) | Functional gap, behaviour change | Confirm |
| 5 | Client test runner and redirect tests (SEC-F2, SEC-F1) | Untested security-relevant code | No (test tooling is a dependency; confirm) |
| — | Logout revocation, token lifetime, registration message, external image hosts | Business or security decisions | Yes — owner |
| — | multer major upgrade, react-router upgrade | Major dependency change | Yes — owner approval, after audit output |
