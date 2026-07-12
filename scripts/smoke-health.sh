#!/usr/bin/env bash
# Smoke: deploy site + API health (AUTO-03, AUTO-04).
set -euo pipefail

HOST="${SMOKE_HOST:-https://kazispace.ai}"
API="${SMOKE_API:-https://bot.kazispace.ai}"
PASS=0
FAIL=0

pass() { echo "  [PASS] $1 — $2"; PASS=$((PASS + 1)); }
fail() { echo "  [FAIL] $1 — $2"; FAIL=$((FAIL + 1)); }

site_code="$(curl -sS -o /dev/null -w '%{http_code}' "$HOST/")"
if [[ "$site_code" =~ ^(200|301|302|307|308)$ ]]; then
  pass "Deploy site reachable" "GET $HOST/ → HTTP $site_code"
else
  fail "Deploy site reachable" "GET $HOST/ → HTTP $site_code"
fi

api_code="$(curl -sS -o /dev/null -w '%{http_code}' "$API/health")"
if [[ "$api_code" == "200" ]]; then
  pass "API health" "GET $API/health → HTTP 200"
else
  fail "API health" "GET $API/health → HTTP $api_code"
fi

if [[ "$FAIL" -gt 0 ]]; then
  echo "smoke-health FAILED ($FAIL check(s), $PASS passed)"
  exit 1
fi
echo "smoke-health OK ($PASS checks)"
exit 0
