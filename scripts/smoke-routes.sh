#!/usr/bin/env bash
# Smoke: key FE routes return non-5xx (guest / redirect OK).
set -euo pipefail

HOST="${SMOKE_HOST:-https://kazispace.ai}"
LOCALE="${SMOKE_LOCALE:-zh}"
PASS=0
FAIL=0

pass() { echo "  [PASS] $1 — $2"; PASS=$((PASS + 1)); }
fail() { echo "  [FAIL] $1 — $2"; FAIL=$((FAIL + 1)); }

check_route() {
  local path="$1"
  local label="$2"
  local code final
  code="$(curl -sS -o /dev/null -w '%{http_code}' "$HOST$path")"
  final="$(curl -sS -L -o /dev/null -w '%{http_code}' "$HOST$path")"
  if [[ "$code" =~ ^(200|301|302|307|308)$ ]] && [[ "$final" =~ ^(200|301|302|307|308)$ ]]; then
    pass "$label" "$path → HTTP $code (final $final)"
  else
    fail "$label" "$path → HTTP $code (final $final)"
  fi
}

echo "FE route smoke — $HOST (locale=$LOCALE)"

check_route "/$LOCALE/chat" "Clinic chat"
check_route "/$LOCALE/login" "Login"
check_route "/$LOCALE/cv" "CV Hub"
check_route "/$LOCALE/interview" "Interview Hub"
check_route "/$LOCALE/jobs" "Jobs"
check_route "/$LOCALE/mine" "Mine"

if [[ "$FAIL" -gt 0 ]]; then
  echo "smoke-routes FAILED ($FAIL route(s), $PASS passed)"
  exit 1
fi
echo "smoke-routes OK ($PASS routes)"
exit 0
