# ─────────────────────────────────────────────────────────────────────────────
# init-env.sh — Bootstrap a `.env` file from `.env.example` for CaféSmart.
# ─────────────────────────────────────────────────────────────────────────────
# Usage (from the repository root):
#   ./scripts/init-env.sh
#
# What it does:
#   1. If `.env` already exists, asks before overwriting.
#   2. Copies `.env.example` → `.env`.
#   3. Generates a cryptographically-random 32-byte AUTH_SECRET (base64).
#   4. Prompts for the few secrets that MUST be filled in by hand
#      (DATABASE_URL, Google OAuth, PayHere).
#   5. Optionally runs `docker build` so the image is ready to launch.
# ─────────────────────────────────────────────────────────────────────────────
#!/usr/bin/env bash
set -euo pipefail

# Move to repo root (parent of the scripts/ directory)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

FORCE=0
NO_BUILD=0
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    --no-build) NO_BUILD=1 ;;
    *) echo "Unknown flag: $arg" >&2; exit 1 ;;
  esac
done

echo
echo -e "\033[1;36mCaféSmart — .env bootstrap\033[0m"
echo -e "\033[1;36m──────────────────────────\033[0m"
echo "Repo: $REPO_ROOT"
echo

ENV_PATH="$REPO_ROOT/.env"
if [ -f "$ENV_PATH" ] && [ "$FORCE" -ne 1 ]; then
  read -rp "  .env already exists. Overwrite? [y/N] " answer
  if [ "$answer" != "y" ] && [ "$answer" != "Y" ]; then
    echo "  Aborted. Existing .env left unchanged."
    exit 0
  fi
fi

if [ ! -f "$REPO_ROOT/.env.example" ]; then
  echo -e "  \033[31m✗ .env.example not found in $REPO_ROOT\033[0m"
  exit 1
fi

# 1) Copy template → .env
cp "$REPO_ROOT/.env.example" "$ENV_PATH"
echo -e "  \033[32m✓ Copied .env.example → .env\033[0m"

# 2) Generate AUTH_SECRET
if command -v openssl >/dev/null 2>&1; then
  AUTH_SECRET=$(openssl rand -base64 32)
else
  AUTH_SECRET=$(head -c 32 /dev/urandom | base64)
fi

# In-place sed replacements (macOS + Linux compatible)
if sed --version >/dev/null 2>&1; then
  # GNU sed
  sed -i "s|AUTH_SECRET=\"REPLACE-ME-WITH-A-32-BYTE-RANDOM-BASE64-STRING\"|AUTH_SECRET=\"$AUTH_SECRET\"|" "$ENV_PATH"
  sed -i "s|NEXTAUTH_SECRET=\"REPLACE-ME-WITH-A-32-BYTE-RANDOM-BASE64-STRING\"|NEXTAUTH_SECRET=\"$AUTH_SECRET\"|" "$ENV_PATH"
else
  # BSD sed (macOS)
  sed -i '' "s|AUTH_SECRET=\"REPLACE-ME-WITH-A-32-BYTE-RANDOM-BASE64-STRING\"|AUTH_SECRET=\"$AUTH_SECRET\"|" "$ENV_PATH"
  sed -i '' "s|NEXTAUTH_SECRET=\"REPLACE-ME-WITH-A-32-BYTE-RANDOM-BASE64-STRING\"|NEXTAUTH_SECRET=\"$AUTH_SECRET\"|" "$ENV_PATH"
fi

echo -e "  \033[32m✓ Generated AUTH_SECRET and NEXTAUTH_SECRET\033[0m"

# 3) Prompt for hand-filled secrets
update_env() {
  local key="$1"
  local prompt="$2"
  local required="${3:-true}"
  local current
  current=$(grep -E "^${key}=" "$ENV_PATH" | head -1 || true)
  if [ -n "$current" ] && ! echo "$current" | grep -qE "REPLACE-ME|your-"; then
    echo "  • $key already filled — keeping"
    return
  fi
  read -rp "  $prompt: " value
  if [ "$required" = "true" ] && [ -z "${value:-}" ]; then
    echo "    Skipped (you can edit .env later)"
    return
  fi
  if sed --version >/dev/null 2>&1; then
    sed -i "s|^${key}=.*$|${key}=\"${value}\"|" "$ENV_PATH"
  else
    sed -i '' "s|^${key}=.*$|${key}=\"${value}\"|" "$ENV_PATH"
  fi
  echo -e "  \033[32m✓ $key updated\033[0m"
}

echo
echo -e "  \033[1;33mRequired hand-filled values (Enter to skip and edit .env later):\033[0m"
update_env "DATABASE_URL"           "DATABASE_URL (e.g. postgresql://user:pass@host:5432/db)"
update_env "AUTH_GOOGLE_ID"         "AUTH_GOOGLE_ID (Google OAuth client ID)"
update_env "AUTH_GOOGLE_SECRET"     "AUTH_GOOGLE_SECRET (Google OAuth client secret)"
update_env "PAYHERE_MERCHANT_ID"    "PAYHERE_MERCHANT_ID (sandbox: 1211111)"
update_env "PAYHERE_MERCHANT_SECRET" "PAYHERE_MERCHANT_SECRET (sandbox value)"

echo
echo -e "  \033[32m✓ .env is ready at $ENV_PATH\033[0m"
echo
echo -e "  \033[1;36mNext steps:\033[0m"
echo "    1. (Optional) Inspect or edit:  \$EDITOR .env"
echo "    2. Build the Docker image:      docker build -t cafesmart:latest ."
echo "    3. Run the container:           docker run --rm -p 3000:3000 -p 8000:8000 --env-file .env cafesmart:latest"
echo

# 4) Optionally build the image now
if [ "$NO_BUILD" -ne 1 ]; then
  read -rp "  Build the Docker image now? [y/N] " answer
  if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
    docker build -t cafesmart:latest .
  else
    echo "  Skipped. Run 'docker build -t cafesmart:latest .' when you're ready."
  fi
fi
