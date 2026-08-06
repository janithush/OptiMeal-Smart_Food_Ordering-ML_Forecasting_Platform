---
title: Smart University Canteen System — CaféSmart
status: draft
created: 2026-08-03
updated: 2026-08-03
project: canteen_system
author: JanithX
---

# PRD: CaféSmart — Smart University Canteen System

## 0. Document Purpose

This PRD defines the requirements for **CaféSmart**, a technology-driven web application for the Faculty of Technology (FoT), University of Ruhuna canteen, authored for the **HackTrail hackathon challenge**. It serves as the authoritative requirements reference for downstream UX design, system architecture, and sprint planning.

Vocabulary is Glossary-anchored. Features are grouped with globally numbered Functional Requirements (FR-1 through FR-N). Assumptions are tagged inline as `[ASSUMPTION: ...]` and indexed in §9. The PRD builds on the HackTrail problem brief, four operational datasets, and the approved brainstorming convergence document.

---

## 1. Vision

The Faculty of Technology canteen serves hundreds of students daily yet operates with critical inefficiencies: queues reaching 20 minutes during the 90-minute peak lunch window, ingredient wastage up to 5 kg per item per day, and demand swinging 3–4× for the same menu item day-to-day. These represent lost student time, wasted university resources, and a fundamentally broken campus experience.

**CaféSmart** transforms the canteen from a reactive, queue-driven food service into a **closed-loop intelligent ordering platform**. Students pre-order meals in time-slotted pickup windows through a mobile-first web app, earning loyalty rewards and receiving personalised recommendations. Every pre-order becomes a demand signal. The embedded ML engine converts those signals into a daily cook plan delivered to the kitchen by 6 PM the night before — eliminating guesswork and cutting wastage at the source. The Admin dashboard gives managers live operational visibility: real-time sales, inventory alerts, procurement suggestions, and a smart discounting trigger to clear surplus before it spoils.

The result: **students never wait, kitchens never guess, nothing goes to waste.** Better pre-order adoption → better forecasts → less waste → lower costs → higher adoption. CaféSmart is a flywheel, not a feature set.

---

## 2. Target Users

### 2.1 Jobs To Be Done

**Student**
- Get a hot, correct meal during a 30-minute break without spending half of it in a queue.
- Eat food matching my dietary preference (Vegan / Vegetarian / Non-Vegetarian) without asking or guessing.
- Know exactly when my food will be ready before I walk to the canteen.
- Feel rewarded for being a regular — not treated the same as a walk-in.
- Track how much I spend each week so I can budget.

**Canteen Admin / Manager**
- Know by 6 PM what to prepare tomorrow — down to quantity per item.
- Never be caught with 3 kg of surplus Chicken because demand dropped unexpectedly.
- Act on surplus before it becomes waste — push a discount while there is still time to sell.
- See in real time which items are selling and which are stalling — no end-of-day reports needed.
- Generate a procurement request without manually calculating ingredient needs.

### 2.2 Non-Users (v1)

- **Suppliers / vendors** — procurement alerts generate a PDF only; no supplier-facing interface.
- **Academic staff / lecturers** — [ASSUMPTION: students only; staff is a v2 consideration.]
- **Multiple canteens** — single-canteen scope.

### 2.3 Key User Journeys

**UJ-1. Kavya pre-orders lunch before her 8 AM lecture.**
- **Persona + context:** Kavya, ICT second-year, Vegetarian, 30-minute lunch at 12:30. Previously waited 18 minutes.
- **Entry state:** Authenticated via university SSO. Opens Student Home showing today's menu.
- **Path:** Taps "Order Now" → filters to Vegetarian → selects Fried Rice + Tea → picks 12:30–12:45 slot → reviews cart (wallet: LKR 1,200) → taps "Confirm & Pay."
- **Climax:** Confirmation: "Order #0142 — Counter 2 from 12:30." Push notification at 12:28: "Your order is ready."
- **Resolution:** Kavya walks straight to Counter 2, scans QR Pickup Pass, collects meal. Zero queue time.
- **Edge case:** If 12:30 slot is full, she sees 12:45 before confirming. Slots less than 30 minutes away are not bookable.

**UJ-2. Dineth tops up his wallet and earns his first Canteen Coins.**
- **Persona + context:** Dineth, ET third-year, Non-Vegetarian. Always paid cash. Friend told him about Canteen Coins.
- **Entry state:** Authenticated. Wallet balance: LKR 0.
- **Path:** Taps Wallet → Top Up → LKR 2,000 → PayHere checkout → payment complete → returns.
- **Climax:** Wallet shows LKR 2,000. Notification: "20 Canteen Coins added for your top-up!"
- **Resolution:** Dineth is now in the pre-order ecosystem earning Coins on every spend.

