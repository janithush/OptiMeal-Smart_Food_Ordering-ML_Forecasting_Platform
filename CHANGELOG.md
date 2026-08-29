# Changelog

All notable changes to the CaféSmart project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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

## [Unreleased] — Troubleshooting Guide (2026-08-30)

### ✨ New
- **`docs/TROUBLESHOOTING.md`** — field guide for the 8 most common
  CaféSmart build / run issues, with copy-paste fixes and diagnostic
  steps. Covers: Docker engine not running, missing `.env`, CRLF
  line endings in shell scripts, `PrismaClientInitializationError`,
  missing Prisma schema in Dockerfile, `EBADENGINE` warnings on Node
  20, `next.config.ts` rejecting `eslint` key, and Playwright
  browser-not-installed.
- **`README.md` Troubleshooting section** — links to the guide and
  flags the most common "gotcha" (`docker build` failing with `got
  SIGTERM/SIGINT` — that's a Docker Desktop issue, not a code issue).

### 📝 Notes
- The current `docker build` failure with `got SIGTERM/SIGINT` is a
  host-level Docker Desktop issue: the Windows named pipe
  `//./pipe/dockerDesktopLinuxEngine` exists but the engine isn't
  listening on it. Fix it with the steps in
  `docs/TROUBLESHOOTING.md §1` (force-quit Docker Desktop, restart,
  poll for engine, restart WSL2 if needed). No code change is
  required.

---

## [Unreleased] — Line Ending Fix (2026-08-30)

### 🐛 Build fix
- **Container crashed with `exec /usr/local/bin/docker-entrypoint.sh:
  no such file or directory`** when run on a Docker image built from
  a Windows host. The shell script was committed with CRLF line
  endings (Windows-style), so the kernel saw the shebang as
  `#!/bin/sh\r` and tried to exec a binary called `/bin/sh\r`,
  which doesn't exist. Same bug latent in `scripts/init-env.sh`.
- **Normalized to LF** (single Unix line endings) the following files:
  - `docker-entrypoint.sh`
  - `scripts/init-env.sh`
  - `Dockerfile`
  - `.gitattributes` (new file)
  - `scripts/check-line-endings.sh` (new file)
- **Belt-and-suspenders in `Dockerfile`**: after `COPY
  --chmod=755 docker-entrypoint.sh /usr/local/bin/...`, a `RUN` step
  invokes `dos2unix` (or a `sed 's/\r$//'` fallback) to strip any
  stray Windows line endings. The `head -c 10 | od -c` at the end of
  the same `RUN` makes the failure loud if normalization somehow
  fails.

### ✨ New
- **`.gitattributes`** — forces `*.sh` and `Dockerfile*` to LF
  on checkout, and `*.ps1` to CRLF (Windows PowerShell needs CRLF).
  Prevents this regression from recurring when a developer on
  Windows opens a shell script in a CRLF-normalizing editor.
- **`scripts/check-line-endings.sh`** — standalone auditor that walks
  the repo, finds every `*.sh`, `Dockerfile*`, and `.gitattributes`,
  and reports any that still contain CR characters. Returns non-zero
  exit code so it can run in CI. Excludes `node_modules`, `.next`,
  `.venv`, `.git`, and the BMAD agent directories.

### 🧪 Verification
- All four target files: **0 CRLF, 107+ LF lines** (verified with
  PowerShell regex scan of the raw bytes).
- First 10 bytes of `docker-entrypoint.sh`: `35 33 47 98 105 110 47
  115 104 10` = `#!/bin/sh\n` — clean shebang, ready for `execve()`.
- `init-env.ps1` deliberately kept at 132 CRLF (PowerShell expects
  CRLF; `.gitattributes` preserves this).

---

## [Unreleased] — Docker Env Bootstrap (2026-08-30)

### 🐛 Bug fix
- **`docker run --env-file .env ...` failed with
  `The system cannot find the file specified`** because `.env` is
  gitignored and is not created by the project on a fresh clone.
  - Root cause: only `.env.example` (3 lines, mostly placeholders) and
    `.env.local` (gitignored dev secrets) existed. The README assumed
    `.env` already existed.
  - Fix: shipped two new bootstrap scripts that create a complete
    `.env` from `.env.example`, generate a 32-byte random
    `AUTH_SECRET`, and auto-import real values from `.env.local` if
    present.

### ✨ New
- `scripts/init-env.ps1` (Windows PowerShell) and `scripts/init-env.sh`
  (Linux/macOS) — copy `.env.example` → `.env`, generate `AUTH_SECRET`,
  prompt for any remaining hand-filled secrets, optionally run
  `docker build`. Use `.\scripts\init-env.ps1 -Force` to overwrite an
  existing `.env`.
- `docker-entrypoint.sh` (copied into the image at
  `/usr/local/bin/docker-entrypoint.sh`) — runs **before** the Node
  server starts and:
  1. Verifies every required env var is present and non-empty.
  2. Validates `DATABASE_URL` starts with `postgresql://` / `postgres://`.
  3. Validates `AUTH_SECRET` is at least 32 characters.
  4. On any failure, prints a clear red error block listing exactly
     which vars are missing and how to fix them, then exits with code 1.
  5. Otherwise, starts the Python ML service in the background, waits
     up to 10 s for it to come up, then `exec`s the Node server.
- The Dockerfile now uses this entrypoint via
  `ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]` so any
  misconfiguration produces a clear, actionable error message instead
  of a silent 500 from Prisma.

### 📝 Updated
- `.env.example` rewritten with **all 14 vars** the container needs,
  each annotated with a comment explaining what to fill in.
- `README.md` Docker section now points to the bootstrap scripts and
  shows three run modes (env-file, inline `-e`, manual).
- `Dockerfile` now copies + chmod's the entrypoint and uses it as the
  image entrypoint.

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

