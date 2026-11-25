# VORTEX — Master Progress

Status vocabulary: NOT STARTED · IN PROGRESS · BLOCKED · IMPLEMENTED — NOT VERIFIED · VERIFIED · DEFERRED — OWNER DECISION · NOT APPLICABLE

Verification means the owner-run command output confirms the result. The assistant cannot run builds, tests, audits, Git, or MongoDB (see `MASTER_ENGINEERING_PLAN.md` section 2).

## Milestone log

### M0 — Audit, baseline and planning (this session)

Completed:
- Read `handoff/PHASE7_HANDOFF.md`, `handoff/VORTEX_NEW_CHAT_HANDOFF.md`, `handoff/CHANGELOG.md`, and `README.md`.
- Read the Git metadata: single commit `Initial commit - VORTEX full-stack`. Recent owner `git status --short` showed only the expected modified files.
- Read `client/package.json`, `server/package.json`, `client/src/utils/safeNext.ts`.
- Created `handoff/MASTER_ENGINEERING_PLAN.md` and this file.

Modified files: `handoff/MASTER_ENGINEERING_PLAN.md` (created), `handoff/MASTER_PROGRESS.md` (created).

Not done in M0: any application code change; image generation; dependency upgrade; Git operations; ZIP creation.

Unresolved: see `MASTER_ENGINEERING_PLAN.md` section 4.

## Task status

| Area | Task | Status | Notes |
|---|---|---|---|
| Repository | Baseline audit and master plan | IMPLEMENTED — NOT VERIFIED | Documents created; no command run |
| Repository | Baseline TypeScript, build, server tests, image check, audits | BLOCKED | Owner to run |
| Security | Authentication review | NOT STARTED | Read-only review possible |
| Security | Authorization review | NOT STARTED | |
| Security | Application security review (XSS, injection, CORS, headers, rate limits) | NOT STARTED | |
| Security | React Router dependency analysis (ENG-04) | NOT STARTED | Confirm locked version in `client/package-lock.json` first |
| Security | Redirect validation (`safeNext.ts`, ENG-05) | NOT STARTED | Rejects `//`, absolute URLs, backslashes; regression tests not yet written |
| Security | Dependency audit (both packages) | BLOCKED | Owner to run `npm audit`; no `--force` |
| Backend | Architecture, inventory, checkout, coupon review | NOT STARTED | |
| Backend | Seed database guard and `seedCatalog()` guard (ENG-10) | VERIFIED | Phase 1 owner-run tests passed |
| Backend | Dryline stock fix (ENG-03) | VERIFIED | Phase 1 owner-run tests passed |
| Frontend | Currency sweep (ENG-06) | IMPLEMENTED — NOT VERIFIED | Three files; `tsc -b` and `build` not run |
| Frontend | Store price-range configuration (ENG-07) | DEFERRED — OWNER DECISION | |
| Frontend | Accessibility, responsive, and UX review | NOT STARTED | |
| Frontend | Placeholder highlighting (ENG-09) | NOT STARTED | |
| Images | Original product and category images (ENG-01) | BLOCKED | No image-generation tool in this environment |
| Images | Replace repeated image pools (ENG-02) | BLOCKED | Depends on ENG-01 |
| Images | Image validation for local assets | NOT STARTED | Depends on ENG-01 |
| Testing | Transaction tests on a replica set (ENG-11) | BLOCKED | Needs owner's replica set |
| Testing | Frontend unit and routing tests | NOT STARTED | |
| Documentation | Align Phase 7 and new-chat handoffs (ENG-08) | NOT STARTED | |
| Documentation | Architecture, API, security, deployment docs | NOT STARTED | |
| Delivery | Source ZIP (ENG-12) | BLOCKED | Owner decision on overwrite, then owner-run script |
| Delivery | Git status and commit | BLOCKED | No commit or push without approval |
| Phase 7 | Existing Phase 7 requirements | BLOCKED | Requires baseline verification and owner decisions 1–5 |

## Owner decisions outstanding

1. Hidden categories and public APIs.
2. Logout scope (current session vs all sessions).
3. Email password reset, including behaviour without SMTP.
4. Verified-purchase product reviews and moderation.
5. Final policy and business wording.

