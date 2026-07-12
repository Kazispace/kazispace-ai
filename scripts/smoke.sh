#!/usr/bin/env bash
# KaziSpace FE smoke suite — run after every deploy / before merge.
#
# Usage:
#   npm run smoke
#   SMOKE_HOST=https://owen--kazispace.netlify.app npm run smoke
#   SMOKE_LINT=1 npm run smoke          # include eslint
#
# Manual UAT checklist: kazispace-test/docs/frontend/DEPLOY-SMOKE-TEST.md
# UAT results archive:  kazispace-test/reports/uat/
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${SMOKE_HOST:-https://kazispace.ai}"
API="${SMOKE_API:-https://bot.kazispace.ai}"

export SMOKE_HOST="$HOST"
export SMOKE_API="$API"

echo "============================================================"
echo "KaziSpace FE Smoke"
echo "Host: $HOST"
echo "API:  $API"
echo "============================================================"

cd "$ROOT"

echo ""
echo ">> AUTO-01 vitest"
npm test

if [[ "${SMOKE_LINT:-}" == "1" ]]; then
  echo ""
  echo ">> lint"
  npm run lint
fi

echo ""
echo ">> AUTO-03/04 health"
bash "$ROOT/scripts/smoke-health.sh"

echo ""
echo ">> FE routes"
bash "$ROOT/scripts/smoke-routes.sh"

echo ""
echo ">> AUTO-02 CV upload proxy"
bash "$ROOT/scripts/smoke-cv-upload.sh"

echo "============================================================"
echo "ALL FE SMOKE PASSED"
echo "Next: manual Tier A/B — see kazispace-test/docs/frontend/DEPLOY-SMOKE-TEST.md"
echo "============================================================"
exit 0
