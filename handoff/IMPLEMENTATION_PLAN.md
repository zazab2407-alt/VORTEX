# VORTEX — Consolidated Implementation Plan

Status: PROPOSED — NOT APPROVED FOR IMPLEMENTATION. No application source, `package.json`, or `package-lock.json` has been changed. Nothing is staged, committed or pushed. Preserve all existing uncommitted changes.

Sources: `handoff/SECURITY_AUDIT.md`, `handoff/MASTER_ENGINEERING_PLAN.md`, the lockfiles as read, the owner's `npm audit` summary (below), and third-party advisory and changelog pages checked this session (flagged where they must be confirmed against official sources).

## 0. Facts and sources

### 0.1 Correction on the audit output

The `npm audit` output was not visible in this conversation before this revision, so earlier revisions of this plan did not reflect it. The facts below are taken from the owner's summary of that output.

### 0.2 npm audit summary (owner-provided)

Client:
- `esbuild` ≤0.24.2: **moderate**.
- `react-router` 6.0.0–7.17.0: **moderate**, including GHSA-wrjc-x8rr-h8h6 and GHSA-337j-9hxr-rhxg.
- npm proposes `vite` 8.3.8 and `react-router-dom` 7.18.6 through `--force`. **Do not use `--force`.**

Server:
- `nodemailer` ≤10.1.3: **high**, with multiple advisories. Installed: 6.10.1. npm proposes 10.6.1 through `--force`. **Do not use `--force`.**

### 0.3 Lockfile versions (read this session)

| Package | Declared | Locked |
|---|---|---|
| nodemailer (server) | `^6.9.16` | 6.10.1 |
| multer (server) | `^1.4.5-lts.1` | 1.4.5-lts.2 (lockfile deprecation notice: 1.x affected by vulnerabilities patched in 2.x) |
| react-router-dom (client) | `^6.28.1` | 6.30.6 |
| react-router (transitive) | — | 6.30.6 |
| @remix-run/router (transitive) | — | 1.23.4 |
| express | `^4.21.2` | 4.22.3 |
| helmet | `^8.0.0` | 8.3.0 |
| mongoose | `^8.9.5` | 8.24.8 |
| sharp | `^0.35.5` | 0.35.5 (requires Node ≥20.9) |

### 0.4 Advisory facts checked this session (third-party pages; confirm against official sources before implementation)

- **GHSA-wrjc-x8rr-h8h6 / CVE-2026-53669:** open redirect via backslash in `<Link>` and `useNavigate`; a bypass of the earlier CVE-2025-68470. Affected `>= 6.0.0, < 7.18.0`. **Patched version: 7.18.0.** No 6.x patch is listed, so the fix requires moving to the 7.x line.
- **Nodemailer breaking changes between 6.10.1 and 10.x** (quoted from third-party pages; the official `CHANGELOG.md` must be checked for each major):
  - v8.0.0: error code `NoAuth` renamed to `ENOAUTH`.
  - v8.0.4: fix for SMTP command injection through envelope size (security fix).
  - v9.0.0: TLS certificates validated by default when fetching **remote content** (attachment URLs, OAuth2 token endpoints, proxies).
  - v10.0.0: Node.js 20 or newer required.
- **Multer 2.x:** the 1.x line is affected by vulnerabilities patched in 2.x (lockfile deprecation notice). The 2.x changelog and migration notes are not yet reviewed.

## 1. Decisions confirmed by the owner

1. **Login throttling:** a 15-minute rolling window, no permanent account lockout, and a design that avoids trivial denial of service to legitimate accounts. Explained in section 2.1 before implementation.
2. **Coupon updates:** an atomic conditional update. If the limit update fails, no other coupon field is left partially updated. Existing business rules are preserved.
3. **Multer:** investigate and prepare a 2.x migration. **Not** in the same batch as Nodemailer.
4. **Client redirect tests:** no new dependency for now. First investigate whether existing tooling or Node's built-in test runner can test the critical redirect rules.
5. **Nodemailer:** a dedicated security migration investigation and compatibility plan. No blind upgrade and no lockfile change until the mailer implementation has been inspected and all breaking changes identified.

