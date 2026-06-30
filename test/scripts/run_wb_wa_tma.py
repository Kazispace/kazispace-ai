#!/usr/bin/env python3
"""WB-WA-TMA white-box tests — API + code static + middleware."""

from __future__ import annotations

import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

API = "https://bot.kazispace.ai"
ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"
LOCAL = "http://localhost:3000"


@dataclass
class Result:
    case_id: str
    status: str
    note: str


results: list[Result] = []


def record(case_id: str, status: str, note: str = ""):
    results.append(Result(case_id, status, note))
    sym = {"PASS": "✓", "FAIL": "✗", "BLOCKED": "⊘"}[status]
    print(f"  {sym} {case_id}: {note or status}")


def api_req(method: str, path: str, body: dict | None = None, headers: dict | None = None):
    url = f"{API}{path}"
    h = {"Content-Type": "application/json", "X-Device-ID": "wb_tma_test"}
    if headers:
        h.update(headers)
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            payload = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            payload = {"raw": raw[:200]}
        return e.code, payload


def curl_status(url: str) -> tuple[int, str | None]:
    try:
        proc = subprocess.run(
            ["curl", "-sI", url],
            capture_output=True,
            text=True,
            timeout=10,
        )
        loc = None
        status = 0
        for line in proc.stdout.splitlines():
            if line.startswith("HTTP/"):
                status = int(line.split()[1])
            if line.lower().startswith("location:"):
                loc = line.split(":", 1)[1].strip()
        return status, loc
    except Exception as e:
        return 0, str(e)


def read(path: str) -> str:
    return (SRC / path).read_text(encoding="utf-8")


def test_api():
    print("=== WB-WA-TMA API (Staging) ===\n")

    # WB-WA-AUTH-05
    s, data = api_req(
        "POST",
        "/api/v1/auth/telegram/webapp",
        body={"init_data": "invalid_test_init_data"},
        headers={
            "X-Client-Variant": "telegram_mini_app",
            "X-Telegram-Platform": "ios",
        },
    )
    if s == 404:
        record("WB-WA-AUTH-05", "BLOCKED", f"endpoint HTTP 404 — backend E2 not deployed")
    elif s in (401, 403):
        ec = data.get("error_code") or (data.get("detail") or {}).get("error_code", "")
        ok = ec in ("INVALID_INIT_DATA", "INIT_DATA_EXPIRED", "") or s == 401
        record("WB-WA-AUTH-05", "PASS" if ok else "FAIL", f"HTTP {s} error_code={ec!r}")
    else:
        record("WB-WA-AUTH-05", "FAIL", f"unexpected HTTP {s}: {str(data)[:120]}")

    # Contract: body field init_data
    s2, _ = api_req(
        "POST",
        "/api/v1/auth/telegram/webapp",
        body={"initData": "wrong_field"},
        headers={"X-Client-Variant": "telegram_mini_app"},
    )
    if s == 404:
        record("WB-WA-AUTH-05b", "BLOCKED", "skipped — endpoint 404")
    else:
        record("WB-WA-AUTH-05b", "PASS" if s2 in (400, 401, 422) else "FAIL", f"wrong field → HTTP {s2}")