**UJ-3. Malsha checks her weekly spend and applies a Canteen Coins discount.**
- **Persona + context:** Malsha, BST first-year, Vegan, budget-conscious. Spends ~LKR 900/day.
- **Entry state:** Authenticated. Navigates to "My Analytics."
- **Path:** Sees this week's spend: LKR 4,320. Favourite item: Juice (8 orders). Has 85 Coins. Taps "Redeem" → applies 50 Coins for LKR 50 discount → places order.
- **Climax:** Order total: LKR 270 (was LKR 320). Coins balance: 35.
- **Resolution:** Malsha feels rewarded. The discount loop keeps her ordering through the app.

**UJ-4. Admin Saman generates tomorrow's cook plan at 6 PM.**
- **Persona + context:** Saman, canteen manager. Currently uses paper lists. Historically over-orders Chicken.
- **Entry state:** Authenticated as Admin. Dashboard shows today's live sales.
- **Path:** Opens "Cook Plan" → reviews ML forecast (Rice & Curry: 112, Kottu: 87) → adjusts Kottu to 95 (club event tomorrow) → confirms Cook Plan.
- **Climax:** Cook plan locked. Checks Procurement Alert: "Chicken: 6 kg stock, need 18 kg." Taps "Generate Purchase Order" → PDF downloaded.
- **Resolution:** Kitchen has a clear plan. Supplier order is ready to send.

**UJ-5. Admin Priya triggers a flash discount to clear surplus at 12:30 PM.**
- **Persona + context:** Priya, assistant manager. 12:30 PM — Short Eats: 22 of 80 sold. Expire today.
- **Entry state:** Authenticated as Admin. Dashboard: Short Eats at 27% of target.
- **Path:** System shows Smart Discount suggestion → Priya taps "Send Discount Alert" → confirms "Short Eats 20% off until 1 PM."
- **Climax:** Push notification sent to all Students who haven't ordered Short Eats today.
- **Resolution:** 58 portions sold by 1 PM. Waste cut from 58 to 22 units.

---

## 3. Glossary

- **Student** — Authenticated user (`STUDENT` role). Can browse, order, manage wallet, and view personal analytics. Default role for all new Google OAuth sign-ins.
- **Admin** — Authenticated user (`ADMIN` role). Manages menu, operations, forecasts, and procurement. Manually promoted in database — no self-registration path.
- **Pre-Order** — A confirmed meal order placed before the 9:00 AM daily cutoff, specifying items and a Pickup Slot.
- **Pickup Slot** — A 15-minute window (11:30–13:15) during which a Student collects their pre-ordered meal.
- **Walk-In Order** — An order placed after the 9:00 AM cutoff, fulfilled best-effort from remaining inventory. Does not earn Canteen Coins.
- **Canteen Wallet** — In-app digital balance (LKR) per Student. Funded via PayHere. Used exclusively for CaféSmart payments.
- **Canteen Coins** — In-app loyalty currency. Earned on top-ups and Pre-Order spend. Redeemable as in-app discounts. Non-transferable. Expire in 90 days.
- **ML Demand Forecast** — Nightly system-generated per-item portion prediction for the next operating day.
- **Cook Plan** — Admin-confirmed kitchen preparation schedule, derived from ML Demand Forecast + pre-order counts. Locked by 10:00 AM on service day.
- **Forecast Engine** — Python/FastAPI ML microservice producing the ML Demand Forecast nightly.
- **Smart Discount Trigger** — Automated Admin alert when a menu item's sales fall below 30% of Cook Plan target by 12:30 PM.
- **Wastage Heatmap** — Admin visualisation showing 7-day rolling ingredient waste rates.
- **QR Pickup Pass** — Unique per-order QR code for counter collection. Valid only on the order's service date.
- **Dietary Preference** — Persistent Student profile attribute: `VEGAN`, `VEGETARIAN`, or `NON_VEGETARIAN`.
- **Food Allergies** — Multi-select Student profile attribute: Nuts, Dairy, Gluten, Shellfish, Eggs, Soy, None. Used for allergen warnings on menu items.
- **Student Registration Number** — Unique university-issued identifier (e.g., `2023/ICT/001`). Stored on User profile.
- **Batch / Academic Year** — Student's cohort (e.g., `2023/2024`). Powers cohort-level analytics and ML recommendations.
- **Profile Picture** — Google OAuth profile photo captured on sign-in; user can upload a custom image from the Profile page.
- **Flash Deal** — Admin-initiated time-limited discount on a surplus item, delivered as a push notification.
- **Procurement Alert** — Admin notification when forecasted ingredient need exceeds current stock. Generates a PDF Purchase Order.


