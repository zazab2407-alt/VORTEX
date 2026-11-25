# VORTEX CHANGELOG

Every file created, modified or deleted is listed here, with its exact path, the change, the reason, and its test status.
Status values: **Passed** (executed and verified), **Failed**, **Pending** (not yet executed by the owner), **Not run** (not executed by the assistant).
The assistant cannot run Node, npm, MongoDB or archive tools in its environment, so every test is **Pending** until the owner runs it.

---

## 2026-11-22 — Catalog expansion (Task 1 and Task 2)

### Catalog expansion: 3 new categories and 24 new products

- Status: MODIFIED
- File: `F:\vortex\server\src\seed\catalog.js`
- Changes:
  - `CATEGORIES`: added 3 categories, bringing the total to 8: **Swimwear**, **Running Essentials**, **Yoga & Studio**. Each has an image taken from an existing pool.
  - `PRODUCTS`: added 24 products, bringing the total to 40. The 16 existing products are unchanged.
  - New products by category:
    - Swimwear (6): Tide Racerback Swimsuit, Current Swim Shorts, Riptide Training Swim Trunks, Pacific Swim Cap, Lagoon Two-Piece Set, Dryline Swim Towel.
    - Running Essentials (9): Sprint Split Shorts, Stride Singlet, Aero Half-Zip Pullover, Lumen Reflective Vest, Trail Runner Belt, Cadence Crop Tee, Pace Running Tights, Zephyr Running Jacket, Insight Running Socks (3-Pack).
    - Yoga & Studio (9): Lotus Wide-Leg Pants, Serene Yoga Top, Balance Pilates Bodysuit, Flow Studio Jumpsuit, Grounding Yoga Mat, Stretch Band Set, Calm Oversized Crewneck, Pose Lightweight Joggers, Ease Mobility Shorts.
  - Colours: only the existing palette (Black, White, Orange, Grey, Navy, Olive, Sand).
  - Sizes: only existing size values (`One Size`, `S/M/L`, `S/M/L/XL`, `XS–XL`, `S–XXL`).
  - Images: reuses existing Unsplash IDs from the `POOLS` in this file. No new IDs and no local paths.
  - Featured on 3 new products: Tide Racerback Swimsuit, Stride Singlet, Lotus Wide-Leg Pants.
  - Sale price on 4 new products: Lagoon Two-Piece Set, Pace Running Tights, Flow Studio Jumpsuit, Ease Mobility Shorts. Each sale price is below its regular price.
  - New arrivals (`daysAgo` under 30) on 4 new products: Tide Racerback Swimsuit (2), Zephyr Running Jacket (7), Stride Singlet (10), Calm Oversized Crewneck (18).
- Reason: Expand the VORTEX demo catalogue from 5 categories and 16 products to 8 categories and 40 products.
- Related functionality: homepage sections, Shop All, gender and category filters, search, sorting, product detail (size and colour selection), cart, wishlist, admin product list.
- Verification: **Pending.** Not executed by the assistant. Counts were verified by re-reading the file: 8 categories, 40 products, 7 featured, 8 on sale, 9 new arrivals, genders men/women/unisex.
- Known risk: `demoVariants()` assigns stock from a hash of the slug. The seed test requires every product to have at least one unit in stock. A product with only 2 variants (Pacific Swim Cap, Dryline Swim Towel) could, by chance, get zero stock on every variant. The owner's seed test run is the check. If it fails, adjust that product's stock data; do not remove the assertion.

### Seed test: updated expected counts

- Status: MODIFIED
- File: `F:\vortex\server\tests\seed.test.mjs`
- Changes:
  - Expected categories 5 → 8 and products 16 → 40 (in the seed summary assertion, the database count assertion, and the idempotency test).
  - Expected featured (best sellers) 4 → 7, on sale 4 → 8, new arrivals 5 → 9. Genders unchanged (men, women, unisex).
  - Test names updated to match.
- Reason: The seed test hard-coded the old catalogue. The counts were calculated from the final `catalog.js`. The Featured and Sale flags were not removed.
- Related functionality: seed script (`server/src/seed/seed.js`) and its database assertions.
- Verification: **Pending.** Requires `MONGO_TEST_URI` pointing at a throwaway database (never `vortex`). Run `npm test` in `F:\vortex\server`.

### Image checker: now also checks product images in catalog.js

- Status: MODIFIED
- File: `F:\vortex\client\scripts\check-images.mjs`
- Changes:
  - Reads two sources: `F:\vortex\client\src\data\images.ts` (unchanged source) and `F:\vortex\server\src\seed\catalog.js` (product and category photos).
  - Each unique photo ID is checked once. The output shows which file(s) use it, for example `[images.ts, catalog.js]`.
  - Same output format, HEAD request, content-type check and exit codes as before. New: a clear error message if either file cannot be read.
  - The "broken ID" message names both files as places to fix an ID.
- Reason: The original checker covered only storefront photos, so product photos seeded from `catalog.js` were never verified.
- What it validates: for each ID matching `photo-<hex>-<hex>` in either file, it sends a HEAD request to `https://images.unsplash.com/<id>` and requires an HTTP success status and an `image/*` content type. Unreachable network is reported separately from broken IDs.
- Verification: **Pending.** Run `npm run check:images` in `F:\vortex\client` (needs internet). Not run by the assistant.

### Changelog file created

- Status: CREATED
- File: `F:\vortex\handoff\CHANGELOG.md`
- Changes: This file.
- Reason: Required by the project change-tracking rules.
- Verification: Not applicable.

---

## 2026-11-22 — Documentation, database safety and source ZIP (Task 2 to Task 5)

### README rewritten

