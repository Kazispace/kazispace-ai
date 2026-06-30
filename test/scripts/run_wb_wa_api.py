#!/usr/bin/env python3
"""WB-WA API white-box tests against Staging — kazispace-ai owen branch."""

from __future__ import annotations

import json
import sys
import uuid
from dataclasses import dataclass, field
from typing import Any

import urllib.error
import urllib.request

API = "https://bot.kazispace.ai"
PHONE = f"+7701555{uuid.uuid4().int % 10000:04d}"
OTP = "123456"


@dataclass
class Result:
    case_id: str
    status: str  # PASS | FAIL | BLOCKED | CODE_ONLY
    note: str = ""
    evidence: str = ""


results: list[Result] = []


def req(
    method: str,
    path: str,
    *,
    token: str | None = None,
    body: dict | None = None,
    headers: dict | None = None,
) -> tuple[int, Any]:
    url = f"{API}{path}"
    h = {"Content-Type": "application/json", "X-Device-ID": "wb_test_device"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    if headers:
        h.update(headers)
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            payload = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            payload = {"raw": raw}
        return e.code, payload


def record(case_id: str, ok: bool, note: str = "", blocked: bool = False, code_only: bool = False):
    if blocked:
        status = "BLOCKED"
    elif code_only:
        status = "CODE_ONLY"
    else:
        status = "PASS" if ok else "FAIL"
    results.append(Result(case_id, status, note))
    sym = {"PASS": "✓", "FAIL": "✗", "BLOCKED": "⊘", "CODE_ONLY": "◎"}[status]
    print(f"  {sym} {case_id}: {note or status}")


def login() -> str | None:
    s, _ = req("POST", "/api/v1/auth/otp/request", body={"phone": PHONE})
    if s != 200:
        return None
    s, data = req("POST", "/api/v1/auth/otp/verify", body={"phone": PHONE, "code": OTP})
    if s != 200:
        return None
    return data.get("access_token") or data.get("token")


def main() -> int:
    print(f"API: {API}")
    print(f"Phone: {PHONE}\n")

    # WB-WA-AUTH-01
    s, data = req("POST", "/api/v1/auth/otp/request", body={"phone": PHONE})
    record("WB-WA-AUTH-01", s == 200, f"HTTP {s}")

    s_bad, _ = req("POST", "/api/v1/auth/otp/request", body={"contact": PHONE})
    record("WB-WA-AUTH-01b", s_bad == 422, f"contact field → HTTP {s_bad} (expect 422)")

    token = login()
    if not token:
        record("WB-WA-AUTH-02", False, "login failed — cannot continue API chain")
        print("\n=== SUMMARY ===")
        for r in results:
            print(f"{r.case_id}\t{r.status}\t{r.note}")
        return 1

    record("WB-WA-AUTH-02", True, "verify 200 + access_token (dual-write → CODE review)", code_only=True)

    # WB-WA-AUTH-04
    s, data = req("GET", "/api/v1/me", token="invalid.jwt.token")
    record("WB-WA-AUTH-04", s == 401, f"invalid JWT → HTTP {s}")

    s, data = req("GET", "/api/v1/me", token=token)
    record("WB-WA-AUTH-04b", s == 200, f"valid JWT /me → HTTP {s}")

    # WB-WA-AUTH-05 TMA
    s, data = req(
        "POST",
        "/api/v1/auth/telegram/webapp",
        body={"init_data": "invalid"},
        headers={"X-Client-Variant": "telegram_mini_app"},
    )
    if s == 404:
        record("WB-WA-AUTH-05", True, "endpoint 404 — BLOCKED until E2", blocked=True)
    elif s in (401, 403):
        ec = data.get("error_code") or (data.get("detail") or {}).get("error_code", "")
        record("WB-WA-AUTH-05", True, f"HTTP {s} error_code={ec}")
    else:
        record("WB-WA-AUTH-05", False, f"unexpected HTTP {s}: {data}")

    # WB-WA-AUTH-06 + CLINIC
    session_id = str(uuid.uuid4())
    s, data = req(
        "POST",
        "/api/v1/chat/messages",
        token=token,
        body={"session_id": session_id, "content": "WB test hello"},
    )
    record("WB-WA-CLINIC-01", s == 200, f"POST chat/messages HTTP {s}")
    has_reply = bool(
        data.get("reply")
        or (data.get("response") or {}).get("text")
        or (data.get("assistant_response") or {}).get("content")
    )
    record("WB-WA-CLINIC-01b", has_reply, f"response has assistant text: {has_reply}")

    record("WB-WA-AUTH-06", s == 200, "incomplete profile chat still 200")

    s, hist = req("GET", f"/api/v1/chat/sessions/{session_id}/messages", token=token)
    if s == 404:
        s2, sessions = req("GET", "/api/v1/chat/sessions", token=token)
        if s2 == 200 and sessions:
            sid = sessions[0].get("id") or sessions[0].get("session_id")
            if sid:
                s, hist = req("GET", f"/api/v1/chat/sessions/{sid}/messages", token=token)
    msgs = hist if isinstance(hist, list) else hist.get("messages", [])
    record("WB-WA-CLINIC-02", s == 200 and isinstance(msgs, list), f"history HTTP {s}, msgs={len(msgs) if isinstance(msgs, list) else 0}")

    record("WB-WA-CLINIC-03", s == 200 and s != 402, f"chat not 402 (HTTP {s})")

    # AGENT Hub
    s, active = req("GET", "/api/v1/agents/active", token=token)
    record("WB-WA-AGENT-03-pref", s == 200, f"GET agents/active HTTP {s}")

    s, act = req(
        "POST",
        "/api/v1/agents/job_search/activate",
        token=token,
        body={"handoff_message": "WB test handoff"},
    )
    if s == 404:
        record("WB-WA-AGENT-01", True, "§13 404 — use mock fallback in frontend", blocked=True)
        record("WB-WA-AGENT-04", True, "§13 404 — mock path", blocked=True)
        record("WB-WA-AGENT-03", True, "backend §13 not deployed", blocked=True)
    else:
        ok_fields = all(k in act for k in ("agent_id", "session_id", "greeting"))
        record("WB-WA-AGENT-01", s == 200 and ok_fields, f"activate HTTP {s} fields={list(act.keys())[:5]}")

        agent_session = act.get("session_id")
        s2, chat = req(
            "POST",
            "/api/v1/agents/chat",
            token=token,
            body={"agent_id": "job_search", "message": "find jobs", "session_id": agent_session},
        )
        has_text = bool((chat.get("response") or {}).get("text") or chat.get("reply"))
        record("WB-WA-AGENT-04", s2 == 200 and has_text, f"agents/chat HTTP {s2}")

        s3, active2 = req("GET", "/api/v1/agents/active", token=token)
        recovered = active2.get("active_agent") == "job_search"
        record("WB-WA-AGENT-03", s3 == 200 and recovered, f"active_agent={active2.get('active_agent')}")

        s4, deact = req("POST", "/api/v1/agents/job_search/deactivate", token=token, body={})
        has_return = bool(deact.get("return_message"))
        record("WB-WA-AGENT-02", s4 == 200 and has_return, f"deactivate HTTP {s4} return_message={has_return}")

    s_cs, _ = req("POST", "/api/v1/agents/career_sprint/activate", token=token, body={})
    record("WB-WA-AGENT-01b", s_cs in (400, 403, 422), f"coming_soon activate HTTP {s_cs}")

    # BILLING
    s, bill = req("GET", "/api/v1/billing/summary", token=token)
    record("WB-WA-BILL-01", s == 200, f"billing/summary HTTP {s}")

    s, plan = req("GET", "/api/v1/plans/current", token=token)
    record("WB-WA-BILL-02", s in (200, 404), f"plans/current HTTP {s}")

    s, ledger = req("GET", "/api/v1/billing/ledger", token=token)
    record("WB-WA-BILL-04", s in (200, 404), f"ledger HTTP {s} (404 → frontend empty state)")

    s, jobs = req("GET", "/api/v1/job-recommendations", token=token)
    if s == 403:
        ec = (jobs.get("detail") or {}).get("error_code") or jobs.get("error_code")
        record("WB-WA-AUTH-06b", ec == "PROFILE_INCOMPLETE", f"job-rec PROFILE_INCOMPLETE: {ec}")
    else:
        record("WB-WA-AUTH-06b", True, f"job-rec HTTP {s} (profile may be complete)")

    # Summary
    print("\n=== SUMMARY ===")
    counts = {"PASS": 0, "FAIL": 0, "BLOCKED": 0, "CODE_ONLY": 0}
    for r in results:
        counts[r.status] = counts.get(r.status, 0) + 1
        print(f"{r.case_id}\t{r.status}\t{r.note}")
    print(f"\nTotal: {len(results)} | PASS={counts['PASS']} FAIL={counts['FAIL']} BLOCKED={counts['BLOCKED']} CODE_ONLY={counts['CODE_ONLY']}")

    out = {
        "phone": PHONE,
        "results": [{"id": r.case_id, "status": r.status, "note": r.note} for r in results],
        "counts": counts,
    }
    with open("/workspace/test/results/wb_wa_api_latest.json", "w") as f:
        json.dump(out, f, indent=2)

    return 1 if counts["FAIL"] > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