## 4. Features

### 4.1 Authentication & Role-Based Access Control

**Description:** CaféSmart uses Google OAuth for authentication via NextAuth.js. Any valid Google account can sign in — there is no email domain restriction. New authenticated users receive the `STUDENT` role automatically. Their Google profile picture, name, and email are captured and stored in the database on first sign-in. Admin accounts are pre-provisioned by manually promoting a User's role in the database — no self-registration path. JWT tokens carry role claims enforced by Next.js middleware on all API routes.

**Profile Fields Captured:**

On first sign-in, the system stores:
- **Google Profile Picture** (`image`) — automatically captured from `profile.picture`
- **Display Name** (`name`) — from Google profile
- **Email** (`email`) — Google account email

Students can later edit and enrich their profile from the Profile page with:
- Custom profile picture upload
- **Student Registration Number** (`regNo`) — e.g., `2023/ICT/001`
- **Batch / Academic Year** (`batch`) — e.g., `2023/2024`
- **Department** (`department`) — ICT, ET, BST
- **Dietary Preference** (`dietaryPreference`) — Vegan, Vegetarian, Non-Vegetarian
- **Food Allergies** (`allergies`) — Multi-select: Nuts, Dairy, Gluten, Shellfish, Eggs, Soy, None
- **Phone Number** (`phone`) — Contact for order notifications

**Functional Requirements:**

#### FR-1: Google OAuth SSO
A Student or Admin can authenticate using any valid Google account via OAuth. On first sign-in, the system captures and stores the user's Google profile picture, name, and email. Returning users' profile data is updated from Google on each sign-in.

**Consequences (testable):**
- Any valid Google account can create a session.
- New users have their Google profile picture, name, and email stored in the database.
- Returning users' name and profile picture are refreshed from Google on sign-in.

#### FR-2: Role-Based Route Protection
All `/student/*` routes are accessible only to `student` role users. All `/admin/*` routes only to `admin` role users. Unauthenticated requests redirect to `/login`.

**Consequences (testable):**
- A Student navigating to `/admin/dashboard` receives HTTP 403.
- An unauthenticated request to any protected route redirects to `/login`.

#### FR-3: Student Profile & Onboarding
First-time Students must complete their profile before accessing the menu. Required fields: display name (pre-filled from Google), Student Registration Number, Batch/Academic Year, Department (ICT / ET / BST), Dietary Preference (Vegan / Vegetarian / Non-Veg), and Food Allergies (multi-select). Optional: phone number, profile picture (pre-filled from Google, replaceable). All fields are editable from the Profile page after onboarding.

**Profile Page Features:**
- View and edit all personal details
- Upload/replace profile picture
- Update Department, Dietary Preference, Allergies (menu recommendations update immediately)
- View Google account link status

**Consequences (testable):**
- A new Student bypassing onboarding cannot reach the menu.
- Updating Dietary Preference immediately filters the menu on next load.
- Allergen-tagged menu items show warnings for students with matching allergies.

---

### 4.2 Menu Browsing & Dietary Filtering

**Description:** The Student home screen displays today's active menu with dietary badges (`V` Vegan, `VG` Vegetarian, `NV` Non-Veg) and availability indicators. A persistent dietary filter defaults to the Student's saved Dietary Preference. Realizes UJ-1.

**Functional Requirements:**

#### FR-4: Menu Display
Students view all active menu items for today: name, price (LKR), dietary badge, and availability status (`Available` / `Selling Fast` / `Sold Out`).

**Consequences (testable):**
- Items at zero capacity display `Sold Out` and cannot be added to cart.
- Menu reflects only Admin-published items for that day.

#### FR-5: Dietary Filter
Students filter the menu by Dietary Preference. Filter defaults to the Student's saved preference on every visit and persists within the session.

**Consequences (testable):**
- Selecting `Vegan` hides all non-vegan items immediately.
- Filter state survives navigation within the same session.

#### FR-6: Item Detail View
Students view item description, ingredients list, dietary classification, and today's pickup slot availability with remaining capacity per slot.

