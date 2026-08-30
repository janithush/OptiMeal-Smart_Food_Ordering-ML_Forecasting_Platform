# Changelog

All notable changes to the CaféSmart project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased] — Vercel Cron Schedulers (2026-08-30)

### 🐛 Bug fix
- **ML `/forecast` endpoint 500s with feature-dimension mismatch**
  (live-bug-audit). The trained `StandardScaler` was fit on a 17-feature
  vector (7-day history window + 10 domain features), but `predict()` fed
  only the 10-feature domain vector to `scaler.transform()`, raising
  `ValueError: X has 10 features, but StandardScaler is expecting 17
  features as input` and causing the API to return HTTP 500. Fix: added
  `_build_full_feature_vector()` that mirrors the training-time
  concatenation, plus a short-history guard that routes to the
  deterministic fallback when fewer than 7 days of history are available.
- **Schedulers don't run in production** (Bug #1 from live-bug-audit).
  `server.ts` has 4 background schedulers (smart discount 12:30 PM,
  nightly ML forecast 18:00, post-cutoff cook plan 09:05, weekly
  retraining Sunday 02:00) implemented as `setInterval` loops. Vercel's
  serverless runtime does not support long-lived background processes,
  so none of these ever ran in production. The 13-day-old
  `DemandForecast.generatedAt` was the symptom. Fix: move all 4
  schedulers to **Vercel Cron Jobs**, with each cron calling an HTTP
  endpoint that runs the existing function.

### ✨ New
- `src/lib/cron-auth.ts` — shared `CRON_SECRET` verifier
  (constant-time string compare, supports `Authorization: Bearer` and
  `x-cron-secret` headers).
- `src/app/api/cron/nightly-forecast/route.ts` — calls
  `runNightlyForecast()` at 12:30 UTC (18:00 Sri Lanka).
- `src/app/api/cron/post-cutoff-cook-plan/route.ts` — calls
  `runPostCutoffUpdate()` at 03:35 UTC (09:05 Sri Lanka).
- `src/app/api/cron/smart-discount-check/route.ts` — runs the 30%
  threshold check at 07:00 UTC (12:30 Sri Lanka). Uses
  `getTodayDate()` from `@/lib/date-utils` for the canteen day
  boundary.
- `src/app/api/cron/weekly-retrain/route.ts` — calls
  `runWeeklyRetraining()` at 20:30 UTC Saturday (02:00 Sri Lanka
  Sunday).
- `vercel.json` — declares the 4 cron schedules.

### 🐛 Bug fix
- **PayHere webhook returns 500 for unknown user** (Bug #3 from
  live-bug-audit). When a PayHere webhook with a valid HMAC
  signature referenced a non-existent userId, the Prisma upsert threw
  a P2003 foreign-key violation that propagated as HTTP 500. PayHere
  retries 5xx errors for up to 24 hours, so a single bad orderId
  generated dozens of identical 500s. Fix: pre-flight
  user-existence check inside the transaction + map both
  `USER_NOT_FOUND` and defensive `P2003` to HTTP 400 (no retry).