- Status: MODIFIED (full rewrite)
- File: `F:\vortex\README.md`
- Changes:
  - Catalogue documented: 8 categories and 40 products.
  - New "Seeding the demo catalogue" section: warning that the seed deletes data in whichever database `MONGO_URI` points to; the seed does not check the database name; recommended `vortex_playground` commands; explanation that dotenv does not overwrite shell variables.
  - Admin account creation documented against the same playground database.
  - Test section adds `npm run check:images` and describes what it validates; notes that seed tests use `MONGO_TEST_URI`.
  - Admin area corrected: Coupons and Customers screens exist but are not yet compiled or browser-tested.
  - Known limitations updated to match.
  - `handoff/` added to the folder structure.
- Reason: The old README said the coupon and customer screens were not built, did not document the catalogue, and did not warn that the example `MONGO_URI` points at `vortex`.
- Verification: **Not run** (documentation only). Commands in the README have not been executed by the assistant.

### PHASE7_HANDOFF.md update note

- Status: MODIFIED
- File: `F:\vortex\PHASE7_HANDOFF.md`
- Changes: One update note added under the existing top notes. It records the catalogue expansion, the image checker change, the new README, that the ZIP was not created, and that Phase 7 is NOT complete.
- Reason: Keep the handoff current without rewriting the historical report.
- Verification: Not applicable (documentation only).

### VORTEX_NEW_CHAT_HANDOFF.md updated

- Status: MODIFIED
- File: `F:\vortex\handoff\VORTEX_NEW_CHAT_HANDOFF.md`
- Changes:
  - Section 6: seed bullet now gives the catalogue size and the `vortex_playground` safety step.
  - Section 15 added: catalogue expansion, what changed, and what was not executed.
- Reason: The next session needs the seed risk and the current catalogue size.
- Verification: Not applicable (documentation only).

### VORTEX_PROGRESS.md updated

- Status: MODIFIED
- File: `F:\vortex\VORTEX_PROGRESS.md`
- Changes: Section 30 appended. It lists the source and documentation changes, the database-safety analysis from reading `env.js`, `package.json` and `.env.example`, and what is still pending.
- Reason: The progress log is the permanent record of status.
- Verification: Not applicable (documentation only).

### Source ZIP: NOT created

- Status: NOT CREATED
- Intended path: `F:\vortex\handoff\VORTEX_COMPLETE_SOURCE.zip`
- Reason: The assistant's filesystem tools can write text files but cannot create a binary ZIP, and its shell runs in a separate Linux container, not on the owner's PC.
- Verification: Not possible. Nothing has been verified about a ZIP. The owner must create it with PowerShell (see the session report) and then verify its contents.

---

## Not yet done (remaining work)

- Source ZIP not created (see above).
- Owner-run checks not yet executed: `npx tsc -b`, `npm run build`, `npm run check:images` (client); `npm test` (server).
- Recommended, needs owner approval: change `server/.env.example` `MONGO_URI` from `vortex` to a playground value. (The database-name guard in `seed.js` is now done; see the entry below.)
- `createAdmin.js` has been read (see the admin status entry below). It uses the same `MONGO_URI` as the seed and has no database-name guard.
- Phase 7 remains incomplete (see `PHASE7_HANDOFF.md` section D).

## 2026-11-22 — Admin status correction, database-safety review and ZIP script (no source changes)

### Documentation corrected: admin screen status

- Status: MODIFIED
- Files:
  - `F:\vortex\VORTEX_PROGRESS.md`: sections 3, 9, 11 and 28 changed so they no longer describe the Coupons and Customers screens as missing or unbuilt. Section 28 is marked as superseded by section 29.
  - `F:\vortex\PHASE7_HANDOFF.md`: sections B3, C6, D3 and D4 changed to show the admin screens as written (not compiled or run).
- Reason: The docs contradicted the code. The files exist and are wired into `App.tsx` and `AdminLayout.tsx`.
- Verification: Documentation only. Not tested. The screens themselves are **not compiled, built or browser-tested**.
- Checked: `README.md` already described the screens correctly and was not changed.

### Files inspected (read only, no changes)

- `F:\vortex\client\src\pages\admin\Coupons.tsx`, `Customers.tsx`, `CustomerDetail.tsx`, `AdminLayout.tsx`, `F:\vortex\client\src\App.tsx`: present and wired. Their dependencies were also checked (`services/admin.ts`, `types/index.ts`, `components/Field.tsx`, `ConfirmDialog.tsx`, `StatusBadge.tsx`) and exist with matching signatures. Not compiled.
- `F:\vortex\server\src\seed\createAdmin.js` and `adminAccount.js`: read. Not changed. Connects through `config/db.js`, so it uses the same `MONGO_URI` as the seed. It has no database-name check.
- `F:\vortex\server\src\seed\seed.js`: read. Not changed. Not run.

### Not changed in this session

- No source code, test, seed, dependency, or environment file was changed.
- Seed, tests and builds were not run.
- No ZIP was created. A corrected PowerShell script was prepared for the owner to run; it is not stored in the repository.
- `F:\vortex\handoff\VORTEX_COMPLETE_SOURCE.zip`: still does not exist.

## 2026-11-22 — Seed database guard (implemented; NOT run) — partly superseded: see "Guard helpers moved" below

### `seed.js`: database guard

- Status: MODIFIED
- File: `F:\vortex\server\src\seed\seed.js`
- Changes:
  - Added `SEED_DATABASE = 'vortex_playground'` (exported). CORRECTED: the helpers now live in `F:\vortex\server\src\seed\databaseGuard.js` and are re-exported from `seed.js`.
  - Added `databaseNameFromUri(uri)` (exported): reads only the database path from a `mongodb://` or `mongodb+srv://` URI, returns `''` if none can be read. It never returns credentials or hosts.
  - Added `isSeedDatabase(uri)` (exported): true only when the name is exactly `vortex_playground`.
  - CLI block only: check 1 runs before connecting and refuses with exit code 1, without printing the URI. Check 2 runs after `connectDB()` and compares `mongoose.connection.name`; on mismatch it throws, the existing `finally` disconnects, and the seed does not run.
  - Added `import mongoose from 'mongoose'`.
  - `seedCatalog()` is unchanged, so the existing tests that use their own databases are not affected.
  - No bypass flag and no environment variable bypass. The existing `--force` still affects only the production check.
