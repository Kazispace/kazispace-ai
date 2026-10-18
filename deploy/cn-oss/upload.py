#!/usr/bin/env python3
"""Upload CN static entry pages to Aliyun OSS (kazispace-cn-web).

Requires env:
  ali_oss_key_id
  ali_oss_key_value

Never prints AccessKey values.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

try:
    import oss2
except ImportError:
    print("ERROR: install oss2 first: pip install oss2", file=sys.stderr)
    sys.exit(1)

ENDPOINT = "https://oss-cn-chengdu.aliyuncs.com"
BUCKET = "kazispace-cn-web"
OBJECTS = ("index.html", "404.html")
HEADERS = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-cache",
}


def main() -> int:
    ak = os.environ.get("ali_oss_key_id") or ""
    sk = os.environ.get("ali_oss_key_value") or ""
    if not ak or not sk:
        print(
            "ERROR: missing ali_oss_key_id / ali_oss_key_value "
            f"(id={'yes' if ak else 'no'} val={'yes' if sk else 'no'})",
            file=sys.stderr,
        )
        return 1

    base = Path(__file__).resolve().parent
    auth = oss2.Auth(ak, sk)
    bucket = oss2.Bucket(auth, ENDPOINT, BUCKET)

    for name in OBJECTS:
        path = base / name
        if not path.is_file():
            print(f"ERROR: missing {path}", file=sys.stderr)
            return 1
        data = path.read_bytes()
        result = bucket.put_object(name, data, headers=HEADERS)
        # Optional public-read for CDN origin when Block Public Access is off
        try:
            bucket.put_object_acl(name, oss2.OBJECT_ACL_PUBLIC_READ)
            acl = "public-read"
        except Exception as exc:  # noqa: BLE001 — report without secrets
            acl = f"unchanged ({type(exc).__name__})"
        print(f"uploaded {name} status={result.status} bytes={len(data)} acl={acl}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
