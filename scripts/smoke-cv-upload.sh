#!/usr/bin/env bash
# Smoke test: CV upload proxy + backend registry (KAZI-103).
# Usage:
#   ./scripts/smoke-cv-upload.sh
#   SMOKE_HOST=https://owen--kazispace.netlify.app ./scripts/smoke-cv-upload.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${SMOKE_HOST:-https://kazispace.ai}"
BACKEND_ROOT="${BACKEND_ROOT:-$(dirname "$ROOT")/kazispace-backend}"
TMP_DOCX="${TMPDIR:-/tmp}/smoke-resume.docx"
PASS=0
FAIL=0

pass() { echo "  [PASS] $1 — $2"; PASS=$((PASS + 1)); }
fail() { echo "  [FAIL] $1 — $2"; FAIL=$((FAIL + 1)); }

echo "============================================================"
echo "CV upload smoke — FE proxy + optional BE"
echo "Host: $HOST"
echo "============================================================"

python3 - <<'PY' "$TMP_DOCX"
import io, sys
from docx import Document
path = sys.argv[1]
buf = io.BytesIO()
doc = Document()
doc.add_paragraph("Jane Doe — Backend Engineer, Python/FastAPI.")
doc.save(buf)
open(path, "wb").write(buf.getvalue())
PY

# Proxy route: 401 means route exists and forwards to BE (no auth).
RESP="$(curl -sS -w '\n%{http_code}' -X POST "$HOST/api/cv/upload" \
  -H "X-Device-ID: smoke-cv-upload" \
  -H "Accept-Language: en" \
  -F "file=@$TMP_DOCX;type=application/vnd.openxmlformats-officedocument.wordprocessingml.document")"
BODY="${RESP%$'\n'*}"
CODE="${RESP##*$'\n'}"
if [[ "$CODE" == "401" ]] && echo "$BODY" | grep -q 'UNAUTHORIZED'; then
  pass "FE proxy /api/cv/upload" "HTTP 401 forwarded from backend"
else
  fail "FE proxy /api/cv/upload" "expected 401+UNAUTHORIZED, got HTTP $CODE body=${BODY:0:120}"
fi

if [[ -f "$BACKEND_ROOT/scripts/local_smoke_kazi101_cv_upload.py" ]]; then
  echo ""
  echo "Backend smoke ($BACKEND_ROOT)..."
  if (cd "$BACKEND_ROOT" && python3 scripts/local_smoke_kazi101_cv_upload.py); then
    pass "BE cv upload (mocked parser)" "all checks passed"
  else
    fail "BE cv upload (mocked parser)" "see output above"
  fi

  echo ""
  echo "Backend registry warm-load (regression: no PROMPT_DUPLICATE)..."
  if (cd "$BACKEND_ROOT/backend" && python3 - <<'PY'
import os, asyncio
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "smoke")
from skills import get_registry
from agents.cv_builder.cv_upload import _invoke_cv_parser
get_registry()
asyncio.run(_invoke_cv_parser("Jane Doe Backend Engineer", "en", 1))
print("registry ok")
PY
  ); then
    pass "BE registry double-load" "get_registry() then _invoke_cv_parser OK"
  else
    fail "BE registry double-load" "PROMPT_DUPLICATE or other crash"
  fi
else
  echo "  [SKIP] backend smoke — BACKEND_ROOT not found at $BACKEND_ROOT"
fi

echo "============================================================"
if [[ "$FAIL" -gt 0 ]]; then
  echo "FAILED ($FAIL check(s), $PASS passed)"
  exit 1
fi
echo "ALL PASSED ($PASS checks)"
exit 0
