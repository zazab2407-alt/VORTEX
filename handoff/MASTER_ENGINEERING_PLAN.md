# VORTEX — Master Engineering Plan

Project path: `F:\vortex`
Status of this document: living plan. Statuses are defined in `MASTER_PROGRESS.md`.

## 1. Scope and constraints

- Preserve all existing functionality and uncommitted user changes.
- No `git reset --hard`, no blind `git add .`, no commit or push without explicit approval.
- No `npm audit fix --force`, no major dependency upgrades without approval.
- No changes to product names, prices, descriptions, slugs, categories, or business rules without approval.
- No destructive database operations. The original `vortex` database is never touched by the assistant.
- Owner decisions (section 5) are not implemented without approval.

## 2. Environment limits (affects every milestone)

The assistant's file tools can read and edit files under `F:\vortex`. They cannot:
- run `npx tsc -b`, `npm run build`, `npm test`, `npm audit`, `npm run check:images`, or any other command on the owner's Windows machine;
- run Git commands, or push to GitHub;
- start MongoDB or a replica set;
- create ZIP archives;
- generate images (no image-generation tool is available in this environment).

Consequence: every change is **IMPLEMENTED — NOT VERIFIED** until the owner runs the checks and reports the output. Original image generation cannot be done here; see section 4.

## 3. Baseline (from existing records, not re-run)

- Last recorded full server test run (Phase 1, owner-run): 374 total, 371 passed, 0 failed, 3 skipped, 0 cancelled. The 3 skipped tests are replica-set transaction tests and require a MongoDB Replica Set.
- Client `tsc -b` and `npm run build`: not recorded as passing for the current code.
- Dependencies: `client/package.json` declares `react-router-dom` `^6.28.1`. `client/package-lock.json` resolves `react-router-dom` **6.30.6**, `react-router` **6.30.6** and `@remix-run/router` **1.23.4** (confirmed from the lock file). Whether any advisory applies to 6.30.6 is determined by the `npm audit` output, not by the lock file.

## 4. Issue register

| ID | Problem | Severity | Affected Files | Root Cause | Proposed Fix | Verification |
|---|---|---|---|---|---|---|
| ENG-01 | Original product and category images are not created; the catalogue uses external Unsplash URLs | High | `server/src/seed/catalog.js`, `client/src/data/images.ts` | Image-generation capability is not available in this environment; earlier sourcing approach was stopped pending permission | Blocked on tooling. Options: owner-supplied images, or an image-generation tool in a later session | Blocked |
| ENG-02 | Catalogue images repeat across products | Medium | `server/src/seed/catalog.js` | Image pools are small (6/6/4); products take consecutive slices | Replace with per-product images once sourced | Blocked on ENG-01 |
| ENG-03 | Seeded demo product with zero stock (Dryline Swim Towel) | Medium | `server/src/seed/catalog.js` (`demoVariants`) | Deterministic hash gave zero stock to every variant | Guarantee one healthy variant (implemented) | Phase 1 test run passed |
| ENG-04 | Dependency advisories in React Router tree | To be set from `npm audit` output | `client/package.json`, `client/package-lock.json` | Lockfile resolves `react-router-dom` 6.30.6 (confirmed). Advisory applicability not yet confirmed | Apply the fixed version named by `npm audit`, if any; test navigation | Not started |
| ENG-05 | Redirect after login | Medium (currently mitigated) | `client/src/utils/safeNext.ts` | Validator rejects absolute and protocol-relative URLs and backslashes | Keep; add regression tests for malicious values | Not started |
| ENG-06 | Hard-coded currency symbols | Low | `ProductForm.tsx`, `Shop.tsx`, `FilterPanel.tsx` | Literal `$` in labels and chips | Use `currencySymbol` from the existing config hook (implemented) | Not compiled; owner to run `tsc -b` and `build` |
| ENG-07 | Store price-range slider fixed at 0–150 | Low | `client/src/components/FilterPanel.tsx` | Constants, not configuration | Needs a business decision on range | Deferred — owner decision |
| ENG-08 | Handoff documents out of date (pages, newsletter, currency gate, project path) | Medium | `handoff/PHASE7_HANDOFF.md`, `handoff/VORTEX_NEW_CHAT_HANDOFF.md` | Documents not updated after later work | Update to match code and recorded results | Not started |
| ENG-09 | Contact and policy placeholders are not highlighted consistently | Low | `client/src/pages/Contact.tsx`, `client/src/components/PolicyPage.tsx` | `Contact.tsx` renders placeholders as plain text | Highlight consistently | Not started |
| ENG-10 | Seed can wipe the database named in `MONGO_URI` | High (mitigated) | `server/src/seed/seed.js` | No database-name check | CLI guard and `seedCatalog()` guard (implemented, tested) | Phase 1 test run passed; guard tests included |
| ENG-11 | Transaction tests skip on standalone MongoDB | Medium | `server/tests/transactions.test.mjs` | No replica set in the owner's test environment | Run against a replica set; do not report as passed until run | Blocked on environment |
| ENG-12 | Source ZIP does not exist; existing `VORTEX_SOURCE_HANDOFF.zip` would be overwritten | Medium | `handoff/` | No archive tool here | Owner decision on file name, then owner-run script | Blocked |
| ENG-13 | `git status` cannot be read by the assistant | Low | — | No Git access | Owner runs Git commands | Blocked |

## 5. Owner decisions (not implemented)

1. **Hidden categories:** whether products in a hidden category disappear from public APIs. Current behaviour: the category is hidden in the shop UI; the decision on backend filtering is open.
2. **Logout:** whether logout revokes only the current session, or all sessions. Current behaviour: the cookie is cleared; token revocation is not implemented.
3. **Password reset by email:** whether to implement it, and what happens when SMTP is unavailable. Not implemented.
4. **Product reviews:** verified-purchase-only rules and moderation. Not implemented.
5. **Policy wording and business details:** legal and contact text. Placeholders remain.

## 6. Phase order

1. Baseline verification by owner (TypeScript, build, server tests, audits, image check) — **owner action required**.
2. Dependency and redirect audit (ENG-04, ENG-05) — read-only analysis can proceed; upgrade needs owner approval.
3. Documentation alignment (ENG-08) — can proceed.
4. Original image assets (ENG-01, ENG-02) — **blocked on tooling or owner-supplied images**.
5. Phase 7 completion — blocked on items 1, 4, and the owner decisions in section 5.

## 7. Release readiness

Not ready. Blockers: unverified client build, missing original imagery, unresolved owner decisions, unverified transaction tests, and no source archive. No production-readiness claim is made.
