#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# docker-entrypoint.sh — Pre-flight check + start CaféSmart in production.
# ─────────────────────────────────────────────────────────────────────────────
# Verifies that every required env var is present and non-empty BEFORE
# booting Next.js. This prevents the "silent 500 from Prisma" failure
# mode where the app starts but every DB query crashes.
#
# Add new required vars by appending to REQUIRED_VARS below.
# ─────────────────────────────────────────────────────────────────────────────
set -eu

# ANSI helpers
_red()    { printf "\033[31m%s\033[0m\n" "$*"; }
_green()  { printf "\033[32m%s\033[0m\n" "$*"; }
_yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
_bold()   { printf "\033[1m%s\033[0m\n" "$*"; }

# ── Required env vars (fail fast if any are missing or empty) ─────────────
# These are the absolute minimum for the app to boot and serve any
# meaningful request. Add optional integrations separately below.
REQUIRED_VARS="
  DATABASE_URL
  AUTH_SECRET
  AUTH_URL
  AUTH_GOOGLE_ID
  AUTH_GOOGLE_SECRET
  PAYHERE_MERCHANT_ID
  PAYHERE_MERCHANT_SECRET
  ML_SERVICE_URL
  NEXT_PUBLIC_BASE_URL
"

# Use ``printenv`` rather than ``eval "val=\${$v:-}"`` so that values
# containing shell metacharacters (``$``, backticks, ``\``, ``!``) — common
# in secrets like PayHere & Google OAuth keys — are passed through verbatim.
# The previous ``eval`` form re-parsed the value as shell code and mangled
# secrets containing ``$`` or backticks, causing the entrypoint to falsely
# report them as missing and refuse to boot.
#
# Note: we cannot use ``${!v}`` (Bash indirect expansion) because the
# script runs under BusyBox ``/bin/sh`` on Alpine, which does not support
# that syntax.
MISSING=""
for v in $REQUIRED_VARS; do
  val="$(printenv "$v" 2>/dev/null || printf '')"
  # Strip surrounding whitespace (including stray trailing spaces from a
  # mis-edited .env line). Empty after stripping → considered missing.
  stripped="$(printf '%s' "$val" | tr -d '[:space:]')"
  if [ -z "$stripped" ]; then
    MISSING="$MISSING $v"
  fi
done

if [ -n "$MISSING" ]; then
  _red "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  _red "  ✗ CaféSmart startup aborted — missing required env vars:"
  for v in $MISSING; do
    _red "      - $v"
  done
  _red "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  _red ""
  _red "  Fix: copy .env.example to .env, fill in the values, then run:"
  _red "      docker run --rm -p 3000:3000 -p 8000:8000 \\"
  _red "             --env-file .env cafesmart:latest"
  _red ""
  _red "  Or use the bootstrap helper:"
  _red "      ./scripts/init-env.sh        # Linux/macOS"
  _red "      .\\scripts\\init-env.ps1        # Windows PowerShell"
  _red "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi

# ── Validate DATABASE_URL looks like a Postgres URL ──────────────────────
# Defensive normalisation: ``docker --env-file`` does NOT strip wrapping
# double-quotes when the quoted value contains a stray space before the
# closing quote (a common mis-edit in .env files). So the value the
# app sees can be ``"postgresql://... "`` with literal quote characters.
# We strip those, plus any whitespace, before the scheme check.
DATABASE_URL_TRIMMED="$(printf '%s' "$DATABASE_URL" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//')"
case "$DATABASE_URL_TRIMMED" in
  postgresql://*|postgres://*)
    : # ok
    ;;
  *)
    _red "  ✗ DATABASE_URL must start with postgresql:// or postgres://"
    _red "    Got: ${DATABASE_URL_TRIMMED:0:30}..."
    exit 1
    ;;
esac

# ── Validate AUTH_SECRET is long enough (>= 32 chars) ────────────────────
if [ "${#AUTH_SECRET}" -lt 32 ]; then
  _red "  ✗ AUTH_SECRET must be at least 32 characters (got ${#AUTH_SECRET})."
  _red "    Generate one with:  node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
  exit 1
fi

# ── Start the ML service in the background ───────────────────────────────
# Skipped when DISABLE_ML_COHOST=true (docker-compose.yml runs ML as a
# split `ml` service and points ML_SERVICE_URL at it instead).
if [ "${DISABLE_ML_COHOST:-false}" = "true" ]; then
  _yellow "  • Skipping co-hosted ML (external service via ML_SERVICE_URL=$(printenv ML_SERVICE_URL))"
else
_yellow "  • Starting ML microservice on port ${ML_SERVICE_PORT:-8000}..."
cd /app/ml-service
# uvicorn writes to stderr; we log to a file so docker logs capture it.
nohup python3 -m uvicorn main:app --host 127.0.0.1 --port "${ML_SERVICE_PORT:-8000}" \
  > /tmp/ml-service.log 2>&1 &
ML_PID=$!
echo "$ML_PID" > /tmp/ml-service.pid

# Wait briefly for the ML service to come up (max 10s)
for i in $(seq 1 20); do
  if wget -q --spider --tries=1 "http://127.0.0.1:${ML_SERVICE_PORT:-8000}/health" 2>/dev/null; then
    _green "  ✓ ML service is healthy (pid $ML_PID)"
    break
  fi
  sleep 0.5
done
cd /app
fi

# ── Start the Next.js standalone server ──────────────────────────────────
# NOTE: credentials are NEVER printed — userinfo is replaced with ***.
DB_DISPLAY="$(printf '%s' "$DATABASE_URL_TRIMMED" | sed -E 's#(^[a-zA-Z][a-zA-Z0-9+.-]*://)[^@]+@#\1***@#')"
_green "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
_green "  ✓ CaféSmart starting on port ${PORT:-3000}"
_green "    ENV:   NODE_ENV=${NODE_ENV:-production}"
_green "    DB:    $DB_DISPLAY"
_green "    ML:    $(printenv ML_SERVICE_URL)"
_green "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd /app
exec node server.js
