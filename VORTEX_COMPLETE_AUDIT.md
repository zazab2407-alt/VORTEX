# VORTEX — Complete E-commerce Business, UX and Conversion Audit

Audit date basis: current files in `F:\vortex` as of this session.
Method: source-code inspection, plus re-reading the files that changed in Sessions 3 and 4.

## Evidence rules used in this report

- **[VERIFIED-CODE]** Confirmed by reading the source file named. Not run in a browser.
- **[VERIFIED-TEST]** Confirmed by an executed test. Only the owner's Windows test results count, and only where stated (see Section 1.3).
- **[NOT VERIFIED]** Could not be checked from the source alone (rendering, real device behaviour, email delivery, live data, performance timings).
- **[ASSUMPTION]** A reasoned expectation about a customer's behaviour. Stated as such.
- **[BUSINESS DECISION]** Requires information or a decision from the business owner. Not invented here.

No application code was modified. No database, environment file, or deployed system was accessed.

---

## Section 1 — Executive Summary

### 1.1 Overall condition

VORTEX has a solid technical base for a small store: server-side pricing, atomic stock reservation, idempotent checkout, a clear design system, and a honest contact form. The customer-facing content, however, is not yet ready for real customers. Several things a shopper needs to decide to buy are missing or are placeholders, and the database-level purchase logic has been verified for the test suite by the owner's CA-01 run (standalone and replica-set MongoDB). Real-load concurrency remains unverified.

### 1.2 Is it ready?

- **Ready to accept real customers (browsing and account creation): NO.** Real product photography, real business identity, and finished policy text are missing. Stock photos currently stand in for products (CA-02). Policies contain placeholders (CA-03).
- **Ready to accept real orders (checkout): NO.** The database-dependent checkout, stock, cancellation, and coupon tests have been verified for the test suite by the owner's CA-01 run (standalone and replica-set MongoDB; see 1.3). Real-load concurrency, production configuration, and live data remain unverified. The order confirmation email depends on SMTP, which is not configured by default (CA-04). Currency and tax treatment have not been decided (CA-07, CA-08).

### 1.3 What has been verified by an executed test

- **Owner-reported, Windows (historical):** backend `npm test` 87 passed, 0 failed, with 18 database-dependent test groups skipped because `MONGO_TEST_URI` was not set (superseded for database coverage by CA-01, section 9.2). Frontend `npx tsc -b` and `npm run build` were reported as passing after the first Session 3 client edits only. That historical result does not establish that later frontend edits passed TypeScript or the production build. See the progress file, section 21.
- **Not verified (updated):** the database tests are now verified by the owner's Windows run (CA-01): 348 tests on standalone (345 passed, 3 replica-set-only skipped) and 348 on replica set rs0 (all passed). Checkout concurrency under real load, email delivery, and browser behaviour remain unverified.
- **Not run by Claude:** nothing in this audit was executed. The Linux sandbox does not have the project's dependencies and cannot run the Windows project.

### 1.4 The biggest reasons a visitor would leave without buying

1. **Product photos are not of the products.** Every product image is an Unsplash stock photo of an unrelated athlete (CA-02). A shopper cannot see colour, fit, or detail, and will reasonably doubt that the item they receive will look like the one shown.
2. **There is no visible way to reach the business.** The contact form is disabled unless SMTP and a contact inbox are configured, and no business email, phone, or address is set by default (CA-03). A shopper with a question cannot ask it.
3. **Policies are unfinished.** Returns, refunds, delivery times, and privacy details are placeholders (CA-03). Shoppers entering personal and payment information will read these first.
4. **No size guide, fit information, or product specifics** (CA-14). Apparel shoppers abandon when they cannot choose a size with confidence.
5. **No social proof at launch.** Fabricated testimonials and reviews were removed as required (BUG-03, BUG-04). Real reviews are not yet built (approved design, not implemented). Shoppers have no evidence that others bought and liked the product (CA-16).
6. **Checkout gives no order confirmation by email by default** (CA-04), and there is no password recovery (CA-05). A returning customer who forgets a password cannot get back in.

### 1.5 The five most critical problems

1. **CA-01 (P0, verified for the test suite):** The owner's Windows run executed the database tests on standalone and replica-set MongoDB with no failures. Real-load concurrency and production behaviour remain unverified.
2. **CA-02 (P0):** Stock product photos and demo catalogue presented as the real range.
3. **CA-03 (P0):** Missing business identity, contact channel, and finished policies.
4. **CA-04 (P0):** No guaranteed order confirmation; email depends on SMTP that is not configured by default.
5. **CA-07 (P0, business decision):** Currency, price display, and tax treatment not decided, while the configuration is targeting EGP-capable use.

---

## Section 2 — Complete Page-by-Page Audit

Each page lists what works, what is broken, what is missing, what is confusing, what damages trust, and what should improve. Citations refer to the source file that defines the behaviour.

### 2.1 Layout shell (AnnouncementBar, Navbar, Footer) — `components/Layout.tsx`, `AnnouncementBar.tsx`, `Navbar.tsx`, `Footer.tsx`

- **Works:** Consistent header, announcement bar with free-shipping threshold, scroll-shadow header, mobile slide-out menu with all main links, footer with categories and legal links. Footer now lists FAQ, Contact Us, Returns & Refunds and Privacy Policy under Quick Links (Session 4 change, `Footer.tsx`).
- **Broken:** Nothing found that breaks navigation. Routes for all footer links exist in `App.tsx`.
- **Missing:** No logo link to a help or contact entry in the header. No account or wishlist icon below 640px width in the header; those are only inside the mobile menu (`Navbar.tsx`: `max-sm:hidden`) [VERIFIED-CODE].
- **Confusing:** On small screens a shopper sees search and cart but not account or wishlist. Account access depends on opening the menu.
- **Trust:** Footer copy "Premium sportswear engineered for people who train hard and live harder" is generic brand copy with no factual content (`Footer.tsx`).
- **Improve:** Show account and wishlist access on small screens, or add them to the mobile header row. Add a visible Help link in the header or the account menu (see CA-25).

### 2.2 Home — `pages/Home.tsx`

- **Works:** Hero with clear headline "Built to move." and two calls to action; men and women collection banners; best sellers and new arrivals sections; promo banner; "Why choose us" cards; gallery grid.
- **Broken or empty:** Best sellers shows only products flagged `isBestSeller`; if none are flagged the section renders an empty grid under its heading (`useHomeSections`). [VERIFIED-CODE] Not visually confirmed.
- **Missing:** No real social proof (reviews removed, see CA-16). No store story or founder/brand information. No delivery promise beyond the announcement bar. No link to the Contact or FAQ page from the body.
- **Confusing:** The gallery section is titled "Gallery" but shows stock photos of athletes, not VORTEX customers or products (`InstagramGallery` in `Home.tsx`, images in `data/images.ts`). The shopper may assume they are product photos.
- **Trust:** Hero text "New Season / 2026" is hard-coded (`Home.tsx`). Will look stale in a later year and is an unverified claim about a new season. "Why choose us" card text ("Lightweight, breathable fabrics designed for training") is a general claim, not checked against any product (`data/content.ts`).
- **Improve:** Replace stock imagery with real product or brand photography (CA-02). Remove or replace the hard-coded season label with a configurable value. Add real social proof when available. Make the best sellers section hide itself when empty.

### 2.3 Shop listing — `pages/Shop.tsx`, `components/FilterPanel.tsx`, `ProductCard.tsx`, `ProductGrid.tsx`, `Pagination.tsx`