- Reason: The seed deletes all demo data in whichever database `MONGO_URI` names. Nothing previously checked the name.
- Related functionality: `npm run seed` only.
- Verification: **Not run.** No seed, test or build was executed. The behaviour is untested until the owner runs the new tests and, when ready, the seed against `vortex_playground`.

### `server/tests/seedGuard.test.mjs`: new unit tests

- Status: CREATED
- File: `F:\vortex\server\tests\seedGuard.test.mjs`
- Changes: No-database tests for `SEED_DATABASE`, `databaseNameFromUri` and `isSeedDatabase`. They cover: the exact name accepted (single host, replica set, multi-host and `mongodb+srv` with credentials); `vortex`, `vortex_test`, `vortex_playground2`, `vortex_playgrounds`, `vortex_playground_test` and `Vortex_Playground` refused; a trailing slash refused; the name only in the host refused; missing or empty URIs refused; a raw slash in credentials fails closed; credentials and hosts never returned.
- Reason: Prove the guard's rules without touching any database.
- Verification: **Pending.** Run `npm test` in `F:\vortex\server` (or `node --test tests/seedGuard.test.mjs`). CORRECTED: the test file now imports `databaseGuard.js` directly and sets no environment variables. The verification status is unchanged: Pending.

### `README.md`: seeding section updated

- Status: MODIFIED (full rewrite)
- File: `F:\vortex\README.md`
- Changes: The seeding warning now describes the guard (exact name, checked before and after connecting, no bypass). The old statement that the database name was not checked was removed. Admin-account section notes that `create-admin` has no guard. Tests section lists `seedGuard.test.mjs`. The known-limitations entry on images now says the image plan is awaiting owner approval (see `VORTEX_PROGRESS.md` section 32).
- Reason: The old text described behaviour that no longer exists.
- Verification: Not applicable (documentation only).

### `VORTEX_NEW_CHAT_HANDOFF.md`: seed bullet updated

- Status: MODIFIED
- File: `F:\vortex\handoff\VORTEX_NEW_CHAT_HANDOFF.md`
- Changes: Section 6 seed bullet now describes the guard.
- Verification: Not applicable (documentation only).

### `VORTEX_PROGRESS.md`: database-safety notes updated; section 31 added

- Status: MODIFIED
- File: `F:\vortex\VORTEX_PROGRESS.md`
- Changes: Two section 30 lines updated to describe the guard. Section 31 added.
- Verification: Not applicable (documentation only).

### Not changed

- `F:\vortex\server\src\seed\catalog.js`, the seed test, all application source code, `.env` files, and the database were not changed.
- The ZIP script was not changed or run. `F:\vortex\handoff\VORTEX_COMPLETE_SOURCE.zip` still does not exist.
- Phase 7 is still **not complete**.

## 2026-11-22 — Guard helpers moved; documentation corrections (NOT run)

### `server/src/seed/databaseGuard.js`: new module

- Status: CREATED
- File: `F:\vortex\server\src\seed\databaseGuard.js`
- Changes: Contains `SEED_DATABASE`, `databaseNameFromUri(uri)` and `isSeedDatabase(uri)`, moved unchanged from `seed.js`. The module has **no imports**, so loading it cannot load configuration, models or a database driver, and cannot open a connection.
- Reason: So the unit tests can check the guard without loading `config/env.js` or the models, which could exit the test process on a bad `.env`.
- Verification: **Not run.** Pending owner run of `npm test` in `F:\vortex\server`.

### `server/src/seed/seed.js`: imports and re-exports the helpers

- Status: MODIFIED
- File: `F:\vortex\server\src\seed\seed.js`
- Changes:
  - The three helpers are now imported from `./databaseGuard.js` and re-exported, so existing imports of `seed.js` still work.
  - The local definitions were removed.
  - **Unchanged:** `seedCatalog()`, and both CLI database checks (check 1 before connecting, check 2 after connecting, with the same messages and exit codes). No bypass has been added.
- Reason: Move the guard helpers into a module with no side effects.
- Verification: **Not run.** No seed, test or build was executed.

### `server/tests/seedGuard.test.mjs`: imports from `databaseGuard.js`

- Status: MODIFIED
- File: `F:\vortex\server\tests\seedGuard.test.mjs`
- Changes: Imports directly from `../src/seed/databaseGuard.js`. The test cases are unchanged. The environment-variable setup is removed, because the module no longer loads configuration.
- Reason: The unit tests should not depend on configuration or models.
- Verification: **Pending.** Run `npm test` in `F:\vortex\server`.

### `README.md`: image-plan reference corrected

- Status: MODIFIED
- File: `F:\vortex\README.md`
- Changes: The known-limitations line about images no longer refers to a non-existent "image plan". It now says that an image sourcing plan is awaiting owner approval and that no images have changed, with a pointer to `VORTEX_PROGRESS.md` section 32.
- Verification: Not applicable (documentation only).

### `handoff/CHANGELOG.md`: image-plan reference corrected

- Status: MODIFIED
- File: `F:\vortex\handoff\CHANGELOG.md`
- Changes: Corrected the earlier reference in the guard entry (this line), and added this entry.
- Verification: Not applicable (documentation only).

### `VORTEX_PROGRESS.md`: header, sections 12 and 13 updated; section 32 added

