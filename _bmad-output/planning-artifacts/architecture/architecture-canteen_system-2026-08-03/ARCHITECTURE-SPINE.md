---
title: CaféSmart Architecture Spine
status: draft
created: 2026-08-03
updated: 2026-08-03
project: canteen_system
altitude: initiative
---

# ARCHITECTURE SPINE: CaféSmart

## Paradigm

**Server-driven React monolith with an internal ML sidecar.**

Next.js App Router (RSC-first) owns all user-facing surfaces and all business logic via Route Handlers. A separate Python/FastAPI process handles ML inference and is consumed only by the Next.js server layer — never directly by the browser. PostgreSQL is the single source of truth. WebSocket events are pushed from the Next.js server to connected clients for real-time Admin and Student surfaces.

One codebase, two roles (STUDENT / ADMIN), one database, one ML sidecar. The paradigm carries: RSC for data-heavy read paths, client components only where interactivity demands it, and Route Handlers for all mutations.

---

## Architecture Decisions

### AD-1: RSC-First Rendering Strategy
**Binds:** All page components default to React Server Components. Client components (`"use client"`) are introduced only when a component needs browser APIs, event handlers, or client-side state.
**Prevents:** Unnecessary client-side bundle bloat; data-fetching logic leaking into the browser layer.
**Rule:** A component must be a Client Component only if it uses `useState`, `useEffect`, browser APIs, or real-time WebSocket subscriptions. Everything else is a Server Component.
`[ADOPTED]` — Next.js 14 App Router default.

### AD-2: Single Database, Prisma ORM
**Binds:** PostgreSQL is the only datastore. All database access goes through Prisma Client. No raw SQL in business logic (analytics aggregations are the sole exception, via `$queryRaw`).
**Prevents:** Two units building incompatible query patterns; raw SQL scattered across route handlers.
**Rule:** Every schema change requires a Prisma migration file. No `db.push` in production.
`[ADOPTED]`

### AD-3: Wallet Mutation is Server-Only and Idempotency-Keyed
**Binds:** Canteen Wallet balance is mutated exclusively by server-side transaction functions. Every credit operation carries a unique idempotency key (PayHere `payment_id` for top-ups; `order_id` for deductions). Duplicate keys are silently ignored.
**Prevents:** Double-credit from duplicate PayHere webhooks; client-submitted balance overrides.
**Rule:** `WalletTransaction` records are append-only. Balance is `SUM(amount)` over the transaction log — never stored as a mutable scalar on the account record.

### AD-4: Auth is JWT, Roles are Claims, Middleware Enforces
**Binds:** NextAuth.js with Google OAuth. Session strategy: JWT (stateless). The `role` claim (`STUDENT` | `ADMIN`) is embedded in the JWT at sign-in and re-validated on every request by Next.js middleware. Domain restriction (`fot.ruh.ac.lk`) is enforced in the NextAuth `signIn` callback — non-matching accounts are rejected before a session is created.
**Prevents:** A Student reaching an Admin route; a non-university email registering.
**Rule:** Middleware runs on all `/student/*` and `/admin/*` route segments. API Route Handlers additionally re-read the session server-side — middleware alone is not sufficient for API security.
`[ADOPTED]`

### AD-5: ML Service is Internal — Browser Never Calls It Directly
**Binds:** The FastAPI ML microservice listens on an internal port (default 8000). Accessible only from the Next.js server runtime via `ML_SERVICE_URL` environment variable. No CORS headers expose it to external origins.
**Prevents:** Browser clients bypassing business logic; unauthenticated model access.
**Rule:** All ML calls in the Next.js codebase are server-side only (Route Handlers or Server Components). The ML service has no auth middleware — network isolation is the trust boundary.

### AD-6: Real-Time via Socket.io — Two Namespaces
**Binds:** Socket.io runs on the Next.js custom server. Two namespaces: `/admin` (sales events, order queue events, procurement alerts) and `/student` (order status events, flash deal notifications). Rooms: Admin namespace uses a `dashboard` room; Student namespace uses per-`orderId` rooms.
**Prevents:** Students receiving other students' order events; Admin events leaking to Student clients.
**Rule:** Socket.io middleware on both namespaces validates the JWT from the handshake and checks the role claim before allowing connection. Wrong-role or invalid token rejects the socket connection.