- **Works:** Search (debounced, URL-driven), gender/category/size/colour/price filters, four sort options, pagination with 12 per page, active filter chips, empty-state message with clear-filters button, error state with retry. The server applies filters and paging (`productQuery.js`; covered by `productQuery.test.mjs` and `products.api.test.mjs`, which were part of the owner's CA-01 full-suite run: 348 tests, 0 failed, on standalone and replica-set MongoDB. Not run by Claude. No individual assertion in these files has been checked.).
- **Broken:** No confirmed defect in the listing itself. Search and sort can race: a sort change made within 300 ms of typing can be overwritten (BUG-15, `Shop.tsx`).
- **Missing:** No "load more" or infinite scroll (acceptable, but no pager on mobile beyond numbered buttons). No stock indicator on cards. No "sold out" overlay on cards; sold-out items remain in the grid. No search suggestions. No "no results" recommendations.
- **Confusing:** Price range labels show "$" regardless of configured currency (`FilterPanel.tsx`, `Shop.tsx` chip) (CA-28). Hidden categories still show their products (BUG-08, CA-35).
- **Trust:** Cards show a "-N%" badge and a crossed-out price. Discount percentages are correct for the seed data (BUG-05 verified max 23%).
- **Improve:** Show sold-out state on cards and filter it optionally. Fix currency labels. Enforce hidden categories on the backend (decision 3, planned).

### 2.4 Product detail — `pages/ProductDetail.tsx`

- **Works:** Breadcrumb; image thumbnails and main image; colour and size pickers with per-variant availability (unavailable options are disabled and struck through); stock message ("Only N left in stock" at 3 or fewer); quantity selector limited by stock; add to cart with clear validation ("Please select a size"); wishlist toggle; free-shipping label and returns link; "Shipping & Returns" accordion. Rating and reviews block appear only when reviews exist (B1).
- **Broken:** No confirmed bug in the add-to-cart path from the source. Database-level stock correctness is verified for the test suite only (CA-01 run, owner-run); real-load behaviour is not verified.
- **Missing:**
  - Size guide or fit information (CA-14).
  - Product material, fabric composition, weight, or specifications (CA-14).
  - Product-specific care instructions. The generic text was removed (Session 4); nothing replaces it yet (CA-14).
  - Delivery estimate for this product (CA-14).
  - Product reviews (CA-16).
  - Sticky "Add to cart" on mobile (CA-13).
- **Confusing:**
  - The second product image appears only on hover (`ProductCard.tsx`). Touch users never see it, and the product page has only the thumbnail row.
  - "Returns policy" link text is shown as a link when no return window is configured, but the policy page says the window is a placeholder. Shoppers may read this as "returns are available" without a stated window (`ProductDetail.tsx`, `Returns` placeholder).
  - "Complete the look" is a generic related-products list, not a styled set (`ProductDetail.tsx`).
- **Trust:**
  - Product description is a single paragraph per product (demo text in `seed/catalog.js`). Descriptions contain claims such as "flatlock seams" and "four-way stretch" that are not verified for real products. Before launch these must come from the real product (CA-02).
  - Stock photos (CA-02).
- **Improve:** Add a size guide and product specifications fields to the admin product form. Show the second image on tap. Add a sticky add-to-cart bar on mobile. Show a delivery estimate once the business has real delivery times (business information required).

### 2.5 Cart — `pages/Cart.tsx`, `components/CartDrawer.tsx`, `hooks/useCartQuote.ts`

- **Works:** Drawer and full cart page; quantity changes capped at stock; size and colour can be changed in the cart; invalid lines flagged; "Remove unavailable items" button; coupon applied with server validation; subtotal, discount, shipping, and total from the server; free-shipping progress bar in the drawer. Cart persists in localStorage.
- **Broken:** No confirmed defect in the cart code. Server-side stock and coupon behaviour is covered by the CA-01 test-suite run (owner-run); real-load behaviour is not verified.
- **Missing:** No estimated delivery date. No tax line (business decision, CA-08). No "save for later" beyond the wishlist. No guest cart merge after login beyond the cart staying in local storage.
- **Confusing:**
  - The drawer says "Shipping and coupons are calculated in your cart," but the drawer itself shows only subtotal, so the final total may be a surprise (`CartDrawer.tsx`) [ASSUMPTION].
  - Checkout is disabled (`pointer-events-none`, `aria-disabled`) until the server quote arrives. If the quote is slow or fails, the button stays inactive with no explanation beyond a red line (`Cart.tsx`).
  - A coupon that becomes invalid is removed automatically with a toast (`useCartQuote.ts`). The message is generic: "Your coupon was removed" or the server reason.
- **Trust:** Prices come from the server, so the displayed total at checkout matches the quote (`pricing.js`). Good.
- **Improve:** Show the total in the drawer, not only the subtotal. Explain the disabled checkout state. Add a clear first-load state rather than a blank total ("-").

### 2.6 Checkout — `pages/Checkout.tsx`

- **Works:** Guest checkout and logged-in prefill (never overwriting typed values); field-level validation messages; order summary with line status; disabled place-order button while the quote is loading or has issues; duplicate-submit protection (`inFlight` ref and idempotency key); 409 handling refreshes the cart with the reason.
- **Broken or risky:**
  - **Field label association is broken.** `Field` sets its own `id` and then spreads the caller's `rest` props. Checkout passes `id="co-fullName"` etc., so the input id changes but the label's `htmlFor` does not. Clicking a label does not focus its input, and the label is not programmatically associated with the input (`components/Field.tsx`, `pages/Checkout.tsx`). Confirmed by reading the code [VERIFIED-CODE]; not confirmed in a browser. (CA-06)
  - **Place-order button is at the bottom of the page on mobile.** On single-column layout the order summary and button come after the entire form (`Checkout.tsx` grid), so a mobile shopper scrolls past the form to find the total and button.
- **Missing:**
  - Structured address (no governorate/area list, no postal code). City is free text (`Checkout.tsx`). Business information needed (CA-22).
  - Phone number is accepted in any format with 6 or more digits. No country code guidance. Business information needed (CA-22).
  - No "order notes" guidance on what is allowed (optional field, 500 characters).
  - No address book for logged-in customers (single address in profile only).
  - No tax or VAT line (CA-08).
- **Confusing:**
  - "Online payment — Not available yet" is shown as a disabled option (`Checkout.tsx`). It makes the page look unfinished and invites a question the shopper cannot act on (CA-21).
  - "The courier will call this number" (`hint` on phone). This is a promise about the business's process that is not confirmed (CA-03).
  - "Used to track your order" on email. True, but there is no order-status email after confirmation (CA-36).
- **Trust:** The summary shows discount, shipping, and total from the server. Good. Terms of sale are not linked from the checkout page; no privacy notice is linked before personal details are entered (CA-03).
- **Improve:** Link the privacy policy and returns policy next to the place-order button. Put the summary and total above the form on mobile, or make the total sticky. Fix the `Field` label association (CA-06). Replace the disabled online-payment option with nothing until it exists.

### 2.7 Order confirmation — `pages/OrderConfirmation.tsx`

- **Works:** Clear "Order placed" heading and order number; "Save this number" guidance; "What happens next" steps; order view; track-order and continue-shopping buttons. The order is loaded from navigation state or session storage; a logged-in owner can refetch it.
- **Broken:** Nothing found in the code.
- **Missing:** No confirmation email when SMTP is not configured (CA-04). The page does not say that no email was sent. It shows "A confirmation email was sent" only when `emailSent` is true.
- **Confusing:** "We confirm your order — you will get a call or message on the phone number you gave us." This is a statement about the business's process that is not confirmed (CA-03).
- **Trust:** Good: order number is prominent.
- **Improve:** When email is not sent, say so and instruct the shopper to save the order number and use Track Order. Provide a printable or copyable summary.

### 2.8 Track order — `pages/TrackOrder.tsx`

- **Works:** Order number and email form; generic "could not find" error for unknown or mismatched details (no information leak, per `orderController.js`. `orders.test.mjs` was part of the owner's CA-01 full-suite run: 348 tests, 0 failed on both the standalone and replica-set runs. I have not checked which assertion covers this specific not-found message, so treat that message as code-verified only.); order view; guest cancellation while eligible with a confirmation dialog.
- **Broken:** Nothing found.
- **Missing:** No order status email. No shipping or courier tracking link (business information needed).
- **Confusing:** The form uses the order number prefilled from `?order=`. Fine. Users who lost the number have no recovery route (no "email me my order number") (CA-36).
- **Improve:** Add a recovery route once email exists. Show expected next step per status.

### 2.9 Login, register, account — `pages/Login.tsx`, `Register.tsx`, `Account.tsx`, `OrderDetail.tsx`

- **Works:** Login with redirect `next` handling (open-redirect safe, `safeNext.ts`); register with password rule (8 characters, matching server); account profile edit; order history tab; password change with other-session sign-out (server); order detail with cancel for eligible orders.
- **Broken or risky:**
  - **Registration reveals whether an email has an account.** The server returns 409 "That email is already in use" and the page says "An account with this email already exists" (CA-09, BUG-20).
  - **Logout clears only the cookie.** A copied token remains valid for up to 7 days (SEC-02, planned fix).
- **Missing:**
  - **No password reset.** A customer who forgets their password cannot recover the account (CA-05). Planned (decision 5), not implemented.
  - No account deletion or data-export request (privacy expectation, CA-03).
  - No saved addresses (single profile address only).
  - No email verification at registration (business decision, CA-10).
- **Confusing:** Login page has no "forgot password" link at all. A shopper who cannot log in has nowhere to go.
- **Trust:** Account page shows order list with status and totals. Good.
- **Improve:** Add "Forgot password?" to the login page as soon as password reset exists. Show a neutral message on registration conflicts.

### 2.10 Wishlist — `pages/Wishlist.tsx`, `WishlistContext.tsx`

- **Works:** Heart toggle on cards and on the product page; wishlist count in header and menu; empty state with browse link; stale products removed when they no longer exist.
- **Broken:**
  - A wishlist with more than 50 items silently loses everything beyond 50 (BUG-10, `services/api.ts` `byIds` and `Wishlist.tsx` `retain`) [VERIFIED-CODE].
  - A possible race can drop an item added while a previous request is pending (BUG-16) [VERIFIED-CODE, not reproduced].
- **Missing:** No sharing, no move-to-cart button, no quantity or size on the wishlist. Wishlist is per browser only.
- **Confusing:** Wishlist items appear with no size selection; adding to cart requires opening the product page (`Wishlist.tsx`). [ASSUMPTION] that shoppers expect a quick add.
- **Improve:** Fix the 50-item loss. Add a move-to-cart that opens size selection.

### 2.11 Help and policy pages — `pages/Faq.tsx`, `Contact.tsx`, `Privacy.tsx`, `Returns.tsx`, `components/PolicyPage.tsx`, `data/policies.ts`

- **Works:** Routes exist and are linked from the footer. FAQ answers are limited to facts verified in the code (cash on delivery only, cancel while pending or confirmed, tracking by order number and email, guest checkout, browser-stored cart and wishlist). Placeholders are highlighted and a draft notice appears. Contact form states are handled: loading, disabled with an honest notice, and normal.
- **Broken:** Nothing broken in the code. The pages are intentionally incomplete.
- **Missing (business information required; see Section 6):**
  - Business legal identity, address, contact channel, and reply time.
  - Delivery areas, times, courier, and shipping costs as a sentence (FAQ shipping answer uses placeholders).
  - Return window, eligible items, refund method, refund timing, and the process.
  - Privacy: controller identity, purposes, legal bases, recipients, retention, rights, and the change process.
  - Social channels (none are shown).
- **Trust:** This is the most important trust gap. A shopper who sees "[PLACEHOLDER]" text, even highlighted, will leave. The draft notice is honest and correct for the current state, but it cannot be published as is (CA-03).
- **Confusing:** "Returns & Refunds" appears in three places (footer Quick Links, footer legal strip, and a sentence in the footer shipping text). Duplicated links are harmless but add clutter (CA-26).
- **Improve:** Fill the placeholders with real content before launch. Do not publish until every placeholder is resolved. Remove the duplicate footer returns sentence once the Quick Links entry exists.

### 2.12 Not-found page — `pages/NotFound.tsx`

- **Works:** Friendly 404 with home and shop links.
- **Missing:** No search box or popular links.
- **Improve:** Add search to the 404 page. Low priority.

### 2.13 Admin dashboard and management — `pages/admin/*`

- **Works:** Dashboard totals, pending-order alert, low-stock list, recent orders, best sellers. Product list with hide, feature, edit, delete. Product form with images, sizes, colours, stock grid, sale price, validation. Orders list with search, status, and date filters; order detail with status flow, notes, cancel with stock restoration. Categories CRUD.
- **Broken or risky:**
  - **Stock edits can overwrite recent sales.** The product form sends absolute stock values for variants the admin changed (BUG-09). A sale made after the page was opened is overwritten. Planned fix (G1).
  - **Hidden categories do not hide products** (BUG-08, CA-35).
  - **The product form labels prices in "$"** (BUG-06).
- **Missing:**
  - Coupon management UI (API exists; no page, no menu link) (CA-34).
  - Customer management UI (API exists; no page) (CA-34).
  - Review moderation (not built; planned) (CA-16).
  - Bulk stock or price update.
  - Order export (CSV) for fulfilment and bookkeeping.
  - A way to record that a COD payment was received or refunded (the system marks "paid" automatically on delivery, `orderService.js`) (CA-37).
  - Product duplication.
  - SEO fields per product (page title and description).
- **Confusing:** Admin order status "Mark as {status}" buttons show only the next step, which is good. "Stock was NOT fully returned" warnings on cancelled orders appear only when `stockRestoredAt` is missing (`OrderDetail.tsx`). Clear.
- **Improve:** Fix the stock race before the owner relies on the admin to set stock during a sale. Build coupon and customer screens. Add a COD payment-received step.

---

## Section 3 — Conversion Problems

Listed by stage. Each item notes the cause and its likely effect.

### 3.1 Product discovery
- No real product photography (CA-02). Shoppers cannot judge the product.
- No sold-out state on product cards (CA-13 related). Shoppers click into sold-out items.
- Filters show "$" when the store runs in another currency (CA-28).
- Hidden categories still listed in footer categories until the admin hides them, and their products still appear (CA-35).
- Best sellers can be empty (Section 2.2).

### 3.2 Product consideration (add-to-cart rate)
- No size guide (CA-14). The most common reason apparel shoppers leave.
- No fabric, fit, or specification details (CA-14).
- No social proof (CA-16).
- No delivery estimate on the product page (CA-14, business information required).
- Second image only on hover; not visible on touch devices (CA-27).
- No sticky add-to-cart on mobile (CA-13).

### 3.3 Cart
- Checkout blocked silently until quote loads (Section 2.5).
- Drawer total shows subtotal only; final price revealed later (Section 2.5).
- No tax information (CA-08).

### 3.4 Checkout completion
- Place-order button below the fold on mobile (Section 2.6, CA-13).
- Disabled "Online payment — not available" option (CA-21).
- No privacy or returns link beside the place-order button (CA-03).
- City is free text; no postal code; phone format loose (CA-22).
- Field labels not associated with inputs (CA-06): affects keyboard and screen-reader users, and reduces trust in form quality.
- No order email by default (CA-04): the customer may fear the order was not placed.

### 3.5 Customer trust
- Placeholder policy text (CA-03).
- No business identity or contact channel (CA-03).
- Stock photos presented as the store's own gallery (CA-02).
- Generic claims in "Why choose us" (Section 2.2).
- No social channels (Section 6).
- Registration reveals account existence (CA-09).

### 3.6 Repeat purchases
- No password reset (CA-05): a returning customer locked out is lost.
- No order-status emails after confirmation (CA-36).
- No saved addresses (Section 2.9).
- Wishlist and cart are per browser; they do not follow the customer to another device (by design; note only).
- No loyalty, reorder, or referral features (optional, Section 5).

---

## Section 4 — Technical Problems

### 4.1 Frontend
- **FE-01 (P1):** No error boundary in the React tree (`main.tsx`, `App.tsx`). A runtime exception in any page shows a blank screen. [VERIFIED-CODE]
- **FE-02 (P1):** Checkout and other forms pass `id` to `Field`, which breaks label association (CA-06). [VERIFIED-CODE]
- **FE-03 (P2):** Currency not reactive (`utils/format.ts`); components can show the old currency after settings load (BUG-07).
- **FE-04 (P2):** Hard-coded `$` in admin product form, shop chip, and filter labels (BUG-06).
- **FE-05 (P2):** Wishlist truncation at 50 items (BUG-10).
- **FE-06 (P3):** Toast timers not cleared on unmount (BUG-18).
- **FE-07 (P3):** `useRef(newKey())` regenerates randomness on each render (BUG-19).
- **FE-08 (P2):** Reveal animation hides content until intersection (`Reveal.tsx`, opacity-0). Content below the fold is invisible until scrolled. Not a bug, but it affects crawlers and print. [NOT VERIFIED in browser]

### 4.2 Backend and API
- **BE-01 (P1):** Registration conflict reveals account existence (BUG-20, SEC-01).
- **BE-02 (P1):** Logout does not revoke the token server-side (SEC-02, planned).
- **BE-03 (P1):** Stock race on product update when sizes or colours change (BUG-21) and on admin absolute stock writes (BUG-09). [VERIFIED-CODE]
- **BE-04 (P2):** Hidden categories not enforced (BUG-08).
- **BE-05 (P2):** Idempotency claim can stay stuck after a crash (BUG-22); recovers after 24 hours or with a new key.
- **BE-06 (P2):** Per-IP rate limits in memory (SEC-03). Shared IPs (school, office, carrier NAT) can be throttled. `writeLimiter` allows 30 order submissions per hour per IP (`rateLimiter.js`). [ASSUMPTION about IP sharing; limit values are verified in code]
- **BE-07 (P2):** `apiLimiter` allows 300 requests per 15 minutes per IP. Cart quote runs on every cart change (`useCartQuote`), so an active shopper on a shared IP can approach the limit. [ASSUMPTION]
- **BE-08 (P2):** Duplicate idempotent checkout replay returns full order data including address (SEC-06).
- **BE-09 (P3):** Unhandled promise rejection exits the process (BUG-27, `index.js`).
- **BE-10 (P2):** Confirmation email depends entirely on SMTP; no retry queue. `emailSent` is recorded but no later retry happens (`orderService.notifyOrderCreated`). [VERIFIED-CODE]

### 4.3 Database
- **DB-01 (verified for the test suite, CA-01):** The owner ran the database tests on Windows against throwaway MongoDB 8.2.7 instances. Standalone: 348 tests, 345 passed, 3 replica-set-only skipped, 0 failed. Replica set rs0: 348 tests, 348 passed, 0 failed. Real-load concurrency and production data behaviour remain unverified and require a separate decision.
- **DB-02 (P2):** Seed script wipes products, categories, reviews, and demo users on each run (BUG-28). Safe only on development databases; production requires `--force`.
- **DB-03 (P3):** Unused text index on products (BUG-24).
- **DB-04 (P2):** Old fabricated review documents may still exist in already-seeded databases. They are not deleted (B1 caveat). Requires owner approval to remove.

### 4.4 Security
- **SEC-01 (P1):** Registration enumeration (BE-01).
- **SEC-02 (P1):** Logout does not revoke tokens (BE-02).
- **SEC-03 (P1):** Per-IP login limits only; no per-account lockout.
- **SEC-04 (P2):** Image URLs accept any https host (decision pending, `productValidators.js`, `categoryValidators.js`).
- **SEC-05 (P2):** Dependency advisories not checked (`npm audit` not run). `multer 1.4.5-lts` is an older line. Never use `npm audit fix --force`.
- **SEC-06 (P3):** Order details kept in `sessionStorage` after checkout (`shop.ts`).
- **SEC-07 (P2):** No Content-Security-Policy on the client (`index.html`). Matters at deployment.
- **SEC-08 (P3):** `BACKUP_INFO.txt` states a backup contains `.env` files. Treat the backup as sensitive.
- **SEC-09 (P3):** Guest cancellation by order number and email, without a second factor (`orderController.cancelLookup`). Acceptable for COD with pending or confirmed orders; a design decision for the owner.
- Strengths verified in code: httpOnly cookie, SameSite Lax, Secure in production, HS256 pinning, server-side role checks, NoSQL key stripping, regex escaping, upload content sniffing and re-encoding, CORS allow-list, helmet, no X-Powered-By, no-store on sensitive routes.

### 4.5 Performance
- **PF-01 (P2):** All product and gallery images are external Unsplash URLs (`data/images.ts`, `seed/catalog.js`). Store speed depends on a third-party CDN. [NOT VERIFIED in browser]
- **PF-02 (P2):** Hero image loads at 2000px with `loading="eager"` (`Home.tsx`, `Hero`). Large download on mobile. [NOT MEASURED]
- **PF-03 (P2):** `Img` renders no explicit width and height, which can cause layout shift as images load. [VERIFIED-CODE; impact NOT MEASURED]
- **PF-04 (P3):** Home fetches 50 products once and slices sections client-side (`useHomeSections`). Fine at current size; will not scale.
- No performance measurements were taken. All statements above are source-based.

### 4.6 Accessibility
- **A11Y-01 (P1):** Form labels not associated with inputs in checkout and other `Field` usages that pass `id` (FE-02). [VERIFIED-CODE]
- **A11Y-02 (P2):** Legal strip text is `text-xs text-neutral-500` on near-black (`Footer.tsx`). Low contrast. [NOT MEASURED against WCAG; colour values verified in code]
- **A11Y-03 (P3):** Product image thumbnails use empty `alt` (`ProductDetail.tsx`: `alt=""`). Acceptable only if the main image carries the product name. It does.
- **A11Y-04 (P2):** Colour swatch buttons rely on `title` and `aria-label`; disabled colours shown with a diagonal line only (`ProductDetail.tsx`). Visually subtle.
- Good practice verified: `aria-live` for stock, `role="alert"` for errors, `aria-current` in pagination, `aria-pressed` on wishlist toggles, honeypot field hidden properly.

### 4.7 SEO and metadata
- **SEO-01 (P1):** `index.html` has only a `<title>`. No meta description, no Open Graph tags, no canonical URL, no favicon link, no robots directive. [VERIFIED-CODE]
- **SEO-02 (P1):** No `public/` folder exists, so there is no `robots.txt`, no `sitemap.xml`, and no favicon file (directory listing of `client/`). [VERIFIED-CODE]
- **SEO-03 (P1):** The site is a client-rendered single-page app. Product and category pages are not in the HTML a search crawler first receives. Product pages therefore have no crawlable copy until JavaScript runs. [ASSUMPTION about crawler behaviour]
- **SEO-04 (P2):** `useDocumentTitle` sets titles per page (good), but there are no per-product descriptions or structured data (`Product` schema).
- **SEO-05 (P2):** No Open Graph images for sharing product links on social media.

### 4.8 Build and quality
- **Q-01 (P2):** Historical. The owner reported that `npx tsc -b` and `npm run build` passed after the first Session 3 client edits (`Home.tsx`, `content.ts`, `Footer.tsx`). That report does not verify later client edits: `ProductCard.tsx`, `ProductDetail.tsx`, `Contact.tsx`, `PolicyPage.tsx`, `policies.ts`, `Faq.tsx`, `Privacy.tsx`, `Returns.tsx`, `App.tsx`, and the footer link change. See the progress file, section 21. Some files use `React.*` types without importing React (`Checkout.tsx`, `FilterPanel.tsx`, `Account.tsx`, `Contact.tsx`). The historical run was reported as compiling, but these files have not been re-checked.
- **Q-02 (P2):** No automated frontend tests exist. The only front-end verification is the compiler and build.
- **Q-03 (P3):** `tsconfig.tsbuildinfo` not in `.gitignore` (BUG-26).

---

## Section 5 — Missing Features

### 5.1 Essential for a professional sportswear e-commerce business (before launch)

1. Real product photography for every product, with at least one front and one back image, and consistent backgrounds (CA-02).
2. Real business identity and a working contact channel: legal name, address, email, and phone (CA-03).
3. Finished Returns, Privacy, and Terms (sale terms) pages (CA-03). Terms of sale are **not in the code at all** and are missing entirely.
4. Size guide per product (CA-14).
5. Product specifications: fabric, fit, weight, and care instructions per product (CA-14).
6. Order confirmation email that works, or an explicit on-screen fallback when email is not sent (CA-04).
7. Password reset (CA-05; planned).
8. Working tax or VAT treatment, shown to the customer (CA-08, business decision).
9. Currency decision for the target market (CA-07, business decision).
10. Real delivery information: areas, times, and cost (CA-22, business information).
11. Analytics or conversion tracking, if the owner wants to measure the store (CA-39; this must be reflected in the privacy policy).
12. Error boundary and monitoring so runtime failures are visible (FE-01).
13. Basic SEO: meta descriptions, Open Graph, favicon, sitemap, robots (Section 4.7).

### 5.2 Important but may follow launch

14. Real product reviews with verified buyers and moderation (approved design; not built) (CA-16).
15. Order-status emails at shipped and delivered (CA-36).
16. Admin coupon and customer screens (CA-34).
17. COD payment-received and refund recording (CA-37).
18. Saved addresses for logged-in customers.
19. Order CSV export for fulfilment.
20. Sold-out state on cards and a "notify me when back" option.

### 5.3 Optional enhancements

21. Size recommendation tool.
22. Bundles, outfits, and "complete the look" styled sets.
23. Gift options and gift notes.
24. Loyalty or referral programme.
25. Newsletter with a real subscription provider (decision 9: hidden until built).
26. Social feed integration (only once real account URLs exist; decision 8).
27. Multi-language support (Arabic and English), if the owner targets Egyptian shoppers.
28. Price-drop alerts for wishlist items.

---

## Section 6 — Business Information Needed

Each item must come from the business owner. Nothing below has been invented in this report.

| # | Information | Where it is used | Why customers need it |
|---|---|---|---|
| 1 | Legal business name and registration details | Privacy, Returns, Terms, footer | Shoppers entering payment details need to know who they buy from. |
| 2 | Postal address | Contact page, footer (`STORE_ADDRESS`), privacy | Trust and legal requirement in many places. |
| 3 | Support email (`STORE_EMAIL`) | Contact page, footer, confirmations | The only working contact channel without SMTP. |
| 4 | Support phone and opening hours | Contact page (`STORE_PHONE`) | Shoppers with urgent order questions. |
| 5 | Reply time promise | Contact page, FAQ placeholders | Sets expectations; avoid promises the business cannot keep. |
| 6 | SMTP provider credentials (owner supplies to their own `.env`) | Order confirmation, contact form | Without it, no confirmation email and the contact form is disabled. Never share these. |
| 7 | Contact inbox (`CONTACT_TO`) | Contact form delivery | Messages reach a real person. |
| 8 | Currency and price display | All prices, settings (`CURRENCY`, `CURRENCY_LOCALE`) | Prices must be in the currency the customer pays in. |
| 9 | Tax or VAT treatment (prices inclusive or exclusive) | Cart, checkout, invoices | Final price must not surprise the customer; legal in many markets. |
| 10 | Shipping areas, delivery times, and costs | Product page, FAQ, checkout (`SHIPPING_FLAT_RATE`, `FREE_SHIPPING_THRESHOLD`) | Shipping cost is the most common abandonment reason. |
| 11 | Courier name and tracking process | Order confirmation, FAQ, track page | Customers want to know who will call or deliver. |
| 12 | Return window (days) or statement that returns are not accepted | Returns page, product page, `RETURN_WINDOW_DAYS` | A visible return promise is a major purchase trigger. |
| 13 | Return eligibility and process | Returns page | Prevents disputes. |
| 14 | Refund method and timing for COD orders | Returns page | COD refunds need a stated method (cash, bank transfer, or store credit). |
| 15 | Privacy: controller, purposes, legal basis, recipients, retention, rights, request channel | Privacy page | Required content for a lawful privacy policy. Must be reviewed by a qualified professional. |
| 16 | Terms of sale | New page needed | Not present in the code. Required before taking orders. |
| 17 | Analytics and advertising tools (yes or no, and which) | Privacy page | Must match what is actually installed. |
| 18 | Social media account URLs (or confirmation that none exist) | Footer, gallery | Hidden until real. Generic links were removed (decision 8). |
| 19 | Real product photography (front and back, consistent style) | Every product page and card | Stock photos of other people are the largest trust problem today. |
| 20 | Real product descriptions, fabric composition, fit, and care per product | Product page | Replaces demo copy and generic claims. |
| 21 | Real size charts per product or category | Product page | Reduces returns and abandonment. |
| 22 | Real stock levels and SKUs | Admin product stock | Demo stock is fictional. |
| 23 | Real pricing, sale rules, and promo codes (`PROMO_CODE`) | Announcement bar, promo banner, coupons | The banner shows the promo code when set. |
| 24 | Brand story and founder or team information (optional) | About or Home | Builds trust for a new brand. |
| 25 | Trading hours and public holiday schedule | Contact, order dispatch timing | Sets dispatch expectations. |
| 26 | Address format rules for the target market (city, area, building) | Checkout address fields | Free-text city and no area field can misdeliver. |
| 27 | Phone format rules (country code expected or not) | Checkout phone field | Courier must be able to call. |
| 28 | Copyright and business trademark notice | Footer | Standard for a branded store. Confirm wording with the owner. |
| 29 | Permission to keep or remove Unsplash demo imagery | Gallery, banners, product images | Unsplash licence permits use; the real problem is that these do not depict VORTEX products. |

---

## Section 7 — Prioritized Issues

Priority scale: **P0** critical (prevents purchases, serious security, or risks customer or order data). **P1** high (significantly damages conversion, trust, or essential function). **P2** medium (friction or lowers professionalism). **P3** low (cosmetic or optional).

Format per issue: ID, priority, category, description, evidence, affected page or feature, reproduction, business impact, recommended solution, files.

### CA-01 — P0 — Verification
- **Status (updated):** VERIFIED BY OWNER (Windows). CA-01 test-suite verification complete (database test suite only; Phase 1 as a whole remains open). Standalone MongoDB 8.2.7 (port 27019): 348 tests, 345 passed, 0 failed, 3 skipped (replica-set-only transaction subtests). Replica set rs0 MongoDB 8.2.7 (port 27020, state PRIMARY): 348 tests, 348 passed, 0 failed, 0 skipped. Temporary servers shut down; ports 27019 and 27020 confirmed free; only system databases remained. Source: owner-provided PowerShell output; recorded in VORTEX_PROGRESS.md section 27. Remaining audit items are unchanged by this result.
- **Description:** Historical (before verification): the database-dependent test groups were skipped in an earlier owner run because `MONGO_TEST_URI` was not set, so the purchase logic was unverified at that time. The CA-01 run (see Status above) has since executed these tests on standalone and replica-set MongoDB. That result covers the test suite only; real-load concurrency and production behaviour remain unverified.
- **Evidence (historical, superseded):** Earlier owner-reported output, from a run before `MONGO_TEST_URI` was set: "18 database-dependent test groups skipped because MONGO_TEST_URI was not set." Recorded in `VORTEX_PROGRESS.md` section 23. Superseded by the CA-01 run (section 27).
- **Affected:** Checkout, order cancellation, stock, coupons, admin order status.
- **Reproduce:** Run `npm test` in `server/` without `MONGO_TEST_URI`; observe skipped groups.
- **Impact:** Overselling, incorrect totals, double-charged or double-counted coupons, and cancelled orders not restoring stock would go undetected.
- **Recommended solution (updated):** The owner has run the database test suite on standalone and replica-set MongoDB (CA-01; section 27 of the progress file). No further database run is needed for the test suite. Real-load concurrency testing is not covered and needs a separate decision. For any future database run, keep the throwaway-database and dedicated-port rules from section 27. No change to production data.
- **Files:** `server/tests/*.test.mjs` (database groups), `tests/helpers.mjs`.

### CA-02 — P0 — Product imagery and catalogue
- **Description:** All product, banner, and gallery images are Unsplash stock photos of athletes, not VORTEX products. The gallery is titled "Gallery" but shows the same stock photos. The catalogue (names, descriptions, prices, sizes, colours, stock) is demo data.
- **Evidence:** `client/src/data/images.ts` (POOLS, HERO_IMAGE, banners, GALLERY); `server/src/seed/catalog.js` (product images and demo descriptions such as "flatlock seams"); `Home.tsx` gallery section.
- **Affected:** Home, Shop cards, product pages, cart and checkout thumbnails, order emails.
- **Reproduce:** Open any product page; the image shows a model, not the product offered.
- **Impact:** A shopper cannot judge colour, fit, or quality. Customers receiving a different item will file disputes and returns, damaging the brand.
- **Recommended solution:** Owner supplies real product photos (Business Information items 19, 20, 22). Replace seed and demo data through the admin. Do not launch with stock photos for products.
- **Files:** `client/src/data/images.ts`, `server/src/seed/catalog.js`, `client/src/pages/Home.tsx`.

### CA-03 — P0 — Business identity, contact, and policies
- **Description:** No business identity or contact details are set by default. The contact page shows "Contact details are not published yet" and the form is unavailable unless SMTP and `CONTACT_TO` are configured. Returns, refunds, delivery, and privacy content contain placeholders. Terms of sale are absent.
- **Evidence:** `server/src/config/settings.js` defaults (`STORE_EMAIL`, `STORE_PHONE`, `STORE_ADDRESS` empty; `RETURN_WINDOW_DAYS` empty); `client/src/data/policies.ts`; `client/src/pages/Contact.tsx` (`!formAvailable` branch); no Terms route in `App.tsx`.
- **Affected:** Contact, FAQ, Privacy, Returns, checkout (no policy links at the point of payment), footer.
- **Reproduce:** Open `/contact` with default settings. Open `/privacy`. Both show placeholders or unavailable states.
- **Impact:** Shoppers cannot verify who they buy from, cannot ask questions, and cannot read the return or privacy promise before entering personal details. Strongest abandonment driver in the store.
- **Recommended solution:** Business supplies items 1–7, 12–17, 25 (Section 6). Write final policy text with qualified legal review. Add a Terms page. Add policy links next to the place-order button.
- **Files:** `server/src/config/settings.js` (settings only, no code change required), `client/src/data/policies.ts`, `client/src/pages/Checkout.tsx`, `client/src/App.tsx`, `client/src/pages/Contact.tsx`.

### CA-04 — P0 — Order confirmation
- **Description:** Order confirmation email is sent only when SMTP is configured. Without it, no email is sent and the order confirmation page shows no notice that email was not sent. The shopper relies only on the order number shown on screen.
- **Evidence:** `orderController.create` (`emailSent` flag); `orderService.notifyOrderCreated` (`confirmationEmail: 'not_configured'` recorded); `OrderConfirmation.tsx` shows "A confirmation email was sent" only when `emailSent` is true and shows nothing otherwise.
- **Affected:** Checkout completion, order confirmation, order tracking.
- **Reproduce:** Place an order with SMTP unset. The confirmation page shows no email line. Check for an email: none.
- **Impact:** Customers who close the page lose their order number and cannot track the order. Fear that the order failed drives repeat submissions and support contacts.
- **Recommended solution:** Configure SMTP (owner). Add an explicit on-screen message when email is not sent: "We could not email your confirmation. Save your order number: VTX-…". Retry queue is optional.
- **Files:** `client/src/pages/OrderConfirmation.tsx`, `server/src/services/orderService.js`, `server/src/services/mailer.js`.

### CA-05 — P1 — Password recovery
- **Description:** No password reset exists. The login page has no "Forgot password" link.
- **Evidence:** `server/src/routes/authRoutes.js` (no reset route); `client/src/pages/Login.tsx` (no link); `phase7.test.mjs` asserts no reset endpoint.
- **Affected:** Login, account.
- **Reproduce:** Open `/login`; no recovery option exists.
- **Impact:** Customers with forgotten passwords are locked out and may not return.
- **Recommended solution:** Implement approved decision 5 (hashed single-use expiring token, rate limit, no reset when SMTP is absent).
- **Files:** `server/src/routes/authRoutes.js`, `authController.js`, `mailer.js`, new token model, `client/src/pages/Login.tsx`, new reset pages.

### CA-06 — P1 — Form accessibility and checkout labels
- **Description:** `Field` renders its own id, then spreads caller props, so the caller's `id` replaces it. The `<label htmlFor>` points at the generated id, so the label is not associated with its input. Affects checkout (`co-fullName`, `co-email`, `co-phone`, `co-city`, `co-address`, `co-notes`) and any other `Field` usage that passes `id`.
- **Evidence:** `client/src/components/Field.tsx` (`<input id={id} ... {...rest}>`); `client/src/pages/Checkout.tsx` (passes `id="co-…"`).
- **Affected:** Checkout form, keyboard and screen-reader users.
- **Reproduce:** Click the "Email" label in checkout; focus does not move to the field (expected in a browser test; not run).
- **Impact:** Lower completion rates on mobile and for assistive-technology users; failed WCAG labelling expectations.
- **Recommended solution:** Remove the `id` prop from callers (or let `Field` accept an `id` and use it for both label and input). The checkout focus-on-error call uses `document.getElementById('co-…')`, which must still resolve.
- **Files:** `client/src/components/Field.tsx`, `client/src/pages/Checkout.tsx`, others that pass `id` to `Field`.

### CA-07 — P0 — Currency and market (business decision)
- **Description:** Default currency is USD; demo prices are in dollars. Configuration supports EGP but the store has not been set up for that market. Prices are not localized or tested in another currency end-to-end.
- **Evidence:** `server/src/config/settings.js` (`CURRENCY` default `USD`); seed prices in `catalog.js`; `format.ts` (not reactive, BUG-07).
- **Affected:** Every price in the store.
- **Reproduce:** Set `CURRENCY=EGP` locally (owner-only) and reload; some labels still show "$" (CA-28) and the formatter may not update until a re-render.
- **Impact:** A shopper who sees USD prices in an Egyptian store, or sees mixed symbols, will not trust the total.
- **Recommended solution:** Owner decides the currency and whether prices include tax. Then set `CURRENCY` and `CURRENCY_LOCALE`, fix BUG-06 and BUG-07, and verify every price on every page.
- **Files:** `server/src/config/settings.js` (settings), `client/src/utils/format.ts`, `client/src/hooks/useShopConfig.ts`, `ProductForm.tsx`, `Shop.tsx`, `FilterPanel.tsx`.

### CA-08 — P1 — Tax and final-price clarity (business decision)
- **Description:** No tax or VAT calculation exists. The total is subtotal, discount, and flat shipping only. Whether listed prices include tax is not stated anywhere.
- **Evidence:** `server/src/services/pricing.js` (`total = afterDiscount + shipping`); no tax field in `Order` model.
- **Affected:** Cart, checkout, order confirmation, invoices.
- **Impact:** Customers may be surprised by a different final amount if tax is later added; legal exposure depends on jurisdiction.
- **Recommended solution:** Owner decides the tax treatment. Show "prices include/exclude tax" wording on the product, cart, and checkout pages once decided.
- **Files:** `server/src/services/pricing.js`, `server/src/models/Order.js`, product, cart, checkout pages.

### CA-09 — P1 — Registration enumeration
- **Description:** Duplicate email returns 409 "That email is already in use" and the register page says the account exists. This confirms a person has an account with the store.
- **Evidence:** `server/src/middleware/errorHandler.js` (11000 mapping); `client/src/pages/Register.tsx` (409 branch).
- **Affected:** Registration.
- **Reproduce:** Register with an existing email; the message reveals the account.
- **Impact:** Privacy concern for customers; enables targeted phishing against known customers.
- **Recommended solution:** Generic response, for example "We could not create that account. If you already have one, log in or reset your password." (approved approach; not yet implemented.)
- **Files:** `server/src/middleware/errorHandler.js` or `server/src/controllers/authController.js`, `client/src/pages/Register.tsx`, `server/tests/auth.test.mjs` (expects 409).

### CA-10 — P2 — No email verification (business decision)
- **Description:** Registration does not verify the email. Any address can be used.
- **Evidence:** `authController.register` creates the user and logs in immediately.
- **Impact:** Fake accounts; order emails sent to mistyped addresses; weak account recovery (once CA-05 exists).
- **Recommended solution:** After CA-05, decide whether to require verification. A later batch.
- **Files:** `server/src/controllers/authController.js`, `server/src/models/User.js`.

### CA-11 — P1 — No error boundary
- **Description:** No React error boundary wraps the app. An exception during render blanks the page.
- **Evidence:** `client/src/main.tsx`, `client/src/App.tsx`: no `ErrorBoundary` component exists in `client/src/components/` (directory listing).
- **Affected:** Every page.
- **Reproduce:** Not run. A render-time exception in any component would show a blank page.
- **Impact:** Lost sales at any unexpected data shape (for example a product with no images).
- **Recommended solution:** Add a small error boundary around `<Routes>` with the existing `ErrorState` styling and a reload action.
- **Files:** `client/src/App.tsx`, new `components/ErrorBoundary.tsx`.

### CA-12 — P2 — Mobile header hides account and wishlist
- **Description:** Under 640px the header hides wishlist and account icons (`max-sm:hidden`). They are reachable only through the mobile menu.
- **Evidence:** `client/src/components/Navbar.tsx`.
- **Affected:** Mobile navigation.
- **Impact:** Extra taps to reach account and wishlist; lower wishlist use on phones.
- **Recommended solution:** Keep the account icon visible on small screens, or add a labelled account link next to the cart.
- **Files:** `client/src/components/Navbar.tsx`.

### CA-13 — P2 — Mobile checkout and product conversion
- **Description:**
  - Checkout's summary and place-order button come after the whole form on single-column layouts.
  - Product page has no sticky add-to-cart on mobile.
  - Product cards do not show sold-out status.
- **Evidence:** `Checkout.tsx` grid (`lg:grid-cols-[1fr_420px]`, aside after form); `ProductDetail.tsx` (no sticky bar); `ProductCard.tsx` (no stock indicator).
- **Impact:** Mobile shoppers scroll more and abandon more; they tap sold-out items.
- **Recommended solution:** Sticky total and place-order bar on mobile checkout; sticky add-to-cart on mobile product page; sold-out label on cards.
- **Files:** `Checkout.tsx`, `ProductDetail.tsx`, `ProductCard.tsx`.

### CA-14 — P1 — Missing product information (size guide, specs, care)
- **Description:**
  - No size guide.
  - No fabric, fit, weight, or specification fields in the product model or admin form.
  - Generic care text was removed (correct), leaving no care information at all.
  - No product-level delivery estimate.
- **Evidence:** `server/src/models/Product.js` (fields: name, description, price, images, category, gender, sizes, colors, variants); `client/src/pages/admin/ProductForm.tsx` (no spec fields); `ProductDetail.tsx`.
- **Impact:** Apparel shoppers cannot choose size or assess fit, the top reason for apparel abandonment and returns.
- **Recommended solution:** Add optional `specs` (fabric, fit, weight, care) and a size chart reference to the product model and admin form; show on the product page. Business supplies the content (Section 6, items 20–21).
- **Files:** `server/src/models/Product.js`, `server/src/validators/productValidators.js`, `server/src/controllers/productController.js` (serialization), `client/src/types/index.ts`, `client/src/pages/ProductDetail.tsx`, `client/src/pages/admin/ProductForm.tsx`.

### CA-15 — P2 — Product description quality
- **Description:** Product descriptions are one paragraph per product. Demo copy includes specific claims ("flatlock seams", "four-way stretch", "water-resistant") that are not verified for real products.
- **Evidence:** `server/src/seed/catalog.js`.
- **Impact:** Once real products are loaded, leftover demo claims would mislead customers.
- **Recommended solution:** Replace all demo descriptions with verified product text before launch (tied to CA-02).
- **Files:** `server/src/seed/catalog.js` (demo only), admin product form.

### CA-16 — P1 — No social proof at launch
- **Description:** Fabricated testimonials (BUG-03) and fake reviews (BUG-04) were removed. Real reviews are approved but not built. The product page has no reviews section until real reviews exist, and the home page has no testimonials.
- **Evidence:** `client/src/pages/ProductDetail.tsx` (review block only when `reviewCount > 0`); `Home.tsx` (no testimonials); `server/src/models/Review.js` (no status field yet; no create endpoint).
- **Impact:** A new brand has no evidence that others bought and liked its products. Conversion is lower than with real reviews.
- **Recommended solution:** Build the approved reviews feature (verified purchasers, pending until admin approval). Until then, rely on real brand information and honest product detail, not invented quotes.
- **Files:** `server/src/models/Review.js`, new review controller and routes, `ProductDetail.tsx`, admin moderation page.

### CA-17 — P2 — Generic brand and promotional claims
- **Description:** Home "Why choose us" and hero copy contain general claims (for example "Lightweight, breathable fabrics designed for training"; "Premium performance sportswear engineered for every rep"). The announcement bar free-shipping threshold is correct for the configured value.
- **Evidence:** `client/src/data/content.ts` (`whyUs`), `Home.tsx` (Hero text, Promo "Selected gear at a lower price").
- **Impact:** Claims about fabric performance can be challenged if not true for the real range.
- **Recommended solution:** Replace with verified brand claims supplied by the owner.
- **Files:** `client/src/data/content.ts`, `client/src/pages/Home.tsx`.

### CA-18 — P2 — Hard-coded season label
- **Description:** Hero label "New Season / 2026" is hard-coded.
- **Evidence:** `client/src/pages/Home.tsx` (Hero).
- **Impact:** Looks outdated after the year changes.
- **Recommended solution:** Move to a setting or remove the year.
- **Files:** `client/src/pages/Home.tsx`.

### CA-19 — P3 — Promo code visibility depends on configuration
- **Description:** The announcement bar shows the promo code only when `PROMO_CODE` is set; in production it is unset by default. Development defaults to `VORTEX10`.
- **Evidence:** `server/src/config/settings.js` (promo defaults); `AnnouncementBar.tsx`.
- **Impact:** A missing promo in production is intentional but the owner may forget to set one; a development code leaking into production would be a real problem.
- **Recommended solution:** Owner decides on launch promotions; confirm `PROMO_CODE` in the production configuration. No code change needed.
- **Files:** Settings only.

### CA-20 — P2 — Cart total in drawer
- **Description:** The cart drawer shows subtotal only; shipping and discounts are visible on the full cart page. Shoppers may expect the drawer total to be final.
- **Evidence:** `client/src/components/CartDrawer.tsx` (footer shows subtotal; note "Shipping and coupons are calculated in your cart").
- **Impact:** Moderate friction on the path to checkout.
- **Recommended solution:** Show shipping estimate or "Shipping calculated at checkout" next to subtotal in the drawer.
- **Files:** `client/src/components/CartDrawer.tsx`.

### CA-21 — P3 — Disabled online-payment option
- **Description:** Checkout shows "Online payment — Not available yet" as a disabled radio.
- **Evidence:** `client/src/pages/Checkout.tsx` (Payment section).
- **Impact:** Makes the checkout look unfinished and invites questions.
- **Recommended solution:** Remove the disabled option until online payment exists. No business decision is needed; online payment is out of scope.
- **Files:** `client/src/pages/Checkout.tsx`.

### CA-22 — P2 — Address and phone rules (business information)
- **Description:** City is free text. No postal code or area field. Phone accepts 6 or more digits in any format; no country code guidance.
- **Evidence:** `Checkout.tsx` (city field, PHONE regex); `server/src/validators/orderValidators.js` (phone rule, city length).
- **Impact:** Courier delivery errors; wrong numbers; longer delivery.
- **Recommended solution:** Business supplies address format rules (Section 6, items 26–27). Then add a city or area list, a required country code field if needed, and clearer hint text.
- **Files:** `Checkout.tsx`, `orderValidators.js`, `Order.js` model if fields are added.

### CA-23 — P2 — Order notes
- **Description:** Order notes field (500 characters) has no guidance on what to write, and is shown to the admin without a template.
- **Evidence:** `Checkout.tsx` (notes field, `hint` absent).
- **Impact:** Minor.
- **Recommended solution:** Add a short hint: "Anything the courier should know, such as building or landmark."
- **Files:** `Checkout.tsx`.

### CA-24 — P2 — Per-IP rate limits can affect shared networks
- **Description:** Order submission limit is 30 per hour per IP. Login failure limit is 10 per 15 minutes per IP. API limit is 300 per 15 minutes per IP. Shoppers on the same carrier NAT or office network share these limits.
- **Evidence:** `server/src/middleware/rateLimiter.js`.
- **Impact:** Some legitimate shoppers may be blocked on busy shared networks [ASSUMPTION about network sharing].
- **Recommended solution:** Keep limits, monitor 429 responses after launch, and adjust with real data. Consider per-account limits (SEC-03).
- **Files:** `server/src/middleware/rateLimiter.js`.

### CA-25 — P2 — Help links not in the header
- **Description:** FAQ, Contact, and Returns are in the footer only. The header and mobile menu have no help link.
- **Evidence:** `Navbar.tsx` (LINKS list: shop, men, women, new arrivals, sale only).
- **Impact:** Shoppers who want help before buying must scroll to the bottom of the page.
- **Recommended solution:** Add "Help" to the mobile menu and the account menu. Keep the desktop nav unchanged.
- **Files:** `client/src/components/Navbar.tsx`.

### CA-26 — P3 — Duplicate returns links in footer
- **Description:** "Returns & Refunds" appears in Quick Links, in the legal strip, and in the shipping sentence.
- **Evidence:** `Footer.tsx`.
- **Impact:** Clutter.
- **Recommended solution:** Remove the sentence link once Quick Links has the entry (already present).
- **Files:** `client/src/components/Footer.tsx`.

### CA-27 — P3 — Second product image only on hover
- **Description:** On product cards, the second image is revealed on hover. Touch devices never show it.
- **Evidence:** `client/src/components/ProductCard.tsx`.
- **Impact:** Mobile shoppers see one image only.
- **Recommended solution:** Show the second image on tap or on the product page only.
- **Files:** `ProductCard.tsx`.

### CA-28 — P2 — Hard-coded "$" in shop and filters
- **Description:** Price filter labels and the active filter chip use "$".
- **Evidence:** `Shop.tsx` (chip label), `FilterPanel.tsx` (min/max labels), `ProductForm.tsx` (labels) (BUG-06).
- **Impact:** Mixed currency symbols if the store is configured for another currency.
- **Recommended solution:** Use `currencySymbol` from settings in each label.
- **Files:** `client/src/pages/Shop.tsx`, `client/src/components/FilterPanel.tsx`, `client/src/pages/admin/ProductForm.tsx`.

### CA-29 — P2 — Currency update not reactive
- **Description:** Non-USD currency is applied to formatting only after settings load, and components that do not re-render keep the old currency (BUG-07).
- **Evidence:** `client/src/utils/format.ts`, `hooks/useShopConfig.ts`.
- **Impact:** Brief mismatch on first load in non-USD stores.
- **Recommended solution:** Re-render the app tree when config loads (planned, P2 batch).
- **Files:** `client/src/App.tsx`, `format.ts`.

### CA-30 — P3 — Wishlist truncation above 50 items
- **Description:** Wishlists beyond 50 items lose entries (BUG-10).
- **Evidence:** `client/src/services/api.ts` (`byIds` slices to 50), `client/src/pages/Wishlist.tsx` (`retain`).
- **Impact:** Rare for most shoppers; data loss for heavy users.
- **Recommended solution:** Paginate or chunk `byIds`; only remove IDs confirmed missing.
- **Files:** `services/api.ts`, `pages/Wishlist.tsx`.

### CA-31 — P2 — Wishlist and cart are per browser
- **Description:** Cart, wishlist, and applied coupon are stored in localStorage only. A shopper who signs in on another device starts empty.
- **Evidence:** `CartContext.tsx`, `WishlistContext.tsx`, `useLocalStorage.ts`.
- **Impact:** Lost carts across devices; relevant for mobile-to-desktop shoppers.
- **Recommended solution:** Optional: save cart and wishlist to the account when logged in. Design decision; not urgent.
- **Files:** Contexts and a new account-sync endpoint.

### CA-32 — P3 — Stock message is coarse
- **Description:** Product page shows "In stock" for stock above 3, and an exact count only at 3 or fewer.
- **Evidence:** `ProductDetail.tsx` (`stockLabel`).
- **Impact:** Minor. Some shoppers want a count.
- **Recommended solution:** Keep. Optional: show a count only when stock is low.
- **Files:** `ProductDetail.tsx`.

### CA-33 — P2 — Search and sort race
- **Description:** Search debounce captures params at render time; a sort change within 300 ms may be overwritten (BUG-15).
- **Evidence:** `client/src/pages/Shop.tsx`.
- **Impact:** Unexpected results order; minor frustration.
- **Recommended solution:** Read current params inside the timeout.
- **Files:** `Shop.tsx`.

### CA-34 — P2 — Admin cannot manage coupons or customers in the UI
- **Description:** Coupon and customer APIs exist and are tested in code. No admin screens exist; admin layout has no links to them.
- **Evidence:** `client/src/pages/admin/AdminLayout.tsx` (NAV has Dashboard, Orders, Products, Categories only); `server/src/routes/adminRoutes.js` (coupon and customer routes).
- **Impact:** Owner cannot run promotions or handle customer accounts without API calls.
- **Recommended solution:** Build approved admin screens (Phase 7 plan, items 3–4).
- **Files:** `AdminLayout.tsx`, `App.tsx`, new admin pages.

### CA-35 — P1 — Hidden categories still sell
- **Description:** Hiding a category removes it from the public category list only. Its products remain visible, searchable, and orderable (BUG-08).
- **Evidence:** `server/src/services/productService.js` and `productQuery.js` ignore category status; `pricing.js` checks product `isActive` only.
- **Affected:** Shop, search, product pages, checkout.
- **Reproduce:** Hide a category in admin; search for a product in it; it still appears.
- **Impact:** Owner expects a category to be off sale; customers can still buy it. Risk of selling discontinued or restricted products.
- **Recommended solution:** Approved decision 3: enforce backend exclusion in listings, search, direct access, and quoting.
- **Files:** `server/src/services/productService.js`, `server/src/utils/productQuery.js`, `server/src/controllers/productController.js`, `server/src/services/pricing.js`.

### CA-36 — P2 — No order status emails after confirmation
- **Description:** Only the initial confirmation email exists. No email on processing, shipping, or delivery.
- **Evidence:** `server/src/services/orderService.js` (only `notifyOrderCreated`); `mailer.js` (only order confirmation and contact message).
- **Impact:** Shoppers check the website repeatedly or call support; no delivery expectation set.
- **Recommended solution:** Add status-change emails after the email foundation is verified (CA-04).
- **Files:** `orderService.changeStatus`, `mailer.js`.

### CA-37 — P2 — COD payment not recorded explicitly
- **Description:** On "delivered", `paymentStatus` is set to paid automatically. There is no step to record that cash was received, or to record a refund.
- **Evidence:** `server/src/services/orderService.js` (`changeStatus`: `if (to === 'delivered' && cod) set.paymentStatus = 'paid'`).
- **Impact:** Bookkeeping risk; if the courier fails to collect cash, the system still says paid.
- **Recommended solution:** Add a "cash collected" action separate from delivery, and a refund record.
- **Files:** `orderService.js`, `adminController.js`, `client/src/pages/admin/OrderDetail.tsx`.

### CA-38 — P3 — No order export
- **Description:** No CSV export of orders, customers, or products for fulfilment or accounting.
- **Evidence:** Admin routes (no export endpoint).
- **Impact:** Manual work for the owner.
- **Recommended solution:** Add CSV export of orders with a date filter (optional).
- **Files:** `adminController.js`, `adminRoutes.js`.

### CA-39 — P2 — No analytics or conversion measurement
- **Description:** No analytics or conversion tracking is installed. The owner cannot see where shoppers leave.
- **Evidence:** Client code contains no analytics script (verified by reading `index.html` and all client files read).
- **Impact:** Cannot measure or improve conversion after launch.
- **Recommended solution:** Owner decides on analytics (Section 6, item 17). The privacy policy must match. Do not add without a decision.
- **Files:** `client/index.html` (if chosen), privacy text.

### CA-40 — P2 — No Content-Security-Policy or hosting headers
- **Description:** The client has no CSP. Hosting configuration not yet defined.
- **Evidence:** `client/index.html`.
- **Impact:** Lower defence against injected scripts at deployment.
- **Recommended solution:** Define a CSP at deployment time. Not part of the current code.
- **Files:** Hosting configuration (not present).

### CA-41 — P1 — SEO basics missing
- **Description:** No meta description, Open Graph, favicon, canonical, robots, or sitemap (SEO-01, SEO-02). Client-rendered pages (SEO-03).
- **Evidence:** `client/index.html`; no `client/public/` directory.
- **Impact:** Weak organic search; poor link previews when shared on social media; a competitor with the same products outranks VORTEX.
- **Recommended solution:** Add meta description and Open Graph to `index.html`; add `public/` with favicon, `robots.txt`, `sitemap.xml`; decide on pre-rendering or server rendering for product pages (a larger architectural decision, flagged for owner approval).
- **Files:** `client/index.html`, new `client/public/*`, possibly build configuration.

### CA-42 — P2 — No structured product data
- **Description:** No schema.org `Product` or `Offer` markup on product pages.
- **Evidence:** `ProductDetail.tsx`.
- **Impact:** No rich results in search.
- **Recommended solution:** Add JSON-LD on product pages after SEO-03 is decided.
- **Files:** `ProductDetail.tsx`.

### CA-43 — P2 — Image dimensions and performance
- **Description:** Product images have no explicit width and height; hero loads at 2000px eagerly; all images are external.
- **Evidence:** `Img.tsx`; `Home.tsx` (Hero `loading="eager"`); `images.ts` (`w=2000` for hero).
- **Impact:** Layout shift; slow first paint on mobile; dependency on Unsplash availability [NOT MEASURED].
- **Recommended solution:** Upload product images to the store's own storage; set width and height; use responsive sizes.
- **Files:** `Img.tsx`, `images.ts`, `Home.tsx`, admin upload pipeline.

### CA-44 — P1 — Legal strip contrast
- **Description:** Legal strip uses `text-xs text-neutral-500` on near-black background.
- **Evidence:** `Footer.tsx`.
- **Impact:** Hard to read; the links are the ones customers need before paying.
- **Recommended solution:** Increase contrast (a styling change; owner approval requested per the previous batch).
- **Files:** `Footer.tsx`.

### CA-45 — P2 — Admin product form lacks stock and SEO fields
- **Description:** Product form has no SEO title or description, no specification fields (CA-14), and no product duplication.
- **Evidence:** `ProductForm.tsx`.
- **Impact:** Owner work per product; weaker product pages.
- **Recommended solution:** Add optional SEO fields and specs (CA-14).
- **Files:** `ProductForm.tsx`, `Product.js`.

### CA-46 — P3 — Reveal animation
- **Description:** Sections fade in on scroll; content below the fold is invisible until scrolled (opacity-0).
- **Evidence:** `Reveal.tsx`.
- **Impact:** Minor; affects print and crawlers.
- **Recommended solution:** Keep for visual identity; ensure important content is not hidden from crawlers after SEO-03 decision.
- **Files:** `Reveal.tsx`.

### CA-47 — P3 — Admin link on desktop
- **Description:** Desktop header has no direct admin link; admins reach it through Account or the mobile menu (BUG-17).
- **Evidence:** `Navbar.tsx`.
- **Impact:** Admin workflow friction only.
- **Recommended solution:** Add an admin link for admin users.
- **Files:** `Navbar.tsx`.

### CA-48 — P2 — Login page has no help text
- **Description:** Login has no link to registration help, password recovery (CA-05), or support.
- **Evidence:** `Login.tsx`.
- **Impact:** Lost customers.
- **Recommended solution:** Add "Forgot password?" once CA-05 exists; add a contact link now.
- **Files:** `Login.tsx`.

### CA-49 — P3 — Duplicate or stale copy in checkout
- **Description:** "The courier will call this number" and "We confirm your order…" describe a process not verified in the business (CA-03).
- **Evidence:** `Checkout.tsx`, `OrderConfirmation.tsx`.
- **Impact:** Promise the business may not keep.
- **Recommended solution:** Confirm with the owner, then keep or remove.
- **Files:** `Checkout.tsx`, `OrderConfirmation.tsx`.

### CA-50 — P2 — Guest cancellation with order number and email
- **Description:** Anyone with an order number and the email can cancel a pending or confirmed order without logging in (SEC-09).
- **Evidence:** `orderController.cancelLookup`; `TrackOrder.tsx` (cancel dialog).
- **Impact:** A malicious person with the details could cancel someone else's order. Limited by the rate limit and the order states allowed.
- **Recommended solution:** Owner decides. Options: keep (convenient for guests), or require a confirmation code by email (depends on CA-04).
- **Files:** `orderController.js`, `orderRoutes.js`, `TrackOrder.tsx`.

### CA-51 — P3 — Demo product data in production risk
- **Description:** `npm run seed` wipes the catalogue on each run in development (BUG-28). Accidental run on a live database would delete products; production requires `--force`.
- **Evidence:** `server/src/seed/seed.js`.
- **Impact:** Operational risk only.
- **Recommended solution:** Keep the production guard; add a note in the README (planned).
- **Files:** `seed.js`, README (to be created).

### CA-52 — P3 — No README or operations documentation
- **Description:** No README for setup, deployment, or operations.
- **Evidence:** Project root listing.
- **Impact:** Owner depends on the handoff notes.
- **Recommended solution:** Create README (planned, P4).
- **Files:** New `README.md`.

---

## Section 8 — Final Action Plan

Ordered by business impact, not coding convenience.

### Phase 1 — Critical purchase blockers
1. **Done (CA-01):** owner-run results recorded; no failures on either run. Real-load concurrency remains unverified and requires a separate decision.
2. Business supplies the items in Section 6 marked for launch (identity, contact, policies, currency, tax, delivery, returns). Confirm currency and tax treatment (CA-07, CA-08).
3. Configure SMTP for the owner's environment and verify a real order confirmation email arrives. Add the on-screen fallback message (CA-04).
4. Replace stock imagery and demo catalogue with real products (CA-02, CA-15).
5. Fix label association in `Field` and checkout (CA-06).
6. Add an error boundary (CA-11).

### Phase 2 — Trust and credibility
7. Publish final Returns, Privacy, and Terms pages with qualified legal review (CA-03).
8. Add policy links beside the checkout place-order button (CA-03).
9. Remove the disabled online-payment option (CA-21).
10. Hide or label generic brand claims until verified (CA-17).
11. Fix the hard-coded season label (CA-18).
12. Replace "$" and fix currency reactivity (CA-28, CA-29).
13. Stop registration enumeration (CA-09).

### Phase 3 — UX and conversion improvements
14. Size guide and product specifications (CA-14).
15. Mobile checkout total and place-order sticky bar (CA-13).
16. Mobile product page sticky add-to-cart (CA-13).
17. Sold-out state on cards (CA-13).
18. Show second image on tap (CA-27).
19. Drawer total or shipping estimate (CA-20).
20. Header and account access on small screens; help links in menus (CA-12, CA-25).
21. Address and phone guidance (CA-22, CA-23).
22. Forgot password link and reset flow (CA-05, CA-48).

### Phase 4 — Missing business features
23. Real reviews with verified purchasers and admin moderation (CA-16).
24. Admin coupon and customer screens (CA-34).
25. Hidden category enforcement (CA-35).
26. Stock race fix on admin edits (BE-03, BUG-09).
27. Order status emails (CA-36).
28. COD cash-collected and refund records (CA-37).
29. Order export (CA-38).
30. Session revocation design and implementation (SEC-02).
31. Per-account login limiter (SEC-03).

### Phase 5 — Performance, SEO, and polish
32. Own-hosted product images with dimensions and responsive sizes (CA-43).
33. SEO basics: meta description, Open Graph, favicon, robots, sitemap (CA-41).
34. Decide on rendering strategy for product pages (CA-41, CA-42).
35. Product structured data (CA-42).
36. Legal strip contrast (CA-44).
37. Desktop admin link, toast timers, and other low-priority fixes (CA-47, FE-06, FE-07).

### Phase 6 — Final testing and launch readiness
38. Database test suite on standalone and replica-set MongoDB: completed by the owner (CA-01, section 9.2). Real-load concurrency remains unverified and requires a separate decision.
39. Browser walkthrough: guest and account checkout, coupons, cart edits, sold-out items, mobile widths, all footer and header links, every policy page.
40. Dependency audit (`npm audit`), with upgrade plan.
41. Accessibility check with keyboard and screen reader on checkout and product pages.
42. Owner review of all policy text and business information.
43. Real test order placed by the owner on a staging copy only, then cancelled, with stock and coupon checks.

---

## Section 9 — Audit Coverage: what was inspected, what was not

### 9.1 Inspected (source code, this session and earlier sessions)
- Client: every page, every shared component, all contexts and hooks, services, types, utilities, data files, Vite, Tailwind, TypeScript, and `index.html`.
- Server: every route, controller, service, model, middleware, validator, utility, seed script, and configuration module.
- Tests: all 22 test files and the helper module (read, not executed by Claude).
- Documentation: `VORTEX_PROGRESS.md` and `PHASE7_HANDOFF.md`.

### 9.2 Verified by executed test (owner, Windows)
- Backend, standalone MongoDB 8.2.7 (CA-01, owner-run): 348 tests, 345 passed, 0 failed, 3 skipped (replica-set-only).
- Backend, replica set rs0 MongoDB 8.2.7 (CA-01, owner-run): 348 tests, 348 passed, 0 failed, 0 skipped.
- Earlier run without MONGO_TEST_URI (owner-reported): 87 passed, 0 failed, 18 database-dependent groups skipped. Superseded by the CA-01 results above.
- Frontend (historical, owner-reported): TypeScript check and production build passed after the first Session 3 client edits. Client edits made after that are not covered. See the progress file, section 21.

### 9.3 Could not be inspected or verified
- **Browser behaviour:** no browser was available. Nothing was clicked, scrolled, or visually compared.
- **Mobile layouts:** not viewed at any width. Statements about mobile are source-based.
- **Visual quality:** colour contrast values were read from code, not measured.
- **Live performance:** no timings, no network traces, no Lighthouse run.
- **Email delivery:** no SMTP connection was tested. Confirmation and contact email behaviour is from code only.
- **Database behaviour:** verified by the owner's Windows run (CA-01) for the test suite on standalone and replica set. Concurrency under real load, live data, and production behaviour were not tested.
- **Payments:** none exist; not applicable.
- **Third-party services:** Unsplash image availability not checked (the `check:images` script was not run).
- **Admin visual flows:** not interacted with.
- **Accessibility:** no screen reader or keyboard run.
- **Legal content:** not reviewed by a lawyer; no legal claims are made in this report.
- **Browser console errors:** not observed.
- **Dependency vulnerabilities:** `npm audit` not run.

---

## Section 10 — Confirmed Bugs vs Recommendations vs Assumptions

- **Confirmed bugs (from code):** FE-01 (no error boundary), FE-02 / CA-06 (label association), BE-01 / CA-09 (enumeration), BE-02 / SEC-02 (logout), BE-03 / BUG-09 / BUG-21 (stock races), CA-35 / BUG-08 (hidden categories), CA-28 / BUG-06 (currency labels), CA-29 / BUG-07 (non-reactive currency), CA-30 / BUG-10 (wishlist truncation), CA-33 / BUG-15 (search race), SEO-01 and SEO-02 (metadata and public files missing), CA-36 (no status emails), CA-37 (COD paid automatically).
- **Recommendations:** all Phase 2–5 items that are design or content choices.
- **Assumptions:** CA-24 and BE-07 (shared-network throttling), SEO-03 (crawler behaviour), CA-20 (shopper expectation), CA-04 (shopper fear of missing confirmation), CA-13 (mobile scroll behaviour), CA-39 (value of analytics).

---

## Section 11 — Readiness Summary

- **Ready for real customers:** No.
- **Ready for real orders:** No.
- **Most urgent problems (open):** CA-02, CA-03, CA-04, CA-07. CA-01 is verified for the test suite (see 1.3); real-load concurrency remains unverified and is outside the completed CA-01 test-suite verification.
- **Phase to implement first:** the remaining Phase 1 items: business information (CA-03), SMTP confirmation (CA-04), real product content (CA-02), and the currency and tax decisions (CA-07, CA-08).
