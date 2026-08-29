#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# check-line-endings.sh — Audit shell scripts and Dockerfiles for CRLF.
# ─────────────────────────────────────────────────────────────────────────────
# Returns exit 0 if all targeted files are LF-only, exit 1 otherwise.
# Run this in CI to catch regressions before they break a container.
# ─────────────────────────────────────────────────────────────────────────────

set -eu

cd "$(dirname "$0")/.."

# Find: all *.sh, Dockerfile, Dockerfile.* (any extension), .gitattributes
# Skip: any file under node_modules, .next, .venv, ml-service/.venv, _bmad*
TARGETS=$(
  find . \
    -type d \( -name node_modules -o -name .next -o -name .venv -o -name .git -o -name _bmad -o -name _bmad-output \) -prune -false \
    -o -type f \( -name '*.sh' -o -name 'Dockerfile' -o -name 'Dockerfile.*' -o -name '.gitattributes' \) -print
)

if [ -z "$TARGETS" ]; then
  echo "  No target files found. Skipping."
  exit 0
fi

BAD=0
echo "Checking line endings of shell scripts / Dockerfiles / .gitattributes..."
echo ""

for f in $TARGETS; do
  # Count CRLF: bytes 0x0D 0x0A
  crlf=$(tr -cd '\r' < "$f" | wc -c | tr -d ' ')
  if [ "$crlf" -gt 0 ]; then
    printf "  \033[31m✗\033[0m %-60s  %d CR characters (should be 0)\n" "$f" "$crlf"
    BAD=$((BAD + 1))
  else
    printf "  \033[32m✓\033[0m %s\n" "$f"
  fi
done

echo ""
if [ "$BAD" -gt 0 ]; then
  echo "  \033[31m✗ $BAD file(s) have CRLF line endings.\033[0m"
  echo "    Fix with:  sed -i 's/\r\$//' <file>   (or)   dos2unix <file>"
  exit 1
fi

echo "  \033[32m✓ All shell scripts and Dockerfiles are LF-clean.\033[0m"
exit 0