### 🐛 Bug fix
- **4 missing database indexes** (Bug #2 from live-bug-audit). The
  Phase 1 single-column `@@index` directives on
  `DemandForecast.date`, `WalletAccount.userId`,
  `GroupOrderParticipant.studentId`, and
  `GroupOrderCartItem.participantId` were declared in the schema
  but never applied to the live database (originally created via
  `prisma db push`). Fix: created the indexes directly, added
  `1_add_missing_indexes` migration, recorded in `_prisma_migrations`.

### 🔐 Security
- **Row Level Security lockdown on Supabase.** The live database had
  RLS disabled on 24 tables, exposing every user record, wallet, and
  order to anyone with the project's `anon` key (which would be in
  the browser bundle if the app used the Supabase JS client — it
  doesn't, but defense in depth). Enabled RLS on all 24 tables,
  created 19 policies matching the actual access patterns (anon
  read-only on public menu data, authenticated role-scoped reads
  on user-owned data, full access only for the `postgres` role which
  Prisma uses and has BYPASSRLS), and resolved the Supabase advisor
  warning.

### 🛠 Required env var
- `CRON_SECRET` (new) — set in Vercel project env vars. Different
  from `AUTH_SECRET`. Vercel sends it in the `Authorization: Bearer
  <secret>` header on every cron call.

### 📊 Test results
- All 80 Vitest unit tests pass.
- All 26 ML pytest tests pass.
- Live deployment verified: Vercel → Supabase connectivity works,
  NextAuth configured correctly, all 7 ML models loaded.

---

## [Unreleased] — Phase 2 → 4 Polish Pass (2026-08-29)

### 🔐 Security
- **PayHere webhook** now reads the **raw request body** via `req.text()` before parsing
  any form fields, so the HMAC-MD5 signature is verified over the bytes PayHere
  actually signed. The previous `formData()` approach re-serialised the body and
  could cause signature mismatches.
- Added `parseFormUrlEncoded()` helper in `src/lib/payhere.ts` that round-trips
  percent-encoding and `+`/space exactly once.
- Added `verifyPayHereWebhookRaw()` with constant-time signature comparison
  (`crypto.timingSafeEqual`).
- Webhook now validates `PAYHERE_MERCHANT_ID` / `PAYHERE_MERCHANT_SECRET` are
  configured at request time and returns 500 with a clear log message otherwise.
- Webhook now also validates `payhereAmount > 0` and `payhereCurrency === "LKR"`.
- The wallet upsert inside the webhook transaction now uses `prisma.walletAccount.upsert`
  with a single round-trip (was: separate `findUnique` + conditional `create`).
- **`/student` Socket.io namespace** now requires a valid JWT session and
  STUDENT role. Previously, any browser tab could connect without auth and
  listen to broadcasts. Removed the global broadcast on
  `orderStatusChanged` — only the per-user `user:{userId}` room is now used.

### 🛠 Backend / Infrastructure
- **Prisma baseline migration** added at `prisma/migrations/0_init/migration.sql`
  with `migration_lock.toml`. README updated to recommend
  `prisma migrate deploy` for production.
- **Schema indexes added**:
  - `DemandForecast.@@index([date])`
  - `WalletAccount.@@index([userId])`
  - `GroupOrderParticipant.@@index([studentId])`
  - `GroupOrderCartItem.@@index([participantId])`
  - All previously existing indexes on `Order`/`OrderItem` were committed.
- **Schema cascade rules added**:
  - `GroupOrderParticipant` cascades on User/GroupOrder delete.
  - `GroupOrderCartItem` cascades on User/GroupOrder delete.
- **Seed script** now throws a clear error if `DATABASE_URL` is not configured
  (was: silent crash on `process.env.DATABASE_URL!`).
- **`next.config.ts` hardened**:
  - `poweredByHeader: false` (no `X-Powered-By: Next.js` leak).
  - `reactStrictMode: true`.
  - `output: "standalone"` for Docker.
  - Security headers: `X-Content-Type-Options`, `X-Frame-Options`,
    `Referrer-Policy`, `Permissions-Policy`.
  - `Cache-Control: no-store` on `/api/wallet/webhook`.
- **ESLint** now enforces `no-var: error`. All existing `var` declarations
  in the codebase have been converted to `const` / `let`.

### 🧠 ML Microservice
- `/health` now reports the list of trained models on disk
  (`{ status, models: [...], models_loaded: N }`).
- `/forecast` now wraps the per-item `predict()` call in try/except — a single
  bad item no longer aborts the whole batch. Failed items fall back to a new
  public deterministic estimator (`_fallback_prediction`) and are marked with
  `modelVersion = "fallback-actuals"`.
- Added `list_loaded_models()` helper.
- Pinned `pydantic>=2.5,<3` in `ml-service/requirements.txt`.

### 🎨 Admin Dashboard Polish
- **ML health indicator** added to the admin dashboard header
  (`src/components/admin/MlHealthIndicator.tsx`) — polls `/api/ml/health`
  every 30 s and shows green/amber/red. Admins no longer need to look at
  server logs to know if the ML service is down.
- **Inventory page** now uses `headers()` to derive the base URL from the
  request host (was: hardcoded `http://localhost:3000` fallback in prod).
  Same fix applied to the dashboard and cook-plan server components.
- **Inventory table** column header renamed to "Forecasted Need" so the
  pre-existing component test passes.
- **Cook Plan** page now has a **mobile card view** (sm and below) in
  addition to the desktop table. The table is hidden on mobile to prevent
  horizontal overflow.
- **Error boundaries** added at the root (`src/app/error.tsx`) and
  admin scope (`src/app/admin/error.tsx`).
- **Branded 404** page at `src/app/not-found.tsx`.

### 🧪 Tests
- New Next.js unit tests (49 added → 80 total, all passing):
  - `tests/unit/payhere-signature.test.ts` — 19 tests for HMAC, form parsing, orderId.
  - `tests/unit/is-cook-plan-locked.test.ts` — 5 tests for lock-time logic.
  - `tests/unit/analytics-pure.test.ts` — 5 tests for waste-rate calculation.
  - `tests/unit/forecast-runner-payload.test.ts` — 3 tests for ML payload shape.
  - `tests/unit/procurement-tier.test.ts` — 6 tests for stock-tier classification.
  - `tests/unit/slot-display.test.ts` — 6 tests for slot-time display formatting.
  - The pre-existing `tests/unit/inventory-client.test.tsx` (8 tests) now
    passes after the column-header fix.
- New ML pytest suite (26 tests, all passing):
  - `ml-service/tests/test_helpers.py` — 14 tests for safe parsers, one-hot
    encoder, feature vector, training-data builder.
  - `ml-service/tests/test_fallback.py` — 6 tests for the new
    `_fallback_prediction` function.
  - `ml-service/tests/test_api.py` — 6 tests for the FastAPI surface
    (health, forecast, train).

### 🚀 CI / CD
- **`.github/workflows/ci.yml`** — runs lint, typecheck, Vitest, Next.js
  production build, and the ML pytest suite on every push / PR.
- **`.github/workflows/docker.yml`** — multi-arch Docker build & push
  to `ghcr.io` on main / tags.
- **Multi-stage `Dockerfile`** — deps → build → ml-deps → runner (Node 20
  Alpine + Python 3.12). Uses the `standalone` Next.js build, runs as
  non-root user, exposes both 3000 (Next.js) and 8000 (ML service), with
  a healthcheck.
- **`.dockerignore`** added.
- `package.json` now declares `engines: { node >= 20, npm >= 10, python >= 3.11 }`
  and adds `ml:test`, `ml:install`, `db:migrate:dev`, `db:migrate:deploy`,
  `db:reset`, `db:studio` scripts.

## [0.1.0] — Initial HackTrail submission
- Pre-polish baseline. See `git log` for history.

---

## [Unreleased] — Test Timezone Fix (2026-08-30)

### 🐛 Test fix
- Three time-dependent tests previously failed when the host clock
  straddled the UTC/Colombo date boundary (because production code
  uses `Asia/Colombo`, UTC+5:30, but the tests used raw `Date.UTC(...)`
  / `new Date().toISOString()` which are UTC-relative):
  - `tests/unit/inventory-validation.test.ts > rejects future dates`
  - `tests/unit/inventory-validation.test.ts > accepts yesterday's date (within 1 day)`
  - `tests/unit/inventory-client.test.tsx > shows today's date with 'Today' badge`
- Added a new shared test helper `tests/support/helpers/colombo-date.ts`
  exposing:
  - `getColomboTodayDate()` — mirrors `src/lib/date-utils.ts#getTodayDate()`.
  - `getColomboTodayString()` — mirrors `#getColomboDateString()`.
  - `getColomboOffsetDate(offsetDays)` / `getColomboOffsetString(offsetDays)`
    — build any past/future date relative to Colombo-today.
- Refactored both failing test files to use the new helper. **No test
  in the repo now constructs a date with `Date.UTC(...)` or
  `new Date().toISOString()`** for the purpose of asserting a date.

### ✅ Verification
- 5 consecutive runs of the formerly-failing test file: all 12/12 pass.
- Full Vitest suite: 80/80 pass across 10 test files.
- `npm run build`: clean.

---

## [Unreleased] — Dockerfile Build Fix (2026-08-30)

### 🐛 Build fix
- **`Dockerfile` no longer fails on `prisma generate` in the `deps` stage.**
  Root cause: the `postinstall` script (`prisma generate`) runs during
  `npm ci`, but the previous `Dockerfile` only `COPY`d `package.json` and
  `package-lock.json` before the install — the Prisma schema was copied
  in the next stage. Result: `Could not find Prisma Schema that is
  required for this command`.
  - Fix: `COPY prisma ./prisma` and `COPY prisma.config.ts ./` are now
    invoked before `npm ci` in the `deps` stage.

### ⚙️ Engine compatibility
- Bumped all Node base images from `node:20-alpine` to `node:22-alpine`
  to silence `EBADENGINE` warnings from:
  - `@prisma/streams-local@0.1.11` (transitive of Prisma 7) — requires
    `node >= 22.0.0`.
  - `@testing-library/jest-dom@7.0.0` (devDep) — requires `node >= 22`.
- Added `apk add openssl` to the Node base images (required by the
  Prisma 7 engine on Alpine).
- `package.json#engines.node` bumped from `>=20.0.0` to `>=22.0.0` to
  match the Docker base image and the upstream package requirements.
- `.github/workflows/ci.yml` `setup-node` version bumped from `20` to
  `22` in both the `test-nextjs` and `build-nextjs` jobs.