## 2. Batches

Dependency batches (D1 Nodemailer, D2 React Router, D3 Multer, D4 esbuild/Vite) are kept separate from application batches (A1–A5).

### 2.1 A1 — Per-account login throttle (SEC-A3)

**Current behaviour (read this session):** `server/src/middleware/rateLimiter.js` builds limiters with `express-rate-limit` 7.5.1. `authLimiter` allows 10 **failed** attempts per 15 minutes **per IP**. `make()` sets `skip: () => config.env === 'test'`.

**Important implementation fact:** `express-rate-limit` uses a **fixed** window by default, not a rolling window. A true 15-minute rolling window needs a custom store (sliding-window log or bucketed counter). Options:
- (a) use a fixed 15-minute window and document it as an approximation; or
- (b) implement a small custom store for the per-account key; this is new code and needs its own tests.

**IP and account keys: how they interact (must be understood before choosing thresholds):**

| Attacker | Per-IP limit (existing) | Per-account limit (new) |
|---|---|---|
| One IP, one account | Blocked after 10 failures | Blocked after threshold |
| Many IPs, one account (distributed guessing) | Each IP capped at 10, so guessing continues | **Caps total guesses per account** — the only control against this |
| One IP, the victim's account (denial of service) | Blocks the attacker's IP only | Would block the victim's login for the window |
| Many IPs, the victim's account (denial of service) | Does not help the victim | **Blocks the victim** for the window |

Conclusion: **a per-account counter is the only control against distributed guessing, and it is also the mechanism that allows denial of service.** No design removes both. The choice is a threshold trade-off:
- A low threshold (for example 10) makes distributed guessing expensive but lets a small botnet lock out a real customer for 15 minutes at a time.
- A high threshold (for example 30–50) makes denial of service costly, at the price of weaker guessing protection per account.

**Recommended design (to confirm):** per-account counter keyed on the normalised email, rolling 15-minute window, threshold **30 failed attempts**, `skipSuccessfulRequests`, generic 429 body identical for existing and non-existing accounts. Keep the existing per-IP limit at 10. Document the residual denial-of-service risk. Remove the lockout idea entirely: the window expires on its own, so the account is never permanently blocked.

**Affected files:**
- `server/src/middleware/rateLimiter.js`: add `loginAccountLimiter` with a custom `keyGenerator` (normalised email from `req.body.email`). Do not log raw emails.
- `server/src/routes/authRoutes.js`: apply the new limiter to `POST /auth/login` after `authLimiter`.
- New test: `server/tests/loginThrottle.test.mjs`.

**Compatibility risks:**
- `trust proxy = 1` in production, so IP keys remain correct behind one proxy.
- A fixed window (option a) can allow up to twice the threshold across a window boundary; the rolling store (option b) avoids this.
- Logins with a correct password during a throttle are rejected; this is intended.

**Regression tests (`loginThrottle.test.mjs`, following `rateLimit.test.mjs`):** set `NODE_ENV=development` before importing the app. Assert: (1) the per-account limit blocks the 31st failure for one email from several simulated IPs; (2) a different email is unaffected; (3) successful logins are not counted; (4) the 429 body is identical for an existing and a non-existing email; (5) the window expires and login works again (time control or a short test window).

### 2.2 A2 — Coupon usage-limit update, atomic (SEC-C8)

**Current behaviour (read this session):** `updateCoupon` in `server/src/controllers/couponController.js` loads the coupon, checks `usageLimit` against the loaded `usedCount`, mutates several fields in memory, and calls `c.save()`. A redeem between the read and the save can leave `usedCount > usageLimit`. The code-change check also reads `orderCount` before the write.

**Exact change:** replace the in-memory mutate-and-save with **one** conditional update that sets all requested fields together:
- Filter: `{ _id, ...(codeChanging || usageLimitChanging ? { usedCount: { $lte: newLimit ?? Infinity } } : {}) }`. For a code change, the filter requires `usedCount: 0` so an order cannot redeem the old code mid-update.
- Update: `$set` for changed fields, `$unset` for cleared `usageLimit` and `expiresAt`.
- Options: `{ new: true, runValidators: true, context: 'query' }`.
- If the update returns `null`: re-read the coupon and return the existing 400 or 409 message that matches the reason (limit below used count, or code used).
- Duplicate code (E11000): the existing error handler already maps it to 409; confirm the path.