**Consequences (testable):**
- Item detail shows remaining capacity per slot.
- Ingredients are populated from Admin-managed item data.

---

### 4.3 Pre-Order & Pickup Slot System

**Description:** Students place Pre-Orders before the 9:00 AM daily cutoff, selecting items and a 15-minute Pickup Slot. After cutoff, Walk-In mode activates. Each Pre-Order generates a QR Pickup Pass. Realizes UJ-1.

**Functional Requirements:**

#### FR-7: Pre-Order Placement
A Student adds items to cart, selects a Pickup Slot (11:30, 11:45, 12:00, 12:15, 12:30, 12:45, 13:00, 13:15), and confirms before 9:00 AM. Payment deducts from the Canteen Wallet at confirmation.

**Consequences (testable):**
- Order attempt after 9:00 AM returns: "Pre-order window closed. Walk-in mode is active."
- Insufficient wallet balance blocks confirmation with a top-up prompt.
- Confirmed order deducts the exact item total from the wallet immediately.

#### FR-8: Pickup Slot Capacity Management
Each Pickup Slot has a configurable maximum (default: 30 orders). Full slots are not selectable. Remaining capacity shown at item detail and checkout.

**Consequences (testable):**
- A full slot (30/30) does not appear as a selectable option.
- Slot capacity decrements by 1 immediately on order confirmation.

#### FR-9: QR Pickup Pass
A unique QR code is generated per confirmed order, displayed on the confirmation screen and in Order History. Valid only on the service date.

**Consequences (testable):**
- QR code returns the correct order ID when scanned.
- A QR code from a past date returns "Expired."

#### FR-10: Order Ready Notification
Students receive a push notification 5 minutes before their Pickup Slot if their order is In Preparation, and a second notification when status changes to "Ready for Pickup."

**Consequences (testable):**
- Notification fires within 30 seconds of Admin marking the order as Ready.
- First notification is sent at `[slot_start] - 5 minutes` if not yet Ready.

#### FR-11: Walk-In Order Mode
After the 9:00 AM cutoff, Students place Walk-In Orders (no slot, best-effort fulfilment). Walk-In Orders do not earn Canteen Coins. [ASSUMPTION: Walk-In Orders are lower priority than Pre-Orders for kitchen fulfilment.]

**Consequences (testable):**
- Walk-In Orders are flagged with a `Walk-In` badge in the Admin queue.
- Walk-In confirmation shows "Estimated wait: ~15 min" with no Pickup Slot.

---

### 4.4 Canteen Wallet & PayHere Integration

**Description:** Each Student holds a Canteen Wallet (LKR). Students top up via PayHere. All order payments draw from the wallet. No direct card payment at checkout — wallet-first design prevents no-shows and protects ML training data integrity. Realizes UJ-2.

**Functional Requirements:**

#### FR-12: Wallet Balance Display
Students view their Canteen Wallet balance from the Wallet screen and as a persistent indicator in the app header. Balance is never negative.

**Consequences (testable):**
- Header balance updates within 2 seconds of a completed top-up.
- Balance is never displayed as negative.

#### FR-13: Wallet Top-Up via PayHere
Students initiate a top-up (minimum LKR 100), are redirected to PayHere checkout, and have their balance credited immediately on successful payment. Failed or cancelled payments leave balance unchanged.

**Consequences (testable):**
- Successful PayHere webhook increments balance by the exact paid amount.
- PayHere failure webhook does not credit the wallet.
- Top-up below LKR 100 is blocked at the UI with a validation message.

#### FR-14: Transaction History
Students view a chronological list of wallet transactions: top-ups (with PayHere reference), order deductions (with order ID), and Coins redemptions (with Coins used).

**Consequences (testable):**
- Every debit and credit appears in history within 5 seconds.
- Each entry shows: date, type, amount, and running balance.

---

### 4.5 Canteen Coins Loyalty System

**Description:** Canteen Coins are earned on wallet top-ups and Pre-Order spend. Redeemable as in-app discounts only. Non-transferable, non-cashable, 90-day expiry. Closed-loop design drives repeat pre-order behaviour. Realizes UJ-3.

**Functional Requirements:**

#### FR-15: Coins Earning Rules
- Wallet top-up: 1 Coin per LKR 100 topped up (rounded down).
- Pre-Order spend: 2 Coins per LKR 100 spent (rounded down).
- Walk-In Orders earn 0 Coins.