- Status: MODIFIED
- File: `F:\vortex\VORTEX_PROGRESS.md`
- Changes:
  - The header was stale ("Session 2 ... no application source code modified"). It now states the current status and says that the historical text below is preserved.
  - Sections 12 and 13 keep their original Session 2 text, labelled HISTORICAL, and point to section 32 for the current lists.
  - Section 32 added: current file summary since Session 2, and the image-sourcing status (plan awaiting approval; nothing downloaded or changed).
- Verification: Not applicable (documentation only).

### Not changed

- `seedCatalog()`, all other application source, the seed test, `catalog.js`, `.env` files and the database were not changed.
- No seed, test, build or ZIP script was run. No database connection was made.
- `F:\vortex\handoff\VORTEX_COMPLETE_SOURCE.zip` still does not exist. Phase 7 is still **not complete**.

## 2026-11-22 — Destructive-operation protection: seedCatalog(), setupApi(), testUri() (NOT run)

Owner-tested result before this change: `node src/seed/seed.js` with `MONGO_URI` pointing at `vortex` was refused by the CLI guard with: `Refusing to seed: MONGO_URI must name the database "vortex_playground" (found "vortex"). Nothing was changed.`

### `server/src/seed/databaseGuard.js`

- Status: MODIFIED
- File: `F:\vortex\server\src\seed\databaseGuard.js`
- Changes: Added `isTestDatabase(name)` (true only for `vortex_test_` followed by a non-empty suffix of letters, digits, `_` or `-`; case-insensitive suffix) and `isResettableDatabase(name)` (true only for `vortex_playground` or a test database). `SEED_DATABASE`, `databaseNameFromUri` and `isSeedDatabase` are unchanged.
- Reason: One shared definition of which databases a reset may touch.
- Verification: **Not run.**

### `server/src/seed/seed.js`

- Status: MODIFIED
- File: `F:\vortex\server\src\seed\seed.js`
- Changes: `seedCatalog()` now checks `mongoose.connection.name` before its first delete. If the name is not resettable it throws, with a message that says nothing was changed. The import line gained `isResettableDatabase`. Both CLI checks are unchanged.
- Reason: `seedCatalog()` was callable by any code that imports `seed.js`, with no check of its own.
- Verification: **Not run.**

### `server/tests/helpers.mjs`

- Status: MODIFIED
- File: `F:\vortex\server\tests\helpers.mjs`
- Changes:
  - Imports `isResettableDatabase` and `isTestDatabase` from `../src/seed/databaseGuard.js`.
  - `testUri(name)` now requires the base database to be exactly `vortex_test` (or no database name, which defaults to `vortex_test`), and builds `vortex_test_<name>`, which must pass `isTestDatabase`. The old check (the database name merely contains "test") is removed. Error messages name the base database but never print the URI.
  - `setupApi()`: after connecting and before `dropDatabase()`, checks `mongoose.connection.name` with `isResettableDatabase`; on refusal it disconnects and throws without dropping or seeding.
- Behaviour change for the owner: `MONGO_TEST_URI` must end in `/vortex_test` (the README already says so). Any other base name is refused.
- Reason: Previously any database name containing "test" was accepted.
- Verification: **Not run.**

### `server/tests/seedGuard.test.mjs`

- Status: MODIFIED
- File: `F:\vortex\server\tests\seedGuard.test.mjs`
- Changes: Kept all earlier cases. Added cases for: allowed names (`vortex_playground`, `vortex_test_<suffix>`); rejected names (`vortex`, `vortex_test` with no suffix, `vortex_test_` with empty suffix, names that only contain "test", suffixes with `/`, `.`, space or `$`, empty, undefined, null, non-strings); `testUri()` with no env, a `vortex_test` base, a replica-set query option, a base of `vortex`, `vortex_playground` or `mytest`, invalid test names, and error messages that do not include credentials.
- Reason: Prove the rules without touching any database.
- Verification: **Pending.** Run `npm test` in `F:\vortex\server` (or `node --test tests/seedGuard.test.mjs`).

### Not changed

- `F:\vortex\server\.env` and all other `.env` files: not read or modified.
- The `vortex` database: not accessed or modified.
- No seed command, test, build or ZIP was run. No database connection was made.
- `seedCatalog()`'s catalogue logic, the CLI checks, and all other application code are unchanged.
- Phase 7 is still **not complete**.

## 2026-11-22 — Repair Phase 1: stock generator and outdated test expectations (TESTED)

Context: the owner's full run (`F:\vortex\handoff\test-logs\full-run-security-fix.txt`) reported 374 tests, 356 passed, 15 failed, 3 skipped. Fifteen failures: 14 outdated expectations and 1 seed-data issue (Dryline Swim Towel had zero stock).

**Test result after Phase 1 (owner-run on Windows, full suite `npm test` in `F:\vortex\server`, standalone MongoDB):** Tests 374; Passed 371; Failed 0; Skipped 3; Cancelled 0.

The 3 skipped tests are the replica-set-only transaction subtests in `transactions.test.mjs`. They require a MongoDB Replica Set and skip on the standalone MongoDB used for this run. They were NOT run and are NOT claimed as passed. They still need a replica-set run.

### `F:\vortex\server\src\seed\catalog.js`

- Status: MODIFIED
- Change: `demoVariants()` returns the same rows as before. If every generated row would have zero stock, the first row gets stock 2. Products with at least one available variant are unchanged.
- Reason: Dryline Swim Towel (slug `dryline-swim-towel`, hash 211) generated zero stock for both colours.
- Related functionality: seeded stock only. No runtime checkout, inventory or admin logic changed.
- Verification: **TESTED.** Full suite passed on the owner's Windows machine (see the result above).

### `F:\vortex\server\tests\admin.test.mjs`