**Business rules preserved:** a used coupon keeps its code; the usage limit cannot be below `usedCount`; the expiry must be in the future when changed; `canDelete` and `serializeCoupon` are unchanged.

**Compatibility risks:**
- `runValidators` with `findOneAndUpdate` does not run `pre('save')` hooks. Check `Coupon.js` for any save hook (none seen this session; confirm).
- A single update cannot partially apply: that is the goal, and it means a refused change leaves every field unchanged.
- Standalone MongoDB is sufficient, because the update is single-document.

**Regression tests (add to `server/tests/coupons.admin.test.mjs`, no existing assertion changed):**
1. Lowering the limit below `usedCount` returns 400 and leaves every other field unchanged (for example, a simultaneous `value` change is not applied).
2. Setting the limit equal to `usedCount` succeeds.
3. Changing the code of a used coupon returns 409 and leaves the code unchanged.
4. Concurrency: a redeem and a limit reduction run together; afterwards `usedCount <= usageLimit`, or the update was refused.

### 2.3 A3 — Accessibility: cart drawer, pagination, loading (SEC-L1, SEC-L2, SEC-L3)

As in the previous plan:
- `CartDrawer.tsx`: focus to Close on open, Tab trapped inside, focus restored to the trigger on close. The trigger is not passed in, so record `document.activeElement` on open.
- `Pagination.tsx`: key page buttons by page number, not by array index.
- `ProductGrid.tsx`: visually hidden `role="status"` live region announcing loading; `aria-busy` on the grid.
- `index.css`: `prefers-reduced-motion` rule, after checking whether one exists.

**Verification:** `npx tsc -b` and `npm run build` (owner-run), plus the browser checklist: keyboard open, Tab containment, Escape with focus restore, pagination focus stability, loading announcement, reduced motion. No new dependency.

### 2.4 D1 — Nodemailer (security migration) [investigation complete; implementation awaits approval]

**Scope:** `nodemailer` only. Do not change multer, React Router, or Vite in this batch.

**Target version:** the owner's summary reports 10.6.1 as the first fixed version in the npm proposal. The fixed version must be confirmed from the official Nodemailer advisory before any change. **Do not use `npm audit fix --force`.** Use a normal, explicit version install after approval.

**Mailer implementation (inspected this session):** `server/src/services/mailer.js` uses:
- `nodemailer.createTransport({ host, port, secure, auth: { user, pass }, connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 15000 })` (one transport, cached).
- `transport.sendMail({ from, to, replyTo, subject, text, html })`.
- `transport.verify()` in `verifySmtp`.
- Error handling: `why(err)` logs `err.code || err.responseCode || 'timeout' | 'error'`. **No branch on any specific Nodemailer error code.** Resolve means accepted; reject means not sent.
- `isPlainEmail` restricts recipient and reply-to addresses before sending.
- Test transport injection via `setTransportForTests`.

**Compatibility review (points to verify against official docs before implementing):**
1. **Error code rename (`NoAuth` → `ENOAUTH`):** affects only the logged code text in `why()`. No branching. **Low risk.**
2. **Remote-content TLS validation (v9.0.0):** our code uses no attachment URLs, no `path` attachments, and no OAuth2. The SMTP transport's own TLS is not the "remote content" case. **Low risk, confirm.**
3. **Node version (v10.0.0 needs Node ≥20):** `sharp` already requires Node ≥20.9, so the server already requires it. **Confirm the owner's Node version.**
4. **Transport option names** (`connectionTimeout`, `greetingTimeout`, `socketTimeout`, `secure`, `auth`): confirm they are unchanged in the target version. **Medium risk if renamed; the timeouts would silently revert to defaults.**
5. **Module format:** the server imports `nodemailer` as a default import in ESM. Confirm the target version's export map provides it. **Medium risk if not.**
6. **`verify()`:** confirm it still exists and resolves/rejects as assumed.
7. **Type definitions:** the server is plain JavaScript; there is no `@types/nodemailer` in its dependencies. **No TypeScript impact.**
8. **Security gain:** the v8.0.4 envelope fix addresses SMTP command injection. Our envelope is validated by `isPlainEmail`, so the exposure was already reduced; the upgrade is still required by the audit.