**Consequences (testable):**
- LKR 500 top-up awards exactly 5 Coins.
- LKR 350 Pre-Order awards exactly 7 Coins.
- LKR 400 Walk-In Order awards 0 Coins.

#### FR-16: Coins Redemption
At checkout, Students with ≥ 10 Coins can redeem at LKR 1 per Coin (min 10, max 100 Coins per order). Redeemed Coins are deducted immediately on confirmation.

**Consequences (testable):**
- Redeeming 50 Coins reduces the order total by LKR 50.
- A Student with 8 Coins cannot trigger redemption.
- Coins balance updates immediately after redemption.

#### FR-17: Coins Balance & Expiry Display
Students view their Coins balance, earn/redeem breakdown, and expiry dates of Coin batches (90 days from earn date). Expired Coins are auto-removed at midnight. Students receive a notification 7 days before a batch expires.

**Consequences (testable):**
- Expired Coins are removed automatically at midnight.
- Expiry notification is sent exactly 7 days before batch expiry.

---

### 4.6 Student Analytics & Personalisation

**Description:** Students view personal spending patterns, use quick-reorder, receive personalised recommendations, and create group orders. Realizes UJ-3.

**Functional Requirements:**

#### FR-18: Spend Analytics Dashboard
Students view: total spend this week and month (LKR), average daily spend, top 3 most ordered items, Pre-Order vs. Walk-In counts, and a 7-day rolling spend bar chart.

**Consequences (testable):**
- Spend data refreshes within 5 minutes of a new order.
- Chart correctly reflects all orders including Coins-discounted totals.

#### FR-19: Quick Reorder ("My Usual")
Students view their 3 most frequently ordered item combinations in the last 14 days and reorder any with a single tap, pre-populating the cart and prompting for a Pickup Slot.

**Consequences (testable):**
- "My Usual" section appears after ≥ 3 orders placed.
- Tapping a "My Usual" item pre-fills the cart correctly.

#### FR-20: Meal Recommendations
Students see up to 3 recommended menu items on the home screen, based on Dietary Preference, 14-day order history, and collaborative filtering across same-department, same-dietary-preference Students. Sold Out items excluded.

**Consequences (testable):**
- Recommendations never include items outside the Student's Dietary Preference.
- Sold Out items never appear in recommendations.

#### FR-21: Group Order
A Student creates a Group Order, shares a 6-character code with up to 5 friends (authenticated Students), allows each to add items, then checks out from their own wallet. One Pickup Slot for the whole group. Organiser's wallet is charged the full total. [ASSUMPTION: Participants must be authenticated Students.]

**Consequences (testable):**
- Group Order link expires after 30 minutes of inactivity.
- Organiser sees each participant's selections before confirming.
- More than 5 participants cannot join the same Group Order.

---

### 4.7 Admin Operations Dashboard

**Description:** Real-time operational interface for Admins: live sales visibility, order queue management, menu and inventory control, kitchen coordination. All data updates via WebSocket — no page refresh needed. Realizes UJ-4 and UJ-5.

**Functional Requirements:**

#### FR-22: Live Sales Dashboard
Admins view in real time: total orders today (Pre-Order vs. Walk-In split), revenue today (LKR), units sold per item, hourly order rate chart (last 6 hours), and current Pickup Slot queue depth.

**Consequences (testable):**
- Dashboard figures update within 3 seconds of a new confirmed order.
- Hourly chart renders correctly for the current day from 11:30 AM.

#### FR-23: Order Queue Management
Admins view all pending Pre-Orders by Pickup Slot, mark orders as "In Preparation" then "Ready for Pickup," and see QR scan confirmation when a Student collects.

**Consequences (testable):**
- Status change to "Ready for Pickup" triggers FR-10 Student notification within 30 seconds.
- QR scan at collection changes order status to "Collected" with a timestamp.

#### FR-24: Menu Management
Admins create, edit, deactivate, and delete menu items. Each item includes: name, description, base price (LKR), dietary classification, associated ingredients, and an image. Daily Specials (temporary price override) are active for the current day only.

**Consequences (testable):**
- A deactivated item is immediately hidden from the Student menu.
- A Daily Special price overrides base price in Student cart and payment.

#### FR-25: Smart Discount Trigger
When a menu item's units sold falls below 30% of its Cook Plan target by 12:30 PM, an alert appears in the Admin dashboard. Admins can send a Flash Deal push notification to Students who haven't ordered that item today, specifying discount % and expiry time.