### M1 — Read-only source audit (this session)

Completed: read-only audit of authentication, authorization, application security, React Router and redirects, database models and indexes, checkout, inventory, coupons, orders, frontend API handling, and existing image architecture. Full findings with locations, severities, scenarios, fixes and regression tests: `handoff/SECURITY_AUDIT.md`.

Modified files: `handoff/SECURITY_AUDIT.md` (created), this file, `handoff/MASTER_ENGINEERING_PLAN.md`.

No application code changed. No command run. No tests run.

Headline results:
- Strong: password hashing and timing, token algorithm pinning, per-request user reload, session ending on password change, server-side pricing, atomic stock reservation, idempotent checkout, object-level order access, admin route guarding, NoSQL-operator sanitising, CSRF header requirement, upload re-encoding.
- Medium: no per-account login throttle (SEC-A3); logout does not revoke tokens (SEC-A1, owner decision); customer order history capped at 50 with no pagination (SEC-D7); standalone-MongoDB cancellation crash window (SEC-D4, deployment decision).
- Unverified until owner runs `npm audit`: multer 1.x advisory applicability, and whether any advisory applies to the locked react-router 6.30.6 (section G). The lock file was read: react-router-dom 6.30.6 is resolved.
- Second pass (this session): product create/update/stock paths, mailer, Field, ErrorState and Img reviewed; no new defects except a low-severity handler-order issue in `Img.tsx` (section J).
- Not reviewable here: rendered accessibility and responsive layout (needs a browser), and the server's concurrency tests (not re-read).
- Missing: a client test runner, so redirect and routing rules have no tests (SEC-F2).

Recommended highest-priority batch (not yet approved or started):
1. Owner runs `npm audit` in both packages and pastes the output, plus the `react-router-dom` entry from `client/package-lock.json`. Without this, dependency risk cannot be classified.
2. Implement SEC-A3 (per-account login throttle): medium severity, no business-rule change, adds regression tests in the existing server suite.
3. Implement SEC-C8 (coupon limit race) with a regression test.

These are small, testable, and do not depend on owner decisions. Items 2 and 3 change server behaviour, so they need your approval before I edit.

### M2 — Consolidated implementation plan (proposed, not approved)

Completed: `handoff/IMPLEMENTATION_PLAN.md` written from `SECURITY_AUDIT.md` and the lockfiles. Master plan React Router statements corrected to the locked version 6.30.6 (`handoff/MASTER_ENGINEERING_PLAN.md` section 3 and ENG-04).

Not done, and blocked on input: the Nodemailer and React Router advisory details. The `npm audit` output has not reached the conversation, so no advisory ID, applicability, or fixed version is stated. Batches D1 and D2 are marked accordingly.

No application code, `package.json`, or `package-lock.json` changed. Nothing staged, committed or pushed. Pending owner decisions: login throttle design, coupon update ordering, multer major upgrade, client test dependency, and the audit output.

### M3 — Plan revised with owner-provided audit summary and decisions (not approved)

Revised `handoff/IMPLEMENTATION_PLAN.md` with: the owner's npm audit summary (attributed to the owner; the raw output was not visible in the conversation); the React Router advisory GHSA-wrjc-x8rr-h8h6 (fixed only in 7.18.0, so a 6→7 migration is required); Nodemailer breaking changes quoted from third-party pages (to be confirmed against official changelogs); and the owner's decisions. Investigation completed for D1 (Nodemailer), D2 (React Router), A1 (login throttle), A2 (coupon update), D3 (Multer), A4 (client tests without a new dependency).

No application code, `package.json`, or `package-lock.json` changed. Nothing staged, committed or pushed.

Pending owner decisions: Nodemailer target version and SMTP stub test; owner Node version; login threshold and window design; coupon update design; React Router 6→7 approval; Multer approval.

## Next tasks (in order)

1. Owner runs the baseline checks and pastes the output.
2. Read-only redirect and router analysis (ENG-04, ENG-05), with a written recommendation.
3. Update the Phase 7 and new-chat handoffs to match the code (ENG-08).
4. Decide how original imagery will be produced (ENG-01): an image-generation tool in a later session, or owner-supplied images.
5. Continue the security review in the order: authentication, authorization, application security.
