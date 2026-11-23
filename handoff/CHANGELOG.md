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

## Unrelated existing issues noted (not changed)

- `server/src/seed/seed.js` deletes all products, categories, reviews and demo users before reseeding. It has a production guard, and since the database guard was added it refuses any database other than `vortex_playground`.
- `client/src/data/catalog.ts` and `server/src/seed/catalog.js` duplicate the colour palette. They must be kept in sync by hand.
- `server/.env.example` defaults `MONGO_URI` to the original `vortex` database.
