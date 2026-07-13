# ADR-006 Frontend Freeze Notice

**Date:** 2026-07-13  
**Status:** Active (post v0.1)  
**Design SSOT:** `kazispace-design` ADR-006 (draft) · Epic **KAZI-168** Space Architecture  
**Supersedes (partial):** Session Nav Agent-first UX · `web-app-session-nav-v1.0.md` Agent row semantics

---

## Decision

v0.1 (ADR-005) delivered the **Capability Layer** on FE (Hub chat loop, envelope, navigate-only, per-agent store).  
v0.2 (ADR-006) shifts user mental model to **Clinic + Spaces** — task-centric, not agent-centric.

**Freeze ADR-005 Session Nav Agent-first navigation investment** until Spaces Shell lands.

---

## Do not build (frozen)

1. Session Nav P2+: per-agent history tabs, cross-agent file search as primary IA
2. New dedicated Hub routes or `AGENT_REGISTRY` primary nav rows
3. Agent-switching UX as main information architecture (Switcher, agent badges as top-level nav)
4. `GET /agents/active` as global UI SSOT for sidebar focus

---

## Continue / finish (allowed)

1. ADR-005 navigate-only debt (stray deactivate in hub leave paths)
2. Template-internal depth UI: KAZI-37 CV diff, KAZI-38 prep_card → 求职冲刺 template panels
3. Envelope handling, Clinic cold-open, multi-active badges — rebind to `space_id` when BE ready
4. `useHubAgentChat` + `hub-entry-contract` — reuse inside Space Orchestrator (mode B)

---

## Code mapping

| v0.1 (current) | ADR-006 role |
|----------------|--------------|
| `buildSessionNavRows()` | → `buildSpaceNavRows()` (Clinic + spaces + 新建) |
| `surfaces.ts` | Template-internal rendering only |
| `useHubAgentChat` | Space-internal capability session (mode B) |
| `agent-slice.ts` | → `space-slice.ts` |
| `/cv`, `/interview`, `/english` | Template panels; deprecate as L1 routes after transition |

---

## P1 FE delivery slices

### Phase A — Shell (parallel BE P0.5)

- `/[locale]/spaces/[spaceId]` route
- `buildSpaceNavRows()` replaces agent rows
- Clinic pinned (`/chat` or `/spaces/__clinic__`)
- `+ 新建空间` → template picker (3 templates + Coming soon)

### Phase B — Template workspace (BE P1)

- **空白对话:** chat composer only
- **求职冲刺:** chat + CV / Interview panels (reuse `surfaces.ts`)
- **雅思备考:** chat + EPP panel (reuse english hub)

### Phase C — Lifecycle (BE P1 API)

- Archive / soft-delete (7d) / restore
- Space status badges (replace agent pipeline badges)

---

## Route compatibility

| Legacy | Transition | End state |
|--------|------------|-----------|
| `/chat` | Keep = Clinic | Optional redirect `/spaces/__clinic__` |
| `/cv`, `/interview`, `/english` | Keep 1–2 sprints for deep links | Template-internal or 301 to owning space |

---

## PM decisions (FE)

- **Templates:** 3 official (空白 / 求职冲刺 / 雅思备考); 股票分析 P1.5 — no stock UI shell in picker
- **Bot/TMA:** Clinic-first; suggestion cards use `open_space_deeplink`; no Spaces sidebar in TMA

---

## Jira / docs redirect

| Item | Action |
|------|--------|
| KAZI-140 FE stories (147–153) | Redirect scope → Spaces Shell UX |
| KAZI-147, KAZI-153 | Done; merged into "switch space = navigate-only" |
| `FRONTEND-DEVELOPMENT-PLAN-v1.0.md` F3 Agent Hub | Rename track → Spaces Shell when plan updated |
| New Epic | **KAZI-168** Space Architecture (P0.5–P1 FE/BE) |