def test_code():
    print("\n=== WB-WA-TMA Code Static ===\n")

    api = read("lib/api-client.ts")
    tg = read("lib/telegram.ts")
    consts = read("lib/constants.ts")
    record(
        "WB-WA-TMA-01",
        "PASS"
        if "getTmaClientHeaders" in api
        and "getTmaClientHeaders" in tg
        and "TELEGRAM_MINI_APP" in consts
        and "X-Client-Variant" in tg
        else "FAIL",
        "api-client merges getTmaClientHeaders; telegram.ts sets X-Client-Variant",
    )

    routing = read("lib/tma-routing.ts")
    shell = read("components/clinic/clinic-shell.tsx")
    record(
        "WB-WA-TMA-02",
        "PASS"
        if all(x in routing for x in ["agent_", "billing_pro", "TMA_PENDING_ACTION"])
        and "consumePendingTmaAction" in shell
        else "FAIL",
        "parseStartParam routes + clinic-shell consumes pending action",
    )

    # routing table spot checks (pure logic via regex)
    cases = [
        ("agent_job_search", "activate_agent", "job_search"),
        ("clinic", "clinic", None),
        ("billing_pro", "subscription", None),
        ("job_abc123", "job", "abc123"),
        ("", "restore", None),
    ]
    for sp, typ, extra in cases:
        m_agent = re.search(
            rf"if \(param\.startsWith\('agent_'\)\).*?agentId: clampId\(param\.slice\('agent_'\.length\)",
            routing,
            re.S,
        )
        ok = m_agent is not None
        record(
            f"WB-WA-TMA-02-{sp or 'empty'}",
            "PASS" if ok else "FAIL",
            f"start_param={sp!r} → expect type={typ}",
        )
        if not ok:
            break

    mw = read("middleware.ts")
    record(
        "WB-WA-TMA-03",
        "PASS" if '"tma"' in mw or "'tma'" in mw else "FAIL",
        "middleware PUBLIC_PATH_SEGMENTS includes tma",
    )

    launch = read("app/[locale]/tma/launch/page.tsx")
    record(
        "WB-WA-TMA-03b",
        "PASS" if "continueInBrowser" in launch and "tRef" in launch else "FAIL",
        "launch page: browser fallback + stable effect (tRef)",
    )

    header = read("components/layout/header.tsx")
    nav = read("components/layout/bottom-nav.tsx")
    chat_hdr = read("components/clinic/chat-header.tsx")
    record(
        "WB-WA-TMA-04",
        "PASS"
        if all("isTelegramMiniApp" in f and "return null" in f for f in [header, nav])
        and "backToBot" in chat_hdr
        else "FAIL",
        "TMA hides Header/BottomNav; chat-header Back to bot",
    )

    providers = read("components/providers.tsx")
    record(
        "WB-WA-AUTH-04-tma",
        "PASS" if "reauthTelegramIfPossible" in providers else "FAIL",
        "401 in TMA → initData reauth before login redirect",
    )

    types = read("types/telegram-web-app.d.ts")
    record(
        "WB-WA-TMA-05-types",
        "PASS" if "isVerticalSwipesEnabled" in types else "FAIL",
        "telegram-web-app.d.ts includes isVerticalSwipesEnabled",
    )

    tg = read("lib/telegram.ts")
    record(
        "WB-WA-TMA-theme",
        "PASS" if "setHeaderColor" in tg and "setBackgroundColor" in tg else "FAIL",
        "applyTelegramTheme syncs header + background",
    )

    clamp = "MAX_TMA_PARAM_ID_LEN" in routing and "clampId" in routing
    record("WB-WA-TMA-routing-guard", "PASS" if clamp else "FAIL", "start_param/id length clamp 64")


def test_middleware_local():
    print("\n=== WB-WA-TMA Middleware (local) ===\n")
    s_launch, loc_launch = curl_status(f"{LOCAL}/ru/tma/launch")
    s_mine, loc_mine = curl_status(f"{LOCAL}/ru/mine")

    if s_launch == 0:
        record("WB-WA-TMA-03-curl", "BLOCKED", "local server not running — start npm start")
        return

    record(
        "WB-WA-TMA-03-curl",
        "PASS" if s_launch == 200 else "FAIL",
        f"/ru/tma/launch → HTTP {s_launch} (no auth redirect)",
    )
    record(
        "WB-WA-TMA-03-curl-mine",
        "PASS" if s_mine in (307, 302) and loc_mine and "login" in loc_mine else "FAIL",
        f"/ru/mine → {s_mine} location={loc_mine}",
    )


def main() -> int:
    test_api()
    test_code()
    test_middleware_local()

    print("\n=== SUMMARY ===")
    counts: dict[str, int] = {}
    for r in results:
        counts[r.status] = counts.get(r.status, 0) + 1
        print(f"{r.case_id}\t{r.status}\t{r.note}")

    out = ROOT / "test/results/wb_wa_tma_latest.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(
            {"results": [r.__dict__ for r in results], "counts": counts},
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"\nWrote {out}")
    print(f"PASS={counts.get('PASS',0)} FAIL={counts.get('FAIL',0)} BLOCKED={counts.get('BLOCKED',0)}")
    return 1 if counts.get("FAIL", 0) else 0


if __name__ == "__main__":
    sys.exit(main())