- Status: MODIFIED
- Change: outdated counts updated to the catalogue (products 40, public products 39, categories 9 admin / 8 public, paging with 40 products). The search term for the hidden-product check changed from `cap` to `pro cap`, because Pacific Swim Cap also matches `cap`. Assertions and meanings are unchanged.
- Verification: **TESTED.** Passed in the owner's full suite run (see the result above).

### `F:\vortex\server\tests\products.api.test.mjs`

- Status: MODIFIED
- Change: outdated expectations updated to the catalogue: totals, paging (40 products, 4 pages), cheapest effective price 14, gender counts (men 25 / exact 13 / women 27 / exact 15 / unisex 12), XS count 15, collection counts (new 9, best 7 names, sale 8), search "hood" (adds Zephyr, which matches its description), search "tee" with women filter (adds Cadence Crop Tee), categories (8, sum 40), and the inactive-product search term changed from `singlet` (which also matches Stride Singlet) to `test runner singlet`.
- Verification: **TESTED.** Passed in the owner's full suite run (see the result above).

### Not changed

- No product names, slugs, prices, descriptions, categories or sizes. The 13 renames and the Calm move were not applied.
- No authentication, authorization, checkout, payment, inventory or admin logic.
- No database configuration, and no database was touched by the assistant.

## 2026-11-22 — Phase 7 continuation: currency sweep (NOT compiled or tested)

### Files modified

- `F:\vortex\client\src\pages\admin\ProductForm.tsx`: the two price labels (`Price ($)`, `Sale price ($, optional)`) now use `currencySymbol` from `useShopConfig()`.
- `F:\vortex\client\src\pages\Shop.tsx`: the price-range filter chip uses `currencySymbol` instead of a hard-coded `$`.
- `F:\vortex\client\src\components\FilterPanel.tsx`: the price-range labels use `currencySymbol` instead of a hard-coded `$`.
- Reason: the only hard-coded currency symbols found by reading the client source. All other money output goes through `formatPrice()` or the config-driven shipping text.
- Verification: **NOT compiled, built or browser-tested.** `npx tsc -b` and `npm run build` must be run by the owner. The `label` prop of `components/Field.tsx` was not read in this session; it is assumed to accept a string, which the template literal provides.

### Read and found clean (no change)

Admin: Dashboard, Orders, OrderDetail, Products, Coupons, Customers, CustomerDetail. Storefront: Cart, Checkout, ProductDetail, Shop (apart from the chip above), Account, OrderConfirmation, OrderDetail, TrackOrder, Wishlist, Home, Login, Register, Faq, Returns, Privacy (via `PolicyPage`), Contact. Components: ProductCard, CartDrawer, OrderView, Footer, AnnouncementBar, Navbar, Layout, PolicyPage, RouteGuards, FilterPanel (apart from the labels above). Data and utilities: content.ts, storeText.ts, policies.ts, format.ts, useShopConfig.ts, CartContext.tsx.

Not read in this session (small presentational or service modules): Field, Pagination, ErrorState, ConfirmDialog, StatusBadge, Rating, QuantitySelector, ProductGrid, SectionHeading, Reveal, Img, Logo, NotFound, services, AuthContext, ToastContext, WishlistContext.

### Confirmed in source during this review (no change needed)

- Routes for `/faq`, `/contact`, `/privacy`, `/returns`, `/admin/coupons` and `/admin/customers` exist in `App.tsx`.
- `ConfigGate` (keyed remount on currency or locale change) is present in `App.tsx`.
- The newsletter form is not present in `Home.tsx`. The handoff report's statement that the edit failed is out of date.
- Admin sidebar links for Coupons and Customers exist in `AdminLayout.tsx`.

### Known limitations left in place

- `PRICE_MIN` and `PRICE_MAX` (0 to 150) in `FilterPanel.tsx` and the price slider are fixed in the store currency's scale. With a currency of very different magnitude, the slider range would need a server-side setting. Not changed: a business decision.
- Contact page and policy placeholders: `Contact.tsx` writes `[PLACEHOLDER ...]` inline as plain text, while `PolicyPage` highlights placeholders. Not changed.

### Not changed

- No product, checkout, payment, inventory, authentication or database behaviour. No catalogue content. No `.env` file. No database.
- No test was run. No build was run. No ZIP was created.

## 2026-11-22 — Security batches: Nodemailer (D1), login throttle (A1), coupon atomic update (A2) — IMPLEMENTED, NOT VERIFIED

All changes below are implemented in source and tests. **None has been run.** The assistant cannot run `npm`, `node` or MongoDB. Owner must run the checks listed for each batch and paste the output.

### D1 — Nodemailer (part 1: code and test; dependency bump pending)

- `F:\vortex\server\src\services\mailer.js`: transport construction moved to `createSmtpTransport(smtp, overrides)`, exported. Same options as before (`secure` for port 465, `auth`, `connectionTimeout` 8000, `greetingTimeout` 8000, `socketTimeout` 15000). `getTransport()` calls it. No behaviour change.
- `F:\vortex\server\tests\mailerSmtp.test.mjs` (CREATED): real Nodemailer transport against a local SMTP stub built on Node's built-in `net` module. Covers verify (EHLO, AUTH PLAIN), a complete confirmation message accepted with the envelope recipient checked, `greetingTimeout` honoured (a silent server fails within 3 s), and a rejected login reported as a failure.
- Reason: `mailer.test.mjs` injects a fake transport in every case, so the suite never ran Nodemailer itself.
- **Dependency NOT changed.** `server/package.json` and `server/package-lock.json` are unchanged. The assistant cannot run `npm install`, and editing the manifest without regenerating the lockfile would break `npm ci`. The exact command is in the session report.
- Verification: **Not run.** Owner: `cd F:\vortex\server` then `npm test`.

