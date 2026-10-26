#!/usr/bin/env bash
# KAZI-1171 UAT smoke (Owen 2026-10-26): `/english` is gone; old links land in Studio.
#
#   SMOKE_HOST=https://<deployed host> bash scripts/smoke-kazi1171-studio-ia.sh
#
# What it proves over HTTP (no login needed):
#   1. `/{locale}/english` and every sub-path answer a redirect to `/{locale}/clinic/hub` (Studio).
#      Expected before the deploy carries KAZI-1171: 200 (the old page) ⇒ FAIL.
#   2. The new homes still load: `/{locale}/spaces` (the Space tab) and `/{locale}/clinic/hub` (Studio).
# What it cannot prove (rendered in the browser, signed in): the tab labels, the five Studio
# sections, and the English tutor opening an English Space — those are the manual steps on the ticket.
#
# Exit: 0 PASS · 1 FAIL · 2 PRECONDITION (host unreachable).
set -uo pipefail

HOST="${SMOKE_HOST:-https://kazispace.ai}"
LOCALES="${SMOKE_LOCALES:-zh en}"
PASS=0
FAIL=0

pass() { echo "  [PASS] $1"; PASS=$((PASS + 1)); }
fail() { echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); }

if ! curl -sS -o /dev/null --max-time 20 "$HOST/"; then
  echo "PRECONDITION KAZI-1171: $HOST is unreachable"
  exit 2
fi

echo "KAZI-1171 Studio IA smoke — $HOST"
for L in $LOCALES; do
  for path in "/$L/english" "/$L/english/passport" "/$L/english/onboarding" "/$L/english/training" "/$L/english/assessment" "/$L/english/growth"; do
    read -r code location < <(curl -sS -o /dev/null --max-time 30 -w '%{http_code} %{redirect_url}\n' "$HOST$path")
    if [[ "$code" =~ ^(301|302|307|308)$ ]] && [[ "$location" == *"/$L/clinic/hub" ]]; then
      pass "$path → $code $location"
    else
      fail "$path → $code ${location:-<no redirect>} (expected a redirect to /$L/clinic/hub)"
    fi
  done
  for path in "/$L/spaces" "/$L/clinic/hub"; do
    code="$(curl -sS -L -o /dev/null --max-time 30 -w '%{http_code}' "$HOST$path")"
    if [[ "$code" =~ ^(200|301|302|307|308)$ ]]; then
      pass "$path → final $code"
    else
      fail "$path → final $code"
    fi
  done
done

if [[ "$FAIL" -gt 0 ]]; then
  echo "FAIL KAZI-1171: $FAIL check(s) failed, $PASS passed"
  exit 1
fi
echo "PASS KAZI-1171: $PASS checks"
exit 0
