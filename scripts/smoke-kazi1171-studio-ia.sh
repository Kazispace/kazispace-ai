#!/usr/bin/env bash
# KAZI-1171 UAT smoke (Owen 2026-10-26): `/english` is gone; old links land in Studio.
#
#   SMOKE_HOST=https://<deployed host> bash scripts/smoke-kazi1171-studio-ia.sh
#
# What it proves over HTTP (no login needed), always on the FIRST hop (no -L):
#   1. `/{locale}/english` and every sub-path answer a redirect to `/{locale}/clinic/hub` (Studio),
#      signed out too. A redirect to `/{locale}/login` is a FAIL with its own reason: the auth gate
#      ran before the `/english` redirect (UAT 14205 — the follow-up moved it into the middleware).
#      A 200 (the old page) is a FAIL too.
#   2. `/{locale}/spaces` and `/{locale}/clinic/hub` exist and are signed-in pages: first hop is a
#      redirect to `/{locale}/login`. ⚠ That is all it proves — not that they render.
#      A 404 / 5xx, or a 200 served to a signed-out visitor, is a FAIL.
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
    if [[ "$code" =~ ^(301|302|307|308)$ ]] && [[ "${location%%\?*}" == *"/$L/clinic/hub" ]]; then
      pass "$path → $code $location"
    elif [[ "$code" =~ ^(301|302|307|308)$ ]] && [[ "${location%%\?*}" == *"/$L/login" ]]; then
      fail "$path → $code $location (login gate ran before the /english redirect: deploy lacks the KAZI-1171 middleware redirect)"
    else
      fail "$path → $code ${location:-<no redirect>} (expected a redirect to /$L/clinic/hub)"
    fi
  done
  for path in "/$L/spaces" "/$L/clinic/hub"; do
    read -r code location < <(curl -sS -o /dev/null --max-time 30 -w '%{http_code} %{redirect_url}\n' "$HOST$path")
    if [[ "$code" =~ ^(301|302|307|308)$ ]] && [[ "${location%%\?*}" == *"/$L/login" ]]; then
      pass "$path → $code login (signed-in page exists; rendering is a manual step)"
    else
      fail "$path → $code ${location:-<no redirect>} (expected a redirect to /$L/login when signed out)"
    fi
  done
done

if [[ "$FAIL" -gt 0 ]]; then
  echo "FAIL KAZI-1171: $FAIL check(s) failed, $PASS passed"
  exit 1
fi
echo "PASS KAZI-1171: $PASS checks"
exit 0