**Consequences (testable):**
- Alert appears within 5 minutes of crossing the 30% threshold at 12:30 PM.
- Flash Deal notification sent only to Students who have not ordered that item today.
- Flash Deal discount auto-removes at the specified expiry time.

#### FR-26: Inventory Management
Admins record daily opening stock levels per ingredient and log end-of-day levels. View current stock vs. forecasted ingredient need for the next day. [ASSUMPTION: Ingredient-to-menu-item recipe ratios are manually configured by Admin.]

**Consequences (testable):**
- Forecasted ingredient need = ML Demand Forecast × configured recipe ratios.
- Stock entries are date-stamped and cannot be backdated more than 1 day.

#### FR-27: Procurement Alert & Purchase Order Generation
When current ingredient stock is projected insufficient for tomorrow's Cook Plan (coverage < 1 day's forecasted need), a Procurement Alert is generated. Admins generate a PDF Purchase Order listing ingredient, required quantity, and date.

**Consequences (testable):**
- Procurement Alert appears within 30 minutes of stock falling below the threshold.
- PDF correctly lists all flagged ingredients with quantities.

#### FR-28: Staff Planning Flags
The Admin dashboard highlights days in the next 7 days where the ML Demand Forecast predicts total orders > 20% above the 7-day rolling average, flagged as "High Traffic."

**Consequences (testable):**
- High Traffic flags appear on the correct dates in the Admin weekly planning view.
- Threshold is configurable in Admin Settings.

---

### 4.8 ML Demand Forecast Engine

**Description:** A Python/FastAPI microservice running nightly to produce the ML Demand Forecast. Trained on historical sales data, pre-order data, and inventory records. Exposes a REST API consumed by the Next.js backend. v1 uses Linear Regression (interpretable, demo-friendly); architecture supports Random Forest upgrade post-launch. Realizes UJ-4.

**Functional Requirements:**

#### FR-29: Nightly Forecast Generation
The Forecast Engine runs automatically at 6:00 PM daily, producing per-item portion forecasts: predicted quantity, low estimate, high estimate, and confidence score (%).

**Consequences (testable):**
- Forecast available in Admin dashboard by 6:30 PM.
- If the run fails, Admin receives an alert and previous day's actuals are used as fallback.

#### FR-30: Cook Plan Generation & Confirmation
After the 9 AM pre-order cutoff, the system auto-generates a suggested Cook Plan combining the ML Demand Forecast with confirmed pre-order counts. Admins review, adjust quantities, and confirm. Confirmed Cook Plan is locked and shown on the Kitchen Display.

**Consequences (testable):**
- Cook Plan auto-generated within 30 minutes of the 9 AM cutoff.
- Manual Admin adjustments are logged and reflected in the confirmed plan immediately.
- Confirmed Cook Plan cannot be edited after 10:00 AM without an override confirmation.

#### FR-31: Wastage Heatmap
Admins view each ingredient's 7-day rolling waste rate (waste ÷ opening stock × 100), colour-coded Red (>15%), Amber (8–15%), Green (<8%). Tapping a cell shows raw waste and stock figures for that day.

**Consequences (testable):**
- Heatmap correctly reflects the most recent 7 days of logged inventory data.
- Colour bands update automatically as new data is logged.

#### FR-32: Student Demand Segment Insights
Admins view pre-order demand breakdowns by department (ICT / ET / BST) and Dietary Preference, aggregated over the last 30 days. No individual Student data exposed.

**Consequences (testable):**
- Segment charts show correct department and dietary distributions.
- No Student-identifying information (name, email) is visible in any analytics view.

---

## 5. Non-Goals (Explicit)

- **Native iOS / Android apps** — responsive web app only in v1.
- **Supplier-facing portal or API** — PDF Purchase Order only; no live supplier integration.
- **Direct card or cash payment at checkout** — all payments flow through the Canteen Wallet.
- **Multiple canteen support** — single-canteen scope; multi-tenancy is v3.
- **Academic staff / lecturer accounts** — students only in v1. [NON-GOAL for MVP]
- **Ingredient-level allergen management** — no allergen tagging beyond the three dietary preference categories.
- **Real-time kitchen hardware integration** — Cook Plan is displayed on a web page; no dedicated hardware protocol.
- **Coins transfer or cash redemption** — closed-loop in-app discounts only.
- **Automated supplier API ordering** — PDF generated; purchase submitted manually.
- **Historical dataset migration** — provided CSVs used for ML training only; not imported as live operational records.

