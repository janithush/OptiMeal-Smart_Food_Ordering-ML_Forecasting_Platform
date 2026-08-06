---
stepsCompleted: [step-01-validate-prerequisites, step-02-design-epics]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-canteen_system-2026-08-03/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-canteen_system-2026-08-03/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/architecture/architecture-canteen_system-2026-08-03/SOLUTION-DESIGN.md
---

# CaféSmart - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for CaféSmart (Smart University Canteen System), decomposing the requirements from the PRD and Architecture documents into implementable stories organized by user value.

## Requirements Inventory

### Functional Requirements

FR-1: University SSO login via Google OAuth restricted to fot.ruh.ac.lk domain. Non-matching emails rejected with clear error.
FR-2: Role-based route protection — /student/* for STUDENT role, /admin/* for ADMIN role. Unauthenticated requests redirect to /login.
FR-3: First-time Student profile onboarding — display name, department (ICT/ET/BST), Dietary Preference (Vegan/Vegetarian/Non-Veg). Required before menu access.
FR-4: Menu display — all active items for today with name, price, dietary badge, availability status (Available/Selling Fast/Sold Out).
FR-5: Dietary filter — defaults to Student saved preference; filters menu instantly; persists within session.
FR-6: Item detail view — description, ingredients, dietary classification, slot availability with remaining capacity per slot.
FR-7: Pre-order placement — add items to cart, select Pickup Slot, confirm before 9 AM cutoff. Payment deducted from wallet at confirmation.
FR-8: Pickup slot capacity management — configurable max per slot (default 30). Full slots not selectable. Remaining capacity shown at checkout.
FR-9: QR Pickup Pass — unique QR code per confirmed order. Displayed on confirmation screen and Order History. Valid only on service date.
FR-10: Order ready notification — push notification 5 min before Pickup Slot if In Preparation; second notification on Ready for Pickup.
FR-11: Walk-In Order mode — after 9 AM cutoff, best-effort fulfilment. No slot. Does not earn Canteen Coins.
FR-12: Canteen Wallet balance display — current balance on Wallet screen and persistent header indicator.
FR-13: Wallet top-up via PayHere — minimum LKR 100. Redirect to PayHere hosted checkout. Credit on successful webhook. Failed payments leave balance unchanged.
FR-14: Transaction history — chronological list of all wallet debits/credits with date, type, amount, running balance.
FR-15: Canteen Coins earning — 1 Coin per LKR 100 top-up; 2 Coins per LKR 100 Pre-Order spend. Walk-ins earn 0.
FR-16: Canteen Coins redemption — min 10, max 100 Coins per order at LKR 1/Coin. Deducted immediately on confirmation.
FR-17: Coins balance and expiry display — batch list with expiry dates (90 days). Auto-expire at midnight. 7-day expiry notification.
FR-18: Student spend analytics — weekly/monthly totals, avg daily spend, top 3 items, Pre-Order vs Walk-In count, 7-day bar chart.
FR-19: Quick Reorder (My Usual) — 3 most frequent combos in last 14 days. One-tap reorder pre-fills cart with Pickup Slot prompt.
FR-20: Meal recommendations — up to 3 personalised items on home screen. Based on Dietary Preference + order history + collaborative filtering. No Sold Out items.
FR-21: Group Order — organiser creates group, shares 6-char code with up to 5 friends (authenticated Students). All add items. Organiser checks out from own wallet. One Pickup Slot for all.
FR-22: Admin live sales dashboard — real-time (WebSocket): total orders, Pre-Order/Walk-In split, revenue, units sold per item, hourly chart, slot queue depth.
FR-23: Admin order queue management — view pending Pre-Orders by slot, mark In Preparation then Ready for Pickup, confirm QR scan collection.
FR-24: Admin menu management — CRUD for menu items (name, description, price, dietary type, ingredients, image). Daily Specials with temporary price override.
FR-25: Smart Discount Trigger — alert when item sold < 30% of Cook Plan target by 12:30 PM. Admin sends Flash Deal push notification with discount % and expiry.
FR-26: Admin inventory management — daily opening/closing stock entry per ingredient. View current stock vs forecasted need for next day.
FR-27: Procurement Alert and PDF Purchase Order — alert when stock < 1 day forecasted need. One-click PDF purchase order download.
FR-28: Staff planning flags — High Traffic flag on days where ML forecast > 20% above 7-day rolling average. Configurable threshold.
FR-29: Nightly forecast generation — Forecast Engine runs at 18:00 daily. Per-item predicted qty, low/high estimates, confidence score. Fallback to previous actuals on failure.
FR-30: Cook Plan generation and confirmation — auto-generated post-9 AM cutoff combining ML forecast + pre-order counts. Admin adjusts and confirms. Lock by 10 AM with override flow.
FR-31: Wastage Heatmap — 7-day rolling ingredient waste rate. Colour-coded Red/Amber/Green. Tap cell for raw data.
FR-32: Student demand segment insights — pre-order breakdown by department and Dietary Preference, aggregated last 30 days. No individual data exposed.

### NonFunctional Requirements

NFR-1: Page LCP <= 2.5 seconds on 4G mobile connection.
NFR-2: Order confirmation (cart to confirmed) completes end-to-end <= 3 seconds.
NFR-3: Admin live dashboard WebSocket updates arrive within 3 seconds of triggering event.
NFR-4: ML Forecast Engine completes a forecast run in <= 5 minutes.
NFR-5: All API routes enforce JWT authentication and role claims server-side. No client-side-only access control.
NFR-6: PayHere webhook endpoint validates HMAC-MD5 signature. Unverified webhooks rejected with HTTP 400.
NFR-7: Canteen Wallet balance modified only by verified server-side transactions. No client-submitted balance mutations accepted.
NFR-8: Student personal data never exposed through Admin analytics. Segment analytics use aggregated, anonymised data only.
NFR-9: If Forecast Engine fails nightly run, Admin receives alert and previous day actuals used as fallback Cook Plan starting point.
NFR-10: PayHere payment failures do not leave wallet in inconsistent state. Idempotency keys used on all wallet credit operations.
NFR-11: Application usable on mobile viewports (375px+) and desktop (1280px+) without horizontal scrolling.
NFR-12: Interactive elements meet WCAG 2.1 AA minimum contrast ratios and have visible focus states.

### Additional Requirements

- Project stack: Next.js 14+ (App Router, TypeScript), PostgreSQL 16 (Prisma ORM), Python 3.11 + FastAPI (ML microservice), Socket.io, NextAuth.js (Google OAuth), PayHere, Tailwind CSS, Framer Motion, Recharts, Cloudinary.
- Deployment: Railway.app for both Next.js and Python services. Custom Next.js server required for Socket.io persistence.
- AD-1: RSC-first — all pages default to Server Components; Client Components only for interactivity/WebSocket.
- AD-2: All DB access via Prisma ORM. Migrations required for every schema change. No db.push in production.
- AD-3: Wallet mutations server-only + idempotency-keyed. Balance derived from append-only WalletTransaction log.
- AD-4: NextAuth.js JWT sessions. Domain restriction enforced in signIn callback. Middleware + server-side session check on every Route Handler.
- AD-5: FastAPI ML service accessible only via ML_SERVICE_URL env var from Next.js server. No public exposure.
- AD-6: Socket.io with /admin and /student namespaces. JWT validated in handshake middleware.
- AD-7: PayHere HMAC-MD5 webhook validation. Idempotency key = PayHere order_id.
- AD-8: Nightly forecast cron at 18:00. Idempotent — second run on same date overwrites SUGGESTED records only, never CONFIRMED Cook Plans.
- AD-9: CookPlanItem lifecycle: SUGGESTED → CONFIRMED → SUPERSEDED. Edit after 10 AM requires explicit override flag.
- AD-10: CoinBatch records with expiresAt. getCoinsBalance() server function — never computed inline.
- AD-11: One writer per entity. MenuItems: Admin only. Orders: Student creates, Admin updates status. WalletTransactions: wallet service functions only.
- Bootstrap: Seed PostgreSQL from provided CSV files (sales_logs.csv, inventory_records.csv, queue_times.csv, student_demographics.csv) for ML model training data.
- Environment variables: DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ML_SERVICE_URL, PAYHERE_MERCHANT_ID, PAYHERE_MERCHANT_SECRET, CLOUDINARY_URL.

### UX Design Requirements

No UX Design document exists yet. UX implementation is guided by PRD §11 Information Architecture and the following design principles from brainstorming:
UX-DR1: Mobile-first responsive design — all views optimised for 375px+ mobile, fluid to 1280px desktop.
UX-DR2: Premium visual design — dark mode aesthetic with vibrant accent colours, glassmorphism cards, and smooth micro-animations. Explicitly use **shadcn/ui** for the core component architecture, alongside **Framer Motion**, **Aceternity UI**, and **Magic UI** for high-end micro-animations and premium UI elements.
UX-DR3: Dietary badge system — consistent visual badges (V, VG, NV) on all menu items throughout the app.
UX-DR4: Real-time feedback — all status changes (order placed, order ready, wallet credited) must have immediate visual feedback within 2 seconds.
UX-DR5: Student 7-screen navigation: Home, Order, My Orders, Wallet, Rewards, Analytics, Profile.
UX-DR6: Admin 7-screen navigation: Dashboard, Orders, Cook Plan, Menu, Inventory, Analytics, Settings.
UX-DR7: QR code must be large and scannable on mobile screens — minimum 200x200px rendered.

### FR Coverage Map


FR-1: Epic 2 - Google OAuth SSO, domain restriction
FR-2: Epic 2 - RBAC route protection, middleware
FR-3: Epic 2 - Student profile onboarding flow
FR-4: Epic 3 - Menu display with dietary badges + availability
FR-5: Epic 3 - Dietary filter — defaults to saved preference
FR-6: Epic 3 - Item detail view with slot capacities
FR-7: Epic 3 - Pre-order placement before 9 AM cutoff
FR-8: Epic 3 - Pickup slot capacity enforcement (max 30)
FR-9: Epic 3 - QR Pickup Pass generation + display
FR-10: Epic 3 - Order ready push notification
FR-11: Epic 3 - Walk-in order mode after cutoff
FR-12: Epic 4 - Wallet balance display (header + screen)
FR-13: Epic 4 - PayHere top-up + HMAC webhook credit
FR-14: Epic 4 - Wallet transaction history
FR-15: Epic 4 - Canteen Coins earning rules
FR-16: Epic 4 - Coins redemption at checkout
FR-17: Epic 4 - Coins expiry display + auto-expire cron
FR-18: Epic 5 - Student spend analytics dashboard
FR-19: Epic 5 - Quick Reorder — My Usual
FR-20: Epic 5 - Collaborative filtering recommendations
FR-21: Epic 5 - Group Order with 6-char share code
FR-22: Epic 6 - Live Admin sales dashboard (WebSocket)
FR-23: Epic 6 - Order queue management + QR scan collection
FR-24: Epic 6 - Menu management CRUD + daily specials
FR-25: Epic 6 - Smart Discount Trigger + Flash Deal push
FR-26: Epic 7 - Inventory stock entry + forecasted need view
FR-27: Epic 7 - Procurement alert + PDF purchase order
FR-28: Epic 7 - Staff planning High Traffic flags
FR-29: Epic 7 - Nightly ML forecast generation + fallback
FR-30: Epic 7 - Cook Plan generation + Admin confirmation
FR-31: Epic 7 - Wastage Heatmap (7-day rolling, Red/Amber/Green)
FR-32: Epic 7 - Demand segment insights (dept + dietary)


## Epic List


### Epic 1: Project Foundation & Platform Setup
Students and Admins can access a working, deployed application skeleton with a seeded database and functional CI-ready dev environment.
**FRs covered:** None (Pure enablement, ADs, Stack Setup)

### Epic 2: Authentication, Onboarding & Role Access
Students and Admins can securely log in with their university Google account, complete their profile, and be directed to role-appropriate views with all routes protected.
**FRs covered:** FR-1, FR-2, FR-3

### Epic 3: Menu Browsing & Pre-Order System
Students can browse today's filtered menu, place pre-orders in pickup time slots before the 9 AM cutoff, receive a QR pickup pass, track their order status with push notifications, and use walk-in mode after cutoff.
**FRs covered:** FR-4, FR-5, FR-6, FR-7, FR-8, FR-9, FR-10, FR-11

### Epic 4: Canteen Wallet, PayHere Payments & Canteen Coins
Students can top up their in-app wallet via PayHere, track all transactions, earn Canteen Coins on spend and top-ups, redeem Coins at checkout for discounts, and view expiring coin batches — creating a closed-loop loyalty flywheel.
**FRs covered:** FR-12, FR-13, FR-14, FR-15, FR-16, FR-17

### Epic 5: Student Personalisation & Social Ordering
Students see personalised meal recommendations on the home screen, quickly reorder their usual combinations, view their spend analytics dashboard, and coordinate group orders with friends — making CaféSmart feel like a personal canteen companion.
**FRs covered:** FR-18, FR-19, FR-20, FR-21

### Epic 6: Admin Operations Dashboard & Menu Management
Admins can see live sales KPIs updating in real time via WebSocket, manage the order queue from pre-order to QR-scan collection, create and edit menu items with daily specials, and trigger smart flash deal notifications to clear surplus — giving canteen managers full operational control.
**FRs covered:** FR-22, FR-23, FR-24, FR-25

### Epic 7: ML Demand Forecasting, Cook Plan & Waste Intelligence
Admins receive nightly ML-generated demand forecasts, confirm and adjust cook plans with a 10% buffer, view 7-day wastage heatmaps per ingredient, get procurement alerts with one-click PDF purchase orders, see staff planning flags for high-traffic days, and access demand segment breakdowns by department and dietary preference — closing the canteen's intelligent operations loop.
**FRs covered:** FR-26, FR-27, FR-28, FR-29, FR-30, FR-31, FR-32


## Epic 1: Project Foundation & Platform Setup

Students and Admins can access a working, deployed application skeleton with a seeded database and functional CI-ready dev environment.

### Story 1.1: Next.js 14 App Router & Socket.io Foundation

As a Developer,
I want to initialize the Next.js 14 App Router project with a custom Node.js server,
So that the application can serve RSC pages and maintain persistent Socket.io WebSocket connections.

**Acceptance Criteria:**

**Given** the repository is empty
**When** the project is initialized
**Then** a Next.js 14 App Router with TypeScript is running
**And** it runs via a custom server.ts file that exposes a Socket.io instance on the same port
**And** the /admin and /student WebSocket namespaces are configured

### Story 1.2: Database Schema & Prisma ORM Setup

As a Developer,
I want to configure PostgreSQL and create the Prisma schema,
So that all 14 database models and 10 enums from the Solution Design are ready for application code.

**Acceptance Criteria:**

**Given** a local PostgreSQL instance is running
**When** 
px prisma db push (dev) or 
px prisma migrate dev is executed
**Then** all 14 models (User, WalletAccount, MenuItem, Order, CookPlanItem, etc.) are successfully created
**And** the Prisma Client is generated and exported as a singleton in lib/prisma.ts

### Story 1.3: Premium UI Component Architecture Setup

As a UI Developer,
I want to install and configure shadcn/ui, Tailwind CSS, Framer Motion, Aceternity UI, and Magic UI,
So that all premium frontend micro-animations, glassmorphism tokens, and core components are ready for consumption.

**Acceptance Criteria:**

**Given** the Next.js project is running
**When** UI components are built
**Then** shadcn/ui is configured with a dark mode base theme and vibrant accent colors
**And** Tailwind is configured with custom design tokens for glassmorphism utilities
**And** Framer Motion, Aceternity UI, and Magic UI dependencies are installed and confirmed working via a test page (/ui-test)

### Story 1.4: Python ML Microservice Setup

As an ML Engineer,
I want to initialize the Python FastAPI microservice,
So that the Next.js backend has a dedicated internal service to call for ML inference.

**Acceptance Criteria:**

**Given** the Next.js app is running
**When** the FastAPI service is booted on port 8000
**Then** it exposes a GET /health endpoint that returns 200 OK
**And** the Next.js app can successfully fetch from ML_SERVICE_URL/health via a server-side route handler

### Story 1.5: Seed Historical Data (CSV Bootstrap)

As a Data Engineer,
I want a bootstrap script to ingest the 4 provided HackTrail CSV datasets into PostgreSQL,
So that the ML models have historical data (sales, inventory, queue times, demographics) to train on before the system goes live.

**Acceptance Criteria:**

**Given** the Prisma database schema is empty
**When** the bootstrap script 
pm run db:seed is executed
**Then** it parses the 4 CSV files in the docs/ folder
**And** successfully populates the InventoryRecord, OrderItem, and User tables with historical records without crashing on foreign key constraints
## Epic 2: Authentication, Onboarding & Role Access

Students and Admins can securely log in with their Google account (any domain), complete their enriched profile (registration number, batch, department, dietary preference, allergies), and be directed to role-appropriate views with all routes protected.
**FRs covered:** FR-1, FR-2, FR-3

### Story 2.1: Google OAuth SSO & Profile Capture

As a User,
I want to log in using my Google account,
So that I can securely access the system without creating a new password, and have my profile picture, name, and email automatically saved.

**Acceptance Criteria:**

**Given** I attempt to sign in via Google OAuth with any valid Google account
**When** I complete the Google sign-in flow
**Then** my JWT session is created and my User record is created/fetched with a default STUDENT role (if new)
**And** my Google profile picture, name, and email are captured and stored in the database
**And** my `role` claim is embedded directly into the JWT token
**And** returning users have their name and profile picture refreshed from Google on each sign-in
**And** a login page is displayed at `/login` with a "Sign in with Google" button

### Story 2.2: Role-Based Route Protection (RBAC) Middleware

As an Admin,
I want to ensure Students cannot access Admin routes and vice-versa,
So that sensitive operational data and controls remain secure.

**Acceptance Criteria:**

**Given** I am authenticated with the STUDENT role
**When** I attempt to navigate to /admin/dashboard or hit an /api/admin/* endpoint
**Then** I am rejected with an HTTP 403 Forbidden error
**And** unauthenticated users attempting to access any protected route are redirected to /login
**And** API routes explicitly re-verify the server-side session to prevent bypassing middleware

### Story 2.3: Student Profile Onboarding & Profile Page

As a First-Time Student,
I want to complete my full profile (registration number, batch, department, dietary preference, allergies) and have a dedicated Profile page to manage my details,
So that the menu, recommendations, and allergen warnings are tailored to me.

**Acceptance Criteria:**

**Given** I have successfully authenticated but my onboardingDone flag is false
**When** I attempt to access any protected student route (like /student/home)
**Then** I am redirected to the /student/onboarding page
**And** the onboarding form collects: Student Registration Number (text), Batch/Academic Year (text, e.g., "2023/2024"), Department (ICT/ET/BST dropdown), Dietary Preference (Vegan/Vegetarian/Non-Veg dropdown), Food Allergies (multi-select: Nuts, Dairy, Gluten, Shellfish, Eggs, Soy, None), Phone Number (optional)
**And** my Google profile picture and name are pre-filled and editable
**And** after completing all required fields, the onboardingDone flag is set to true and I am redirected to /student/home
**And** I have access to a /student/profile page where I can view and edit all my profile fields at any time
**And** updating my dietary preference immediately affects menu filtering; updating my allergies triggers allergen warnings on relevant menu items

## Epic 3: Menu Browsing & Pre-Order System

Students can browse today's filtered menu, place pre-orders in pickup time slots before the 9 AM cutoff, receive a QR pickup pass, track their order status with push notifications, and use walk-in mode after cutoff.

### Story 3.1: Menu Display & Dietary Filtering

As a Student,
I want to view today's active menu and filter it by my dietary preference,
So that I can quickly find food that I want to eat without seeing irrelevant items.

**Acceptance Criteria:**

**Given** I am on the Student Home page
**When** the menu loads
**Then** I see all active items for today with their price, availability status, and consistent visual dietary badges
**And** the list is automatically filtered by my saved Dietary Preference by default
**And** I can toggle the filter to see all items if desired

### Story 3.2: Item Detail & Slot Availability

As a Student,
I want to see the details of a menu item and its pickup slot availability,
So that I know if I can still order it for my preferred lunch time.

**Acceptance Criteria:**

**Given** I tap on a menu item
**When** the item detail view opens (in a bottom sheet/drawer on mobile)
**Then** I see its description, full ingredients, and dietary classification
**And** I see a list of Pickup Slots (e.g., 12:00-12:15 PM) with the remaining capacity (out of 30) for each slot displayed

### Story 3.3: Pre-Order Cart & Checkout

As a Student,
I want to add items to my cart, select an available pickup slot, and confirm my pre-order before 9 AM,
So that my meal is secured and prepared for me on time.

**Acceptance Criteria:**

**Given** it is before the 9 AM cutoff
**When** I add items to my cart and proceed to checkout
**Then** I am forced to select a Pickup Slot that has remaining capacity
**And** upon confirmation, the total amount is checked against my wallet balance (mocked for this story)
**And** the order is saved as a PRE_ORDER with status PENDING

### Story 3.4: QR Pickup Pass Generation

As a Student,
I want a QR code for my confirmed order,
So that I can quickly scan and collect my meal without waiting in a manual queue.

**Acceptance Criteria:**

**Given** I have a confirmed order for today
**When** I view the Order Confirmation screen or my Active Orders tab
**Then** a scannable QR Code (minimum 200x200px) is rendered containing the Order ID
**And** this QR code is only valid/displayed on the service date of the order

### Story 3.5: Order Status & Push Notifications

As a Student,
I want to receive push notifications when my order is in preparation and ready,
So that I know exactly when to walk to the canteen.

**Acceptance Criteria:**

**Given** I have a pending pre-order
**When** the Admin updates the status to IN_PREPARATION (5 mins before my slot) or READY_FOR_PICKUP
**Then** my UI updates immediately with real-time feedback via Socket.io
**And** I receive a simulated web push notification alerting me of the status change

### Story 3.6: Walk-In Order Mode

As a Student,
I want to place an order after the 9 AM cutoff,
So that I can still get food even if I forgot to pre-order (understanding I might wait longer).

**Acceptance Criteria:**

**Given** it is after the 9 AM cutoff
**When** I attempt to place an order
**Then** the "Pickup Slot" selection is disabled/hidden
**And** the order is saved as a WALK_IN order type with status PENDING
**And** the UI clearly indicates that Walk-In orders do not earn Canteen Coins

## Epic 4: Canteen Wallet, PayHere Payments & Canteen Coins

Students can top up their in-app wallet via PayHere, track all transactions, earn Canteen Coins on spend and top-ups, redeem Coins at checkout for discounts, and view expiring coin batches � creating a closed-loop loyalty flywheel.

### Story 4.1: Wallet Balance & Transaction History

As a Student,
I want to view my current wallet balance and a chronological list of all my transactions,
So that I can keep track of my spending and top-ups.

**Acceptance Criteria:**

**Given** I am logged in
**When** I view the Wallet screen or the persistent header
**Then** my current balance is displayed accurately (derived from the append-only WalletTransaction log)
**And** I can see a list of my transactions showing date, type (TOP_UP, ORDER_PAYMENT, REFUND), amount, and running balance

### Story 4.2: PayHere Top-Up & HMAC Webhook Integration

As a Student,
I want to top up my wallet balance using the PayHere payment gateway,
So that I have funds available to place pre-orders.

**Acceptance Criteria:**

**Given** I initiate a top-up of at least LKR 100
**When** I complete the payment on the hosted PayHere checkout page
**Then** PayHere sends a server-to-server webhook to the application
**And** the Next.js API validates the HMAC-MD5 signature before processing
**And** an idempotency key (the PayHere order_id) ensures the wallet is never double-credited for the same transaction

### Story 4.3: Secure Wallet Checkout Integration

As a System,
I want to securely deduct funds from the user's wallet during checkout,
So that no client-submitted balance mutations are accepted and race conditions are prevented.

**Acceptance Criteria:**

**Given** a Student confirms a pre-order in the cart
**When** the checkout server action runs
**Then** the mutation occurs strictly on the server
**And** if the balance is insufficient, the transaction rolls back and returns an error
**And** if successful, the exact order amount is deducted as an ORDER_PAYMENT transaction type

### Story 4.4: Canteen Coins Earning & Expiry Logic

As a Student,
I want to automatically earn Canteen Coins on top-ups and pre-orders, and see when they expire,
So that I am rewarded for my loyalty and incentivised to order ahead.

**Acceptance Criteria:**

**Given** I complete a Top-Up or a Pre-Order
**When** the transaction is finalised
**Then** I earn 1 Coin per LKR 100 on Top-Ups, and 2 Coins per LKR 100 on Pre-Orders
**And** Walk-in orders yield 0 Coins
**And** the Coins are saved as a CoinBatch with an expiresAt date set 90 days in the future
**And** the Rewards screen displays my expiring batches and warns me if any expire within 7 days

### Story 4.5: Canteen Coins Redemption at Checkout

As a Student,
I want to apply my valid Canteen Coins at checkout for a discount,
So that I can save money on my meals.

**Acceptance Criteria:**

**Given** I have a valid Canteen Coins balance
**When** I am on the checkout screen
**Then** I can choose to apply between 10 and 100 Coins to the order (at LKR 1 per Coin)
**And** upon confirmation, the discount is applied, the wallet is debited the remaining amount, and the Coins are deducted using a strict FIFO (First-In, First-Out) logic to drain the oldest batches first

## Epic 5: Student Personalisation & Social Ordering

Students see personalised meal recommendations on the home screen, quickly reorder their usual combinations, view their spend analytics dashboard, and coordinate group orders with friends � making Caf�Smart feel like a personal canteen companion.

### Story 5.1: Student Spend Analytics Dashboard

As a Student,
I want to view my weekly and monthly spending totals and top items,
So that I can manage my canteen budget effectively.

**Acceptance Criteria:**

**Given** I navigate to the Analytics screen
**When** the dashboard loads
**Then** I see a 7-day bar chart (using Recharts) showing my daily spend
**And** I see my top 3 most frequently ordered items
**And** I see my Pre-Order vs Walk-In ratio count

### Story 5.2: Quick Reorder (My Usual)

As a Student,
I want to see my 3 most frequent combinations and reorder them with one tap,
So that I don't have to manually build my cart every day.

**Acceptance Criteria:**

**Given** I have ordered the same combination of items multiple times in the last 14 days
**When** I view the Home screen
**Then** I see a "My Usual" section with these combinations
**And** tapping "Reorder" instantly populates my cart with those items and prompts me to select a Pickup Slot

### Story 5.3: Meal Recommendations (Collaborative Filtering Integration)

As a Student,
I want to see up to 3 personalised item recommendations on the home screen,
So that I can discover new meals I might like based on my preferences and history.

**Acceptance Criteria:**

**Given** the ML Microservice has generated recommendations for my User ID
**When** I view the Home screen
**Then** I see a "Recommended for You" section with up to 3 items
**And** these items strictly adhere to my saved Dietary Preference
**And** items marked as Sold Out are automatically filtered out from recommendations

### Story 5.4: Social Group Ordering

As a Group Organiser,
I want to create a group order and share a 6-character code with my friends,
So that we can all add items to a single order and pick them up together at one time slot.

**Acceptance Criteria:**

**Given** I start a Group Order
**When** I share the generated 6-character code
**Then** up to 5 authenticated Students can join and add items to the shared cart
**And** only I (the Organiser) can select the Pickup Slot and checkout using my Wallet balance
**And** once confirmed, a single QR code is generated for the entire Group Order

## Epic 6: Admin Operations Dashboard & Menu Management

Admins can see live sales KPIs updating in real time via WebSocket, manage the order queue from pre-order to QR-scan collection, create and edit menu items with daily specials, and trigger smart flash deal notifications to clear surplus � giving canteen managers full operational control.

### Story 6.1: Admin Live Sales Dashboard (WebSocket)

As an Admin,
I want a real-time dashboard showing total orders, revenue, and queue depth,
So that I can monitor canteen operations as they happen without manually refreshing the page.

**Acceptance Criteria:**

**Given** I am logged in as an Admin on the Dashboard screen
**When** a student places an order or top-up
**Then** the dashboard KPIs (Total Orders, Revenue, Pre-Order/Walk-In Split) update instantly via the /admin Socket.io namespace
**And** I see a live hourly sales chart and current pickup slot queue depth
**And** student personal data is completely anonymised in these metrics

### Story 6.2: Order Queue Management & QR Scanning

As an Admin,
I want to view pending pre-orders by slot, update their status, and confirm collection via QR scan,
So that I can efficiently manage the kitchen workflow and ensure accurate handoffs.

**Acceptance Criteria:**

**Given** I am on the Admin Orders screen
**When** I view the current Pickup Slot
**Then** I see all pending orders and can tap to change their status to IN_PREPARATION or READY_FOR_PICKUP
**And** I can use the device camera (or a manual input field fallback) to scan a student's QR Pass
**And** a successful scan instantly marks the order as COMPLETED and updates the student's UI via WebSocket

### Story 6.3: Menu Management (CRUD) & Daily Specials

As an Admin,
I want to create, read, update, and delete menu items and set daily specials,
So that I can control what is offered to students each day.

**Acceptance Criteria:**

**Given** I am on the Admin Menu Management screen
**When** I create or edit a menu item
**Then** I can upload an image (saved to Cloudinary), set the name, price, dietary type, and ingredients
**And** I can configure a "Daily Special" override that temporarily changes the price of an item for the current day only
**And** changes instantly reflect on the Student Menu

### Story 6.4: Smart Discount Trigger & Flash Deals

As an Admin,
I want to be alerted when an item is selling below its target by 12:30 PM and trigger a Flash Deal,
So that I can clear surplus inventory and reduce waste.

**Acceptance Criteria:**

**Given** it is 12:30 PM and an item's sales are < 30% of its Cook Plan target
**When** I view the Dashboard
**Then** I see a "Smart Discount Trigger" alert for that item
**And** I can tap it to send a "Flash Deal" push notification to all students with a temporary % discount and expiry time (e.g., valid until 1:30 PM)


## Epic 7: ML Demand Forecasting, Cook Plan & Waste Intelligence

Admins receive nightly ML-generated demand forecasts, confirm and adjust cook plans with a 10% buffer, view 7-day wastage heatmaps per ingredient, get procurement alerts with one-click PDF purchase orders, see staff planning flags for high-traffic days, and access demand segment breakdowns by department and dietary preference — closing the canteen's intelligent operations loop.

### Story 7.1: Inventory Stock Entry & Forecasting View

As an Admin,
I want to log daily opening and closing stock for ingredients and view it against forecasted needs,
So that I know exactly what supplies are available and what is running low.

**Acceptance Criteria:**

**Given** I navigate to the Inventory screen
**When** I view the current stock list
**Then** I can input the physical opening/closing stock amounts for each ingredient (e.g., Rice, Chicken)
**And** I see a "Forecasted Need" column that calculates how much of each ingredient is required based on the ML demand forecast

### Story 7.2: Procurement Alerts & PDF Purchase Orders

As an Admin,
I want to receive an alert when stock drops below 1 day of forecasted need and generate a PDF PO,
So that I can quickly reorder supplies before they run out.

**Acceptance Criteria:**

**Given** an ingredient's current stock falls below tomorrow's forecasted need
**When** I view the Dashboard or Inventory screen
**Then** a prominent Procurement Alert is displayed
**And** I can click "Generate PO", which instantly creates and downloads a formatted PDF Purchase Order (using @react-pdf/renderer) pre-filled with the required quantities

### Story 7.3: Nightly ML Forecast Engine, Semester-Aware Predictions & Staff Planning

As a System,
I want to trigger the ML Forecast Engine nightly at 18:00 to predict next-day demand — factoring in the academic calendar — so that drastic attendance drops during exams or study leave are handled automatically without manual Admin intervention.

**Acceptance Criteria:**

**Given** it is 18:00 (triggered via nightly cron or manual trigger from Admin settings)
**When** the forecast job runs
**Then** the Next.js server calls the FastAPI /forecast endpoint to generate per-item predictions for all active menu items
**And** the model uses a semester_period feature (enum: REGULAR_LECTURES, PRE_EXAM_WEEK, STUDY_LEAVE, EXAM_PERIOD) derived from an Admin-configurable academic calendar table, producing significantly lower demand estimates for STUDY_LEAVE and EXAM_PERIOD periods automatically
**And** if the forecast run completes within 5 minutes (NFR-4), predictions are saved to the DemandForecast table with a confidence score
**And** if the forecast exceeds the 7-day rolling average by more than 20%, a "High Traffic" flag is persisted and displayed in the Staff Planning section
**And** if the FastAPI service is unreachable or returns an error (NFR-9), an admin alert is triggered and the system gracefully falls back to the previous day's actual sales as the Cook Plan baseline

### Story 7.4: Cook Plan Generation with Human-in-the-Loop Override

As an Admin,
I want a suggested Cook Plan that combines the ML forecast and confirmed pre-order counts, which I can manually adjust to account for unpredictable real-world events before locking it for the kitchen,
So that Human-in-the-Loop control ensures the ML system never operates blindly when a sudden strike, campus event, or early exam departure changes ground reality.

**Acceptance Criteria:**

**Given** the 9 AM pre-order cutoff has passed
**When** I view the Cook Plan screen
**Then** I see a SUGGESTED plan for each menu item: ML predicted quantity + exact Pre-Order count + 10% buffer, displayed side-by-side for transparency
**And** each quantity field is fully editable before confirmation, acting as the Human-in-the-Loop override for events the model cannot predict (e.g., sudden campus strikes, weather events, early departures during exams)
**And** upon clicking "Confirm Cook Plan", the plan status transitions to CONFIRMED and is locked for the kitchen
**And** any edits made after 10 AM force the plan into a SUPERSEDED state, presenting an explicit "Override Required" confirmation dialog before saving (AD-9 lifecycle enforcement)
**And** the Confirmed Cook Plan triggers updated Procurement Alerts and Inventory Forecasted Need columns

### Story 7.5: Wastage Heatmap & Demand Segment Insights

As an Admin,
I want to view a 7-day rolling ingredient wastage heatmap and demand breakdowns by department and dietary preference,
So that I can analyze trends and continuously optimize canteen operations.

**Acceptance Criteria:**

**Given** I navigate to the Admin Analytics screen
**When** the data loads
**Then** I see a color-coded (Red/Amber/Green) 7-day rolling Wastage Heatmap for each ingredient
**And** I see breakdown charts showing demand by Department (ICT/ET/BST) and Dietary Preference — strictly aggregated and anonymised (NFR-8)
**And** I can tap any cell in the heatmap to view the raw opening stock, closing stock, and calculated waste figures for that day and ingredient

### Story 7.6: Automated Weekly Model Retraining Pipeline

As a System,
I want the ML models to automatically retrain every week using the latest accumulated order data,
So that the system continuously learns from real canteen behaviour and improves forecast accuracy over time without manual ML engineer intervention.

**Acceptance Criteria:**

**Given** it is the weekly retraining schedule (every Sunday at 02:00 AM, configurable via cron)
**When** the retraining job is triggered (also available via a manual POST /train endpoint in FastAPI for Admin use)
**Then** the FastAPI service queries the PostgreSQL database for all OrderItem and DemandForecast records accumulated since the last training run
**And** per-item scikit-learn Linear Regression models are retrained using the updated dataset (including the semester_period feature)
**And** the new model .pkl files overwrite the previous versions atomically (old files are preserved as a timestamped backup in case rollback is needed)
**And** a training completion log entry (timestamp, rows used, per-item MAE metric) is written to the database and surfaced in the Admin Analytics screen under an "ML Model Health" panel
**And** if the retrained model's MAE is significantly worse than the prior version (threshold: greater than 20% degradation), the system automatically rolls back to the previous .pkl and alerts the Admin