**Test gap (found this session):** `mailer.test.mjs` injects a fake transport in every case, so **the real Nodemailer integration is never exercised by the test suite**. A passing test run after the upgrade would not prove the SMTP path works. Required addition: a test that starts a local SMTP stub (Node `net` server, no new dependency) and sends a real message through the real `createTransport` configured with `host`/`port`. The stub must answer `EHLO`, `MAIL FROM`, `RCPT TO`, `DATA`, and `QUIT`. Assert: the message is accepted, the timeout options are applied (a stub that never answers the greeting fails within `greetingTimeout`), and `verify()` resolves against the stub.

**Exact dependency change (after approval only):**
1. Back up `server/package.json` and `server/package-lock.json` to `handoff/rollback/d1-<timestamp>/` (new folder).
2. In `server/`: `npm install nodemailer@<confirmed-version>` (explicit version, caret range updated in `package.json`). **No `--force`.**
3. Review the lockfile diff for unrelated transitive changes; if any, stop and report.
4. `npm audit` in `server/` must no longer list nodemailer.

**Required tests before merge:** `npm test` in `server/` (full count, with the three replica-set tests reported as skipped, not passed) including the new SMTP stub test; `mailer.test.mjs` unchanged.

**Rollback:** restore `package.json` and `package-lock.json` from the backup folder, then run `npm ci` in `server/` to match the restored lockfile exactly. Because the changes are only in these two files and the backup, the rollback does not touch the working tree outside `server/`. Do not use `git reset --hard`.

### 2.5 D2 — React Router (open redirect) [investigation complete; implementation awaits approval]

**Scope:** `react-router-dom` and its transitive `react-router` and `@remix-run/router`, plus any source changes the 6→7 migration requires.

**Advisory fact:** GHSA-wrjc-x8rr-h8h6 is fixed only in 7.18.0 (third-party advisory pages; confirm). The owner's summary reports the npm proposal as `react-router-dom` 7.18.6. **Do not use `--force`.**

**Exposure in this application (from source, read this session):**
- The only navigation with user input is `Login` and `Register` through the `next` query parameter, validated by `client/src/utils/safeNext.ts`.
- `safeNext` accepts only paths starting with a single `/` with no backslash. Those are exactly the forms the backslash bypass depends on, so the current exposure is **low**.
- Links built from server data (product slugs) are server-generated slugs; no user-controlled `Link` targets were found.
- The server issues no HTTP redirects to user-supplied URLs.

**Migration investigation required before implementation:** the 6→7 upgrade guide must be reviewed for changes to `BrowserRouter`, `Routes`, `Route`, `Link`, `NavLink`, `useNavigate`, `useSearchParams`, `Navigate`, and the package layout (react-router-dom versus react-router). Affected files: `client/src/App.tsx`, `client/src/components/RouteGuards.tsx`, `client/src/pages/Login.tsx`, `client/src/pages/Register.tsx`, `client/src/utils/safeNext.ts`, and any other file importing from `react-router-dom`.

**Compatibility risks:** React 18.3.1 is compatible with v7 (v7 requires React ≥18). Route matching or navigation behaviour changes would break the authenticated flows; the browser checklist below covers them.

**Required tests:** `npx tsc -b`, `npm run build`, and the browser checklist: login with `next=/shop`; login with `next=//evil.example`; login with `next=/%2F%2Fevil.example`; login with a backslash-based value; admin route when logged out; logout then navigation; checkout and order pages.

**Rollback:** same pattern as D1: back up `client/package.json` and `client/package-lock.json`, restore and `npm ci` in `client/`.

### 2.6 D3 — Multer 1.x → 2.x (separate batch, needs approval)