### A1 — Per-account login throttle

- `F:\vortex\server\src\middleware\rateLimiter.js`: added `ACCOUNT_LOGIN_WINDOW_MS` (15 minutes), `ACCOUNT_LOGIN_LIMIT` (30), `createAccountLoginLimiter({ windowMs, limit })` and `loginAccountLimiter`. Fixed window per normalised email (or per IP if no email is supplied). Only failed attempts count. The 429 message is the same whether or not the account exists. No permanent lockout.
- `F:\vortex\server\src\routes\authRoutes.js`: `POST /auth/login` now runs `authLimiter` (per IP, unchanged) then `loginAccountLimiter`, before validation.
- `F:\vortex\server\tests\loginThrottle.test.mjs` (CREATED): unit tests of the window (429 on the fourth failure, separate emails independent, case and spaces normalised, window expiry after 450 ms) and database tests (30 failures from 30 addresses via `X-Forwarded-For` with `trust proxy` set, the 31st refused; a correct password is refused while throttled; unknown and real emails get identical 401 and 429 bodies; 40 successful logins are not counted; a throttled account does not block another).
- Known residual risk: a distributed attacker can throttle a real customer's login for up to 15 minutes. This is the accepted trade-off for approved design.
- Verification: **Not run.**

### A2 — Coupon update is one atomic write

- `F:\vortex\server\src\controllers\couponController.js`: `updateCoupon` rewritten. It computes every requested change, validates the coupon in memory with the same schema rules, then issues one `findOneAndUpdate` whose filter re-checks: `usedCount: 0` while the code is changing, and `usedCount <= newLimit` when the limit changes. If the write matches nothing, the current state is read and the specific reason is returned (code used, limit below usage, or a concurrent change). Nothing is partially applied. `usedCount` is never written from this endpoint. All other functions are unchanged.
- Business rules preserved: a used coupon keeps its code; the limit cannot be lower than the usage count; the expiry must be in the future when changed.
- `F:\vortex\server\tests\couponAtomic.test.mjs` (CREATED): refused limit change applies no other field; limit equal to usage accepted; multi-field edit applied entirely, including clearing fields; used coupon keeps its code while other fields change; invalid field refuses the whole edit; `usedCount` never written; concurrency tests (limit reduction against six parallel checkouts, and a code change against two parallel redemptions of the old code).
- Verification: **Not run.** Note: the old code called `save()`; the new code calls `validate()` and a single `findOneAndUpdate`. `Coupon.js` was read earlier and has no `pre('save')` hook that would now be skipped; owner should confirm with the test run.

### Not changed in this batch

- `server/package.json`, `server/package-lock.json`, `client/package.json`, `client/package-lock.json`: unchanged.
- No commit, no stage, no push. Existing uncommitted changes preserved.

## 2026-11-22 — Coupon rename vs. redemption race fixed — IMPLEMENTED, NOT VERIFIED

Owner run (replica set): 396 tests, 395 passed, 1 failed. Failure: `couponAtomic.test.mjs` "concurrency: a code change cannot race a redemption of the old code".

**Cause:** checkout looked the coupon up by code (`buildQuote`, `Coupon.findOne({ code })`) and later redeemed it by `_id` only (`Coupon.redeem(id)`). A rename committed between those two steps (usage count still 0, so the rename was allowed) and the redemption still succeeded on the renamed coupon. The order was saved with the old code, so the usage was recorded on a coupon the order no longer names, and the cancellation refund (looked up by code) could never find it.

**Fix:**
- `F:\vortex\server\src\models\Coupon.js`: `redeem(id, options)` accepts an optional `code`; when given it is part of the atomic filter, so a renamed coupon refuses the stale redemption. Calls without `code` behave as before.
- `F:\vortex\server\src\services\orderService.js`: checkout redeems with the quoted code. If the redemption is refused because the code changed, it returns a 400 "no longer valid" message (the usage-limit 409 is unchanged). The check runs in the same transaction when one is in use.
- `F:\vortex\server\tests\couponAtomic.test.mjs`: two regression tests added (model-level binding, and checkout with an old code after a rename). The failing concurrency test is unchanged.

No change to coupon business rules. A used coupon still keeps its code; the rename itself is still refused while the coupon has been used.

- Verification: **Not run.** Owner: `npm test` in `F:\vortex\server` (replica set).

## Unrelated existing issues noted (not changed)

- `server/src/seed/seed.js` deletes all products, categories, reviews and demo users before reseeding. It has a production guard, and since the database guard was added it refuses any database other than `vortex_playground`.
- `client/src/data/catalog.ts` and `server/src/seed/catalog.js` duplicate the colour palette. They must be kept in sync by hand.
- `server/.env.example` defaults `MONGO_URI` to the original `vortex` database.


---

## 2026-11-24 — Coupon rename vs. checkout race: stress evidence

### Stress harness added

- Status: CREATED
- File: `F:\vortex\server\tests\stress\couponRace.stress.mjs`
- Not part of `npm test` (the name does not match `*.test.mjs`). Run it manually; it needs `MONGO_TEST_URI`.
- What it does: boots the real app through `setupApi`, then in every iteration races the real `PATCH /admin/coupons/:id` (rename) against several real `POST /orders` checkouts using the OLD code, plus two checkouts using the NEW code, with randomised start order and jitter. Every 5th iteration the coupon is already used before the rename.
- Checked after every race: coupon code, `usedCount`, number of orders under the old and new code, `usedCount <= usageLimit`, no 5xx responses, stock changed by exactly the number of orders created, and the rule "a renamed coupon was never redeemed under its old code".
- Each worker uses its own database (`vortex_test_<STRESS_NAME>`).
- Test status: **Passed** (executed by the assistant, results below).

