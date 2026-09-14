#!/usr/bin/env python3
"""WB-WA static code verification — kazispace-ai owen."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"

results: list[tuple[str, str, str]] = []


def check(case_id: str, ok: bool, note: str, code_only: bool = True):
    status = "PASS" if ok else "FAIL"
    if not ok and "BLOCKED" in note:
        status = "BLOCKED"
    results.append((case_id, status, note))
    sym = {"PASS": "✓", "FAIL": "✗", "BLOCKED": "⊘"}[status]
    print(f"  {sym} {case_id}: {note}")


def read(path: str) -> str:
    return (SRC / path).read_text(encoding="utf-8")


def main() -> int:
    print("Static code verification (owen)\n")

    auth = read("lib/auth.ts")
    check(
        "WB-WA-AUTH-02",
        "kazi_auth_token" in auth and "kazi_token" in auth and "setCookie" in auth,
        "dual-write localStorage + cookie in auth.ts",
    )

    mw = read("middleware.ts")
    check(
        "WB-WA-AUTH-03",
        "AUTH_COOKIE" in mw and "login" in mw and "redirect" in mw,
        "middleware redirects to login with redirect param",
    )
    check(
        "WB-WA-AUTH-03b",
        '"chat"' in mw and "PUBLIC_PATH_SEGMENTS" in mw,
        "/chat is public path",
    )
    tma_public = "tma" in mw.lower()
    check(
        "WB-WA-TMA-03",
        tma_public,
        "tma in middleware public paths" if tma_public else "tma NOT in middleware — TMA branch not on owen",
        code_only=not tma_public,
    )
    if not tma_public:
        results[-1] = ("WB-WA-TMA-03", "BLOCKED", "TMA not merged to owen; middleware lacks /tma/*")

    api = read("lib/api-client.ts")
    check(
        "WB-WA-CLINIC-01",
        'session_id' in api and "content" in api and "sendChatMessage" in api,
        "sendChatMessage uses session_id + content",
    )
    check(
        "WB-WA-CLINIC-04",
        "REFERRAL_" in api and "referral_agent_id" in api and "isReferralDismissed" in api,
        "parseClinicReply handles REFERRAL_ intent + dismiss",
    )
    check(
        "WB-WA-BILL-01",
        "/api/v1/billing/summary" in api,
        "getBillingSummary → /billing/summary",
    )
    check(
        "WB-WA-BILL-02",
        "/api/v1/plans/current" in api,
        "getCurrentPlan → /plans/current",
    )
    check(
        "WB-WA-BILL-04",
        "billing/ledger" in api and "entries: []" in api,
        "ledger 404 → empty entries fallback",
    )

    agent = read("lib/agent-api.ts")
    check(
        "WB-WA-AGENT-01",
        "handoff_message" in agent and "trigger_message" not in agent,
        "activate uses handoff_message not trigger_message",
    )
    check(
        "WB-WA-AGENT-04",
        "response?.text" in agent or "response?.text ?? data.reply" in agent,
        "parseAgentReply reads response.text",
    )
    check(
        "WB-WA-AGENT-07",
        "mockActivate" in agent and "useMockFallback" in agent,
        "mock fallback when §13 404",
    )

    switch = read("hooks/use-agent-switch.ts")
    check(
        "WB-WA-AGENT-05",
        "context_module" in switch and "params.get('agent')" in switch,
        "deep link reads agent OR context_module; pushState sets context_module",
    )
    check(
        "WB-WA-AGENT-06",
        "stripAgentParamsFromUrl" in switch and "delete('context_module')" in switch,
        "popstate/back clears context_module via replaceState",
    )
    check(
        "WB-WA-AGENT-02",
        "return_message" in switch and "addClinicMessage" in switch,
        "deactivate return_message → clinic store",
    )

    clinic = read("hooks/use-clinic-chat.ts")
    check(
        "WB-WA-CLINIC-05",
        "retryMessageId" in clinic and "status: 'failed'" in clinic,
        "retry reuses message id; failed status on error",
    )
    check(
        "WB-WA-BILL-03",
        "openPaywall" in clinic and "isPaywallError" in clinic,
        "paywall errors trigger openPaywall in clinic hook",
    )
    check(
        "WB-WA-AUTH-06",
        "isProfileIncomplete" in clinic or "PROFILE_INCOMPLETE" in clinic,
        "profile incomplete → toast not block",
    )

    ref = read("lib/referral-dismiss.ts")
    check(
        "WB-WA-CLINIC-04b",
        "REFERRAL_DISMISSED" in ref or "kazi_referral_dismissed" in ref,
        "referral dismiss localStorage key",
    )

    errors = read("lib/api-errors.ts")
    check(
        "WB-WA-BILL-03b",
        all(c in errors for c in ["INSUFFICIENT_CREDITS", "PRO_FEATURE_LOCKED", "PROFILE_INCOMPLETE"]),
        "api-errors.ts covers paywall + profile codes",
    )

    # TMA headers — only if files exist
    tma_files = list(SRC.rglob("*telegram*")) + list(SRC.rglob("*tma*"))
    if tma_files:
        combined = "\n".join(p.read_text(encoding="utf-8") for p in tma_files if p.is_file())
        check(
            "WB-WA-TMA-01",
            "telegram_mini_app" in combined or "X-Client-Variant" in combined,
            "TMA client variant header in code",
        )
    else:
        check("WB-WA-TMA-01", False, "TMA code not on owen branch", code_only=False)
        results[-1] = ("WB-WA-TMA-01", "BLOCKED", "TMA PR #13 not merged")

    print("\n=== SUMMARY ===")
    fail = 0
    for case_id, status, note in results:
        print(f"{case_id}\t{status}\t{note}")
        if status == "FAIL":
            fail += 1
    return fail


if __name__ == "__main__":
    sys.exit(main())