---

## 6. MVP Scope

### 6.1 In Scope

- University SSO login (Google OAuth, fot.ruh.ac.lk domain restriction)
- Student profile onboarding (department + dietary preference)
- Menu browsing with dietary filter and dietary badges
- Pre-order with time-slot selection (before 9 AM cutoff)
- Walk-in order mode (after cutoff)
- QR Pickup Pass generation and scanning
- Order status tracking and push notifications (order ready alert)
- Canteen Wallet (balance display, PayHere top-up, transaction history)
- Canteen Coins earning and redemption with expiry management
- Student spend analytics dashboard (weekly/monthly)
- Quick Reorder ("My Usual")
- Group Order (up to 5 participants, shared checkout)
- Meal recommendations (collaborative filtering, basic)
- Admin: Live sales dashboard (real-time WebSocket)
- Admin: Order queue management (status updates, QR scan confirmation)
- Admin: Menu management (CRUD + daily specials)
- Admin: Inventory management (daily stock entry)
- Admin: ML Demand Forecast view + Cook Plan generation and confirmation
- Admin: Smart Discount Trigger + Flash Deal push notifications
- Admin: Wastage Heatmap (7-day rolling)
- Admin: Procurement Alert + PDF Purchase Order generation
- Admin: Staff planning flags (7-day High Traffic view)
- Admin: Demand segment insights (dept + dietary breakdown)
- ML Forecast Engine: Linear Regression baseline, nightly automated run
- Browser push + in-app notification service

### 6.2 Out of Scope for MVP

- Random Forest / LSTM forecast model — deferred to v2 after live data accumulates. [NOTE FOR PM: budget upgrade at 60 days post-launch]
- Native mobile apps — v2 if web adoption warrants.
- Supplier-facing portal — v3.
- Staff / lecturer accounts — v2.
- Multi-canteen support — v3.
- Allergen tagging system — v2.
- Automated procurement API to supplier — v3.

---

## 7. Success Metrics

**Primary**

- **SM-1: Queue Time Reduction** — Average Pre-Order customer wait ≤ 5 minutes (baseline: 5–20 min). Measured via order-confirm to QR-scan timestamps. Validates FR-7, FR-9, FR-23.
- **SM-2: Ingredient Wastage Reduction** — Average daily ingredient wastage reduced ≥ 30% within 30 days (baseline: ~2.5 kg/ingredient/day). Measured via Wastage Heatmap. Validates FR-26, FR-29, FR-31.
- **SM-3: Pre-Order Adoption Rate** — ≥ 50% of daily orders are Pre-Orders within 14 days of launch. Validates FR-7, FR-11.

**Secondary**

- **SM-4: Forecast Accuracy** — ML Demand Forecast MAPE ≤ 20% per item per day within 21 days on live data. Validates FR-29.
- **SM-5: Flash Deal Effectiveness** — Flash deals recover ≥ 40% of at-risk surplus units on average. Validates FR-25.
- **SM-6: Coins Redemption Rate** — ≥ 30% of Students redeem Coins at least once within 30 days. Validates FR-16.
- **SM-7: Wallet Top-Up Conversion** — ≥ 60% of newly registered Students top up within 3 days of registration. Validates FR-13.

**Counter-metrics (do not optimise)**

- **SM-C1: Walk-In Suppression** — Walk-In orders must not drop to zero. A healthy ~15% floor ensures the system accommodates spontaneous campus behaviour. Counterbalances SM-3.
- **SM-C2: Forecast Over-Prescription** — Do not optimise Cook Plan precision to zero buffer. A 10% buffer above forecast is intentional. Counterbalances SM-4.

---

## 8. Open Questions

1. **PayHere credentials** — Will the hackathon demo use PayHere sandbox mode? JanithX to provide Merchant ID and Secret during development. [Owner: JanithX]
2. **Google Workspace domain restriction** — Does fot.ruh.ac.lk have a Google Workspace account supporting OAuth domain restriction? If not, a mock SSO flow simulates this. [Owner: JanithX]
3. **Kitchen Display device** — Will there be a physical device for QR scanning during the demo, or will this be simulated via the Admin interface?
4. **Pre-order cutoff time** — Is 9:00 AM the right cutoff, or would 10:00 AM be more operationally realistic?
5. **Slot capacity** — Is 30 orders per 15-minute slot realistic for the canteen's physical throughput?
6. **Web Push support** — Will the demo environment support Web Push (service workers)? Fallback: in-app polling notifications.
7. **Coins expiry** — Is 90-day expiry appropriate, or should it align with semester boundaries?