### Results (MongoDB 8.2 on Windows, Node v26.13.0)

| Scenario | Workers x iterations | Orders per race | Races | Violations | Rename won / refused |
|---|---|---|---|---|---|
| Replica set `rs0`, idle machine | 4 x 500 | 3 old + 2 new code | 2000 | 0 | 359 / 1641 |
| Replica set `rs0`, while the full server suite ran | 4 x 300 | 8 old + 2 new code | 1200 | 0 | 190 / 1010 |
| Standalone (compensating-rollback path) | 4 x 250 | 4 old + 2 new code | 1000 | 0 | 171 / 829 |

- Both outcomes occurred in volume: the rename won and every old-code checkout was refused, or a checkout won and the rename was refused with 409.
- Full server suite on the replica set: 9 consecutive runs, each 398 tests, 398 passed, 0 failed, 0 skipped, 0 cancelled. `couponAtomic.test.mjs` alone: 10 runs, 10/10 passed.
- The earlier single failure of `concurrency: a code change cannot race a redemption of the old code` could NOT be reproduced. No production code was changed because no failing interleaving was found. No deterministic regression test was added, since no reproducible race exists to pin down. The existing deterministic tests (`redemption is bound to the code...` and `after a rename, checkout with the old code is refused...`) are unchanged.
- Possible explanation (not proven): `Coupon.js`, `couponController.js` and `orderService.js` carry uncommitted changes, including the code-bound `Coupon.redeem`. The failing run may have executed before those changes were saved. If it fails again, keep the full TAP output and re-run the stress harness with the same `MONGO_TEST_URI`.

### Local test infrastructure

- A throwaway replica set was started for testing: `mongod --replSet rs0 --port 27020 --dbpath C:\data\vortex-rs`, URI `mongodb://127.0.0.1:27020/vortex_test?replicaSet=rs0`. It is outside the repository and does not touch the `vortex` database on port 27017.

---

## 2026-11-24 — Nodemailer 6.10.1 → 10.6.1

### Dependency upgrade

- Status: MODIFIED
- Files: `F:\vortex\server\package.json` (`"nodemailer": "^6.9.16"` → `"^10.6.1"`), `F:\vortex\server\package-lock.json` (nodemailer 6.10.1 → 10.6.1; no other package changed).
- Installed with `npm install nodemailer@^10.6.1` (no `--force`, no other dependency touched). Backups of both files were taken first in `%TEMP%`.
- Why: the baseline `npm audit` in `server/` reported one HIGH vulnerability, nodemailer `<=10.1.3`, with 10.6.1 as the fix. The upstream changelog and advisory databases also list fixes for older ranges (for example the CRLF injection in the transport `name` option fixed in 8.0.5, and the nested-recipient-array stack exhaustion fixed in 10.0.2).
- Breaking changes reviewed in the official changelog (6.10.1 → 10.0.11 was read in full; 10.6.1 was confirmed as the registry `latest` with `engines.node >= 20`):
  - 7.0.0: SES SDK changes. Not used by this project.
  - 8.0.0: error code `NoAuth` renamed `ENOAUTH`. Nothing in `server/` references `NoAuth`; the code only logs `err.code`, and the existing tests use `EAUTH`, which is unchanged.
  - 9.0.0: TLS certificates are now validated by default for HTTPS fetches (attachment URLs, OAuth2, proxy CONNECT). The project does not use these.
  - 10.0.0: Node.js 20+ required; TypeScript rewrite with ESM and CommonJS builds. Verified: `import nodemailer from 'nodemailer'` (used in `src/services/mailer.js`) works on Node v26.13.0.
- No source change was needed in `src/services/mailer.js`: `createTransport` options (host, port, secure, auth, connectionTimeout, greetingTimeout, socketTimeout), `sendMail` and `verify()` behave as before.
- Test status: **Passed** (see below).

### Tests extended

- Status: MODIFIED (uncommitted file; existing 4 tests and all existing assertions unchanged)
- File: `F:\vortex\server\tests\mailerSmtp.test.mjs`: 4 → 18 tests, using the real Nodemailer transport against a local SMTP stub built on Node's `net` module.
- The stub gained options: `rcptReply`, `dataReply`, `stallAfterEhlo`, `dropAfterGreet`.
- New coverage:
  - SMTP errors: 550 recipient rejection, 451 temporary failure, 554 refusal after DATA (each reported with its response code, nothing stored).
  - Connection failures: connection refused; connection dropped on the first command after the greeting.
  - Timeouts: `socketTimeout` with a server that stops answering; the production `timeoutMs` limit in `mailer.js` with a stalled server.
  - Production functions over real SMTP: `sendOrderConfirmation` ({ sent: true } only after acceptance; { sent: false, reason: 'failed' } on rejection; logs only the error code, never credentials or the customer address), `verifySmtp` (ok / `EAUTH` / unreachable).
  - Message formatting: standard headers, multipart text + HTML in UTF-8, non-ASCII names, HTML escaping, CR/LF header injection in contact-form fields, dot-stuffing.
- One test (connection dropped after the greeting) was racy in its first version (the stub dropped on a timer that lost the race against a fast localhost conversation). It was fixed in the stub (drop on the first command), not by weakening the assertion.

### Results

| Check | Command | Result |
|---|---|---|
| SMTP stub file, 5 consecutive runs | `node --test tests/mailerSmtp.test.mjs` | 18 tests, 18 passed, 0 failed, 0 skipped, 0 cancelled (each run) |
| Full server suite, replica set `rs0` | `node --test "tests/**/*.test.mjs"` with `MONGO_TEST_URI=mongodb://127.0.0.1:27020/vortex_test?replicaSet=rs0` | 412 tests, 412 passed, 0 failed, 0 skipped, 0 cancelled |
| Server dependency audit | `npm audit` in `server/` | found 0 vulnerabilities |

