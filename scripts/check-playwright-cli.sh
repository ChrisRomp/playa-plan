#!/usr/bin/env bash
# Verify playwright-cli is installed locally and the agent skills bundle is available.
# This script intentionally does NOT auto-install — it prints exact commands to run.
#
# Usage:
#   ./scripts/check-playwright-cli.sh
#
# Exit codes:
#   0 — playwright-cli present (skills check is best-effort and warns only)
#   1 — playwright-cli missing

set -u

if ! command -v playwright-cli >/dev/null 2>&1; then
  cat >&2 <<'EOF'
[playwright-cli] Not found on PATH.

Install it (one of):
  npm install -g @playwright/cli@latest
  pnpm add -g @playwright/cli@latest
  volta install @playwright/cli

Then install the agent skills bundle so coding agents pick up the workflows:
  playwright-cli install --skills

Re-run this script (or `npm run test:e2e:author`) once installed.
EOF
  exit 1
fi

# Best-effort: check the help output mentions a skill path.
if ! playwright-cli --help 2>&1 | grep -q -i "skill"; then
  cat >&2 <<'EOF'
[playwright-cli] Found, but the skills bundle may not be installed.
Run:
  playwright-cli install --skills
EOF
fi

echo "[playwright-cli] OK ($(command -v playwright-cli))"
exit 0
