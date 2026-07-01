#!/usr/bin/env bash
# Sync OpenAPI snapshot from kazispace-backend (KAZI-3).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${OPENAPI_SRC:-$ROOT/../kazispace-backend/docs/openapi.json}"
DEST="$ROOT/docs/openapi.json"
if [[ ! -f "$SRC" ]]; then
  echo "Missing $SRC — set OPENAPI_SRC or clone kazispace-backend alongside kazispace-ai" >&2
  exit 1
fi
mkdir -p "$(dirname "$DEST")"
cp "$SRC" "$DEST"
echo "Synced $DEST from $SRC"