### AD-7: PayHere Integration — Webhook-Confirmed Credits Only
**Binds:** Top-up flow: client initiates → Next.js creates pending `WalletTransaction` → client redirects to PayHere hosted checkout → PayHere POSTs webhook to `/api/wallet/webhook` → server validates HMAC-MD5 → server confirms transaction and credits balance.
**Prevents:** Wallet credit without payment confirmation; replay attacks via duplicate webhooks.
**Rule:** HMAC formula: `MD5(merchant_id + order_id + amount + currency + merchant_secret)`. Webhook failing validation returns HTTP 400 and is logged. Idempotency key = PayHere `order_id`.

### AD-8: Nightly Forecast is Cron-Triggered, Fault-Tolerant
**Binds:** A cron job fires at 18:00 daily, calling `POST /ml/forecast` on the FastAPI service. Results are persisted to `DemandForecasts` and `CookPlanItems` (suggested values). If the ML call fails, fallback: copy previous day's actual sales to `DemandForecasts` with `modelVersion: "fallback-actuals"` and alert Admin.
**Prevents:** A failed nightly run leaving Admin without a Cook Plan starting point.
**Rule:** The cron job is idempotent — a second run on the same date overwrites draft forecast records but never overwrites a confirmed Cook Plan.

### AD-9: Cook Plan Has a Lock Lifecycle
**Binds:** `CookPlanItem` states: `SUGGESTED` (ML output, editable) → `CONFIRMED` (Admin-locked, read-only after 10:00 AM) → `SUPERSEDED` (overridden post-lock, audit trail preserved).
**Prevents:** Kitchen seeing mid-day Cook Plan changes without Admin confirmation; concurrent writes to confirmed records.
**Rule:** After 10:00 AM, editing a confirmed Cook Plan requires an explicit override flag; the previous record is marked `SUPERSEDED` and a new record is created.

### AD-10: Canteen Coins Balance is Batch-Expiry-Aware
**Binds:** Coins are stored as `CoinBatch` records (earned amount, source, `expiresAt`). Effective balance = `SUM(earned - redeemed WHERE expiresAt > NOW())`. A daily cron at 00:00 marks expired batches. Redemptions consume soonest-expiring batches first (FIFO).
**Prevents:** Two redemption paths computing different balances; expired coins appearing as spendable.
**Rule:** All coins balance reads go through a single `getCoinsBalance(userId)` server function — never computed inline in a route handler.

### AD-11: One Writer per Entity (Ownership Table)
**Binds:** Entity write-ownership is exclusive:
- `MenuItems` — Admin Route Handlers only.
- `Orders` — Student Route Handler creates; Admin Route Handler updates status only.
- `WalletTransactions` — wallet service functions only (never direct Prisma calls in route handlers).
- `InventoryRecords` — Admin Route Handlers only.
- `DemandForecasts` / `CookPlanItems` — cron/ML pipeline writes suggested values; Admin Route Handler updates `finalQty` and `confirmedAt` only.

**Prevents:** Race conditions between Student and Admin writes on shared entities.
**Rule:** Cross-ownership writes are a code review violation. Lint rule enforces import paths to reinforce the boundary.

---

## Deferred (Not Decided Here)

- **Socket.io adapter for serverless** — sticky sessions vs. managed Pusher/Ably. Left open pending deployment target. `[ASSUMPTION: Railway/Render with persistent process — Socket.io native adapter.]`
- **ML model algorithm beyond v1** — Random Forest and LSTM upgrade paths acknowledged but not bound. FastAPI interface is stable; model internals are swappable.
- **PDF generation library** — `pdfkit`, `puppeteer`, or `@react-pdf/renderer` for Purchase Orders. Implementation detail.
- **Image storage** — Cloudinary, Vercel Blob, or S3-compatible. Any CDN URL in `MenuItem.imageUrl` satisfies the spine.
- **Push notification mechanism** — Web Push vs. in-app polling. Left open pending demo environment confirmation (PRD OQ-6).

---

## Open Questions (architecture-relevant, inherited from PRD)

- **OQ-1:** PayHere sandbox vs. live mode — affects webhook URL and HMAC secret configuration.
- **OQ-2:** Google Workspace domain restriction available? — affects whether NextAuth `signIn` callback performs a real domain check or a mocked allowlist.
- **OQ-6:** Web Push service worker support in demo environment — determines notification delivery mechanism.
