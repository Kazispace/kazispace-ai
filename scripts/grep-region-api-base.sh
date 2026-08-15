#!/usr/bin/env bash
# KAZI-533 grep gate: feature modules must not read NEXT_PUBLIC_API_BASE_URL.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Allowed: lib/region/**, .env*, scripts/**
# Scope: application source under src/ (not docs/README).
HITS=$(rg -n 'NEXT_PUBLIC_API_BASE_URL' src \
  --glob '!src/lib/region/**' \
  --glob '!**/region-client.test.ts' \
  || true)

if [[ -n "${HITS}" ]]; then
  echo "KAZI-533 grep gate FAILED — NEXT_PUBLIC_API_BASE_URL outside allowlist:"
  echo "${HITS}"
  exit 1
fi

echo "KAZI-533 grep gate OK"