- Not yet done: `npm audit` in `client/` (belongs to the remaining-dependency step), and a real send through a real provider (needs owner SMTP credentials; the local stub covers the protocol, not any specific provider's quirks).

---

## 2026-11-24 — React Router 7.18.6, redirect hardening, Multer 2.5.0

### React Router 6.30.6 → 7.18.6 (declarative mode kept)

- Status: MODIFIED. Files: `client/package.json` (`react-router-dom` `^6.28.1` → `^7.18.6`), `client/package-lock.json` (`react-router-dom` and `react-router` both 7.18.6).
- Note: when I came to verify this migration, `package.json`, the lockfile and `node_modules` were already on 7.18.6 although this session had not run the install (changed between sessions, presumably by the owner). I verified the result rather than assuming it: `npm ls` shows a consistent tree, and every check below was run on 7.18.6.
- Official v6 → v7 guide: v7 needs Node 20+, React 18+; no breaking changes once the v6 future flags are handled. The only flag relevant to this app, `v7_relativeSplatPath`, needs no change here: the only splat route is `path="*"` and there are no relative `../` links. All `React.lazy` calls are at module scope, so v7's transition-based updates are safe.
- `App.tsx` is unchanged (BrowserRouter + Routes). The 31 files importing from `react-router-dom` are unchanged: v7 still publishes `react-router-dom` as a re-export of `react-router`.
- Verified on 7.18.6: `npx tsc -b` exit 0; `npm run build` OK (main bundle 315.91 kB vs 315.77 kB on 6.30.6); `npm audit` 0 vulnerabilities; client tests 47/47.
- NOT verified: clicking through the routes in a real browser (no browser access in this session). Owner steps: log out, open `/account` and `/admin` (expect redirect to `/login?next=...`, then back to the page after login), open a product link, add to cart, go through `/checkout`, open `/orders/<number>`, and confirm a nonsense URL shows the 404 page.

### Redirect security (`safeNext`)

- Status: MODIFIED `client/src/utils/safeNext.ts`; CREATED `client/tests/safeNext.test.mjs`; MODIFIED `client/package.json` (new `npm test` script: `node --test "tests/**/*.test.mjs"`). No new dependency: Node 26 runs the `.ts` file directly.
- Bug fixed: the old check accepted values containing a tab, newline, carriage return or space, for example `/<TAB>/evil.com`, which browsers parse as `//evil.com`. Proven by running the old logic against those values (it returned them unchanged). The new version also rejects control characters and unicode whitespace and requires the value to resolve to the same origin. Normal paths, queries and fragments are unchanged.
- Tests (47): 19 attack strings rejected, 10 legitimate destinations kept exactly, the encode → decode round trip used by `RequireAuth`/`RequireAdmin` → `Login`, the real router (in-memory) ending on the fallback page for every attack, and a smoke check that the 11 router exports the app uses still exist.

### Multer 1.4.5-lts.2 → 2.5.0

- Status: MODIFIED `server/package.json`, `server/package-lock.json` (multer 2.5.0; 14 transitive packages of Multer 1.x no longer needed; nothing else changed). Done as a separate step from the other upgrades.
- Why: Multer < 2.0.0 has two high-severity denial-of-service flaws (CVE-2025-47935 stream-error memory leak; CVE-2025-47944 crash on a malformed multipart request). 2.0.0's only breaking change is the minimum Node version (10.16); this server runs Node 26. 2.1.0 is also flagged upstream as a security release. Stable 2.x currently ends at 2.5.0; 3.x is alpha only and was not used. I did not read the 2.2–2.5 notes line by line; the tests below are the evidence.
- Project use is small: `src/middleware/upload.js` (memory storage, 5 MB, one file, no text fields, 2 parts), mounted only on `POST /api/admin/uploads` behind `requireAdmin`.
- Bug fixed by the new tests: a malformed multipart body (garbage, truncated, malformed part header, no boundary) returned **500**. `src/middleware/upload.js` now wraps the parser so such requests return **400** with a fixed message that never echoes parser internals; `MulterError` and status-carrying errors pass through as before. The 5 MB message is unchanged.
- Tests: CREATED `server/tests/uploadRobustness.test.mjs` (9): garbage body, no closing boundary, malformed header, missing boundary, nameless part, extra text field, JSON instead of multipart, 40 uploads aborted mid-stream, and a burst of mixed malformed/aborted requests; after each, the server must still answer and accept a valid upload. The existing 18 upload/admin tests in `admin.test.mjs` (valid PNG/JPEG/WebP, fake images, SVG/GIF, oversized, decompression bomb, wrong field, two files, hostile filename, customer 403, anonymous 401) pass unchanged.

### Results

| Check | Result |
|---|---|
| `npm test` in `client/` | 47 tests, 47 passed, 0 failed, 0 skipped |
| `npx tsc -b`, `npm run build` in `client/` | exit 0, build OK |
| Upload tests (`uploadRobustness` + `admin`), 3 consecutive runs | 27 tests, 27 passed each run |
| Full server suite, replica set `rs0` | 421 tests, 421 passed, 0 failed, 0 skipped, 0 cancelled |
| `npm audit` `server/` and `client/` | found 0 vulnerabilities (both) |

- Dependencies deliberately NOT upgraded (major versions, no security reason): React 19, lucide-react 1.x, Express 5, Mongoose 9, express-rate-limit 8, dotenv 18, bcryptjs 3. Mongoose 8.24.8 has a newer patch (8.24.11) available.
- Environment note: the local replica set (`mongod` on port 27020, data in `C:\data\vortex-rs`) had stopped (the machine apparently restarted) and was started again; it must be running for the database tests.