---

## 9. Assumptions Index

- **A-1 (§1):** The FoT canteen serves primarily ICT, ET, and BST departments.
- **A-2 (§2.2):** Staff / lecturer adoption is a v2 consideration; v1 is students only.
- **A-3 (§4.1):** Google OAuth is configured to restrict to the fot.ruh.ac.lk Google Workspace domain.
- **A-4 (§4.3/FR-11):** Walk-In Orders are lower priority than Pre-Orders for kitchen fulfilment sequencing.
- **A-5 (§4.6/FR-21):** Group Order participants must be authenticated Students with valid accounts.
- **A-6 (§4.7/FR-26):** Ingredient-to-menu-item recipe ratios are manually configured by Admin. No automated recipe inference.
- **A-7 (§4.8):** The provided datasets are used exclusively for ML model training/bootstrapping, not imported as live operational records.
- **A-8 (§4.8):** Linear Regression is the v1 forecast model — interpretable and explainable to hackathon judges.

---

## 10. Cross-Cutting Non-Functional Requirements

### Performance
- **NFR-1:** Page initial load (LCP) ≤ 2.5 seconds on a 4G mobile connection.
- **NFR-2:** Order confirmation (cart → confirmed) completes end-to-end ≤ 3 seconds.
- **NFR-3:** Admin live dashboard WebSocket updates arrive within 3 seconds of the triggering event.
- **NFR-4:** ML Forecast Engine completes a forecast run in ≤ 5 minutes.

### Security
- **NFR-5:** All API routes enforce JWT authentication and role claims server-side. No client-side-only access control.
- **NFR-6:** PayHere webhook endpoint validates HMAC signature on every incoming webhook. Unverified webhooks are rejected with HTTP 400.
- **NFR-7:** Canteen Wallet balance is only modified by verified server-side transactions. No client-submitted balance mutations accepted.
- **NFR-8:** Student personal data is never exposed through Admin analytics. Segment analytics use aggregated, anonymised data only.

### Reliability
- **NFR-9:** If the Forecast Engine fails its nightly run, Admin receives an alert and the previous day's actuals are used as a fallback Cook Plan starting point.
- **NFR-10:** PayHere payment failures do not leave the wallet in an inconsistent state. Idempotency keys are used on all wallet credit operations.

### Accessibility & Responsive Design
- **NFR-11:** Application is usable on mobile viewports (375px+) and desktop (1280px+) without horizontal scrolling.
- **NFR-12:** Interactive elements meet WCAG 2.1 AA minimum contrast ratios and have visible focus states.

---

## 11. Platform & Information Architecture

### Platform
- **Type:** Mobile-first responsive web application
- **Framework:** Next.js 14+ (App Router, SSR)
- **Auth:** NextAuth.js with Google OAuth (fot.ruh.ac.lk domain restriction)
- **ML Service:** Python + FastAPI (separate microservice)
- **Database:** PostgreSQL
- **Real-time:** WebSocket (Socket.io or Pusher)
- **Payments:** PayHere payment gateway
- **Hosting:** [ASSUMPTION: Vercel for Next.js frontend; Railway or Render for Python ML microservice]

### Information Architecture

**Student Navigation:**
1. **Home** — Menu + Recommendations + My Usual
2. **Order** — Cart → Checkout → Confirmation + QR Pass
3. **My Orders** — Order History + QR Pickup Pass viewer
4. **Wallet** — Balance + Top-Up + Transaction History
5. **Rewards** — Canteen Coins balance + Redemption + Expiry tracker
6. **Analytics** — Spend Dashboard (weekly/monthly/items)
7. **Profile** — Dietary Preference + Department + Settings + Logout

**Admin Navigation:**
1. **Dashboard** — Live Sales KPIs + Hourly Chart + Pickup Slot queue
2. **Orders** — Queue Management by Pickup Slot + QR scan confirmation
3. **Cook Plan** — ML Forecast View + Manual Adjustment + Confirmation + Kitchen Display
4. **Menu** — Item CRUD + Daily Specials Management + Image Upload
5. **Inventory** — Daily Stock Entry + Procurement Alerts + Purchase Order PDF
6. **Analytics** — Wastage Heatmap + Demand Segment Insights + Staff Planning Flags
7. **Settings** — Slot Capacity + Discount Thresholds + Recipe Ratios + Admin User Management