**Scope:** `multer` only; not in the same batch as D1.

**Affected code:** `server/src/middleware/upload.js` (`multer({ storage, limits, fileFilter })`, `.single`, `MulterError` handling), `server/src/middleware/errorHandler.js` (multer error mapping, if any), and `server/src/services/imageService.js` (unchanged, but its inputs come from multer).

**Investigation required:** the 2.x changelog and migration notes, compared with 1.4.5-lts.2 usage. Confirm the option names, `fileFilter` signature, error codes, and memory-storage behaviour.

**Regression tests:** existing upload tests in `server/tests/admin.test.mjs` and `products.api.test.mjs` must pass unchanged. Add: oversize file rejected; non-image file rejected; unknown field rejected. Owner runs `npm test`.

**Rollback:** same pattern as D1.

### 2.7 D4 — esbuild and Vite (development tooling, separate)

- `esbuild` ≤0.24.2 is moderate. Development server only; the owner's summary says the proposed fix is Vite 8.3.8 through `--force`.
- Vite 8 is a major upgrade of the development toolchain. Requires separate investigation and approval. Not part of D2.
- Production exposure: none (the development server is not deployed).

### 2.8 A4 — Client redirect tests without a new dependency (investigation)

Goal: test the redirect rules in `safeNext.ts` automatically, using existing tooling only.

**Options investigated (no implementation):**
1. **TypeScript compile + Node built-in test runner.** `tsc` is already a dev dependency. Compile `client/src/utils/safeNext.ts` to a temporary output folder (for example `client/.test-build/`, excluded from the ZIP), then run `node --test` on a test file that imports the compiled output. No new dependency. Requires that `safeNext.ts` has no imports from React or the DOM.
2. **Node type stripping.** Node's `--experimental-strip-types` (Node 22.6 and later; default in later releases) would allow importing `.ts` directly. Depends on the owner's Node version, which has not been confirmed.
3. **Vite's own tooling.** Not a test runner; not suitable.

**Recommendation:** option 1. It depends only on existing dev tooling, works on any supported Node version, and tests the same code that ships. Requires one check first: `safeNext.ts` must have no React or DOM imports (to be verified when implementing).

**Tests to write:** accepted (`/shop`, `/product/x?y=1`); rejected (`//evil.example`, `https://evil.example`, a backslash form, `javascript:alert(1)`, an empty string, a non-string, a value with a leading space).

## 3. Priority order

1. **D1 Nodemailer** — high severity; investigation complete; awaits approval of the target version and the test additions.
2. **A1 login throttle** — medium; awaits confirmation of threshold (recommended 30 per account) and the fixed-versus-rolling window choice.
3. **A2 coupon atomic update** — low; awaits confirmation of the design in section 2.2.
4. **D2 React Router 7** — moderate advisory; exposure low; major migration; awaits approval.
5. **A3 accessibility** — no dependency; browser-verified.
6. **A4 redirect tests** — no dependency; investigation complete; awaits approval to implement.
7. **D3 Multer 2.x** — separate; awaits approval.
8. **D4 Vite/esbuild** — development only; separate; awaits approval.

## 4. Decisions needed before implementation

1. **D1:** confirm the Nodemailer target version from the official advisory, and whether to add the SMTP stub test.
2. **D1:** confirm the owner's Node.js version (Nodemailer 10 and `sharp` need Node 20 or newer).
3. **A1:** confirm the per-account threshold (recommended 30 in 15 minutes) and whether to accept a fixed 15-minute window or build a rolling store.
4. **A2:** confirm the update design in section 2.2.
5. **D2:** approve the React Router 6→7 migration, and whether to proceed before or after D1.
6. **D3:** approve the Multer 2.x investigation and migration as a separate batch.

## 5. Verification

- Nothing in this plan has been implemented or verified.
- Automated checks after each batch (owner-run): `npm test` (server), `npx tsc -b` and `npm run build` (client), `npm audit` in both packages.
- Manual checks: browser checklists in A3 and D2.
- The three replica-set transaction tests remain skipped on standalone MongoDB and must not be reported as passed.
