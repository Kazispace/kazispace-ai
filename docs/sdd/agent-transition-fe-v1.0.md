# Agent Transition FE SDD v1.0

**Jira:** KAZI-124  
**日期:** 2026-07-10  
**状态:** 已被 [agent-transition-fe-v1.1.md](./agent-transition-fe-v1.1.md) 取代（Draft，待 Review）  
**说明:** v1.0 偏实现导向；请先 Review v1.1 中「手动 / 自动」分轨与 UI 方案后再编码。
**代码库:** kazispace-ai  
**设计 SSOT（BE / 产品）:** [agent-switching-ux-v1.0.md](https://github.com/Kazispace/kazispace-design/blob/docs/kazi-118-expert-switching-ux/docs/architecture/agent-switching-ux-v1.0.md)  
**依赖 BE:** Gateway §4.5 / §4.6 · `GET/POST /agents/active|activate|deactivate|chat`

---

## 1. 背景与问题

### 1.1 产品模型

```
┌─────────────────────────────────────────────────────────┐
│  Clinic（门诊 /chat）                                    │
│  · 无 active agent 或 in-clinic 专家（job_search …）     │
└─────────────────────────────────────────────────────────┘
         │ manual / NL / Path C
         ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ CV /cv       │  │ Interview    │  │ English /en  │
│ cv_builder   │  │ mock_interview│ │ english_tutor│
└──────────────┘  └──────────────┘  └──────────────┘
      Dedicated Hub Surfaces（独立页面壳）
```

### 1.2 现状问题

| 问题 | 影响 |
|------|------|
| 切换逻辑分散在 `clinic-shell`、`use-cv-agent`、`agent-escalation` | 同类切换有时成功有时失败 |
| Hub 页无统一手动切换入口 | 用户困在错误 Surface |
| 导航 `push`/`replace`、deactivate 顺序各页面自行决定 | Back 回到已 exit session |
| NL / UI / Path C 三套消费路径 | 修一处漏一处 |

### 1.3 目标

1. **Clinic ↔ 子 Agent** 与 **子 Agent ↔ 子 Agent** 共用一条 FE 切换管道。  
2. **手动点击**（Path B）体验顺畅：预检 → 确认 → Overlay → deactivate → activate → 导航。  
3. NL Escalation（Path A）、Path C 汇入同一 execute 链，仅 confirm 策略不同。  
4. 新 Hub 页接入成本 = 注册 Surface + 使用 `useAgentTransition`。

---

## 2. 术语

| 术语 | 含义 |
|------|------|
| **Agent** | 业务专家 ID（`job_search`、`cv_builder` …） |
| **Surface** | UI 壳：路由 + 布局（`clinic` / `cv` / `interview` / `english`） |
| **Transition** | 一次完整的「离开当前专家 → 激活目标 → 展示目标 UI」 |
| **Orchestrator** | `runAgentTransition` — FE SSOT 执行器 |
| **Path A** | NL Escalation：`exited` + `suggested_next_steps`，跳过 confirm |
| **Path B** | UI 手动切换：预检 active → 必要时 confirm |
| **Path C** | `pending_transition` 确认后切换 |

---

## 3. 架构

### 3.1 模块

```
src/lib/agent-transition/
  types.ts           # TransitionRequest / Result / Trigger
  surfaces.ts        # Agent ↔ Surface 注册表
  navigation.ts      # 导航矩阵 planNavigation()
  orchestrator.ts    # runAgentTransition() + executeActivate()
  chat-side-effects.ts  # handleAgentChatSideEffects() [Phase 2]

src/hooks/
  use-agent-transition.ts   # 唯一 React 入口 [Phase 1 薄包装 useAgentSwitch]

src/components/agent-transition/
  agent-transition-provider.tsx  # Overlay + Dialog + multi-tab [Phase 3]
```

### 3.2 数据流

```
Trigger (UI | NL | Path C | sync)
    → useAgentTransition.requestTransition()
    → runAgentTransition()
         1. precheck (GET /agents/active)
         2. [Path B] needs_confirm → store pending → dialog
         3. setSwitching(true)
         4. deactivate(current) if needed
         5. activate(target) | clear for clinic
         6. planNavigation(fromSurface, target) → router.replace
         7. hydrate (greeting / handoff / history)
         8. publishActiveAgentSync
         9. setSwitching(false)
```

### 3.3 导航矩阵（SSOT）

规则：

- **目标 = Clinic**（`targetAgentId === null`）→ 始终 `replace /{locale}/chat`
- **目标 Surface = 当前 Surface** 且 in-clinic → **不导航**（Clinic 内换专家）
- **否则** → `replace` 到目标 Surface 路径
- Escalation / 手动切换均 **`replace`**（禁止 `push`，避免回到已 exit session）

| From \ To | Clinic | in-clinic | cv | interview | english |
|-----------|--------|-----------|-----|-----------|---------|
| clinic | — | none | /cv | /interview | /english |
| cv | /chat | /chat | — | /interview | /english |
| interview | /chat | /chat | /cv | — | /english |
| english | /chat | /chat | /cv | /interview | — |

---

## 4. API 设计

### 4.1 `planNavigation`

```typescript
planNavigation(
  locale: string,
  fromSurface: AgentSurfaceId,
  targetAgentId: string | null
): NavigationPlan

interface NavigationPlan {
  shouldNavigate: boolean;
  href: string | null;
  targetSurface: AgentSurfaceId;
}
```

### 4.2 `runAgentTransition`

```typescript
interface TransitionRequest {
  targetAgentId: string | null;
  trigger: 'ui' | 'nl_escalation' | 'pending_confirm' | 'deep_link' | 'sync';
  locale: string;
  fromSurface: AgentSurfaceId;
  knownActiveAgentId?: string | null;
  handoffMessage?: string;
  skipConfirm?: boolean;
}

type TransitionResult =
  | { status: 'ok'; resumed?: boolean; hub?: boolean }
  | { status: 'needs_confirm'; fromAgentId: string; toAgentId: string }
  | { status: 'error'; error?: string };
```

### 4.3 `useAgentTransition`

```typescript
const {
  requestTransition,      // Path B manual + programmatic
  confirmPendingTransition,
  cancelPendingTransition,
  isSwitching,
  pendingConfirm,
  fromSurface,
} = useAgentTransition(locale);
```

### 4.4 Chat 侧效应（Phase 2）

```typescript
handleAgentChatSideEffects(res, { userText, fromSurface })
  → { type: 'reply' | 'pending' | 'transition', ... }
```

---

## 5. 与 BE 契约

| FE 步骤 | BE API |
|---------|--------|
| precheck | `GET /api/v1/agents/active` |
| deactivate | `POST /api/v1/agents/{id}/deactivate` |
| activate | `POST /api/v1/agents/{id}/activate` |
| NL 触发 | `POST /api/v1/agents/chat` → `exited`, `suggested_next_steps` |
| Path C | 同上 → `pending_transition` |

FE **不得** A→B 直跳；必须先 deactivate（或 BE 已在 turn 内 exit）。

---

## 6. UX 规范

| 项 | 规范 |
|----|------|
| 切换动画 | 全局 `SwitchingOverlay`：fade out 300ms → execute → fade in 700ms |
| Path B 确认 | `AgentSwitchDialog`：「结束 X，切换到 Y？」 |
| 切换中 | 输入禁用；重复点击忽略 |
| 失败 | Toast + 保持当前 Surface；不 silent fail |
| Hub handoff | CV：`setCvAgentHandoff` 在 navigate `/cv` 前 |

---

## 7. 迁移阶段

| Phase | 内容 | PR |
|-------|------|-----|
| **0** | SDD + `surfaces` + `navigation` + types | 本 PR |
| **1** | `useAgentSwitch` 接入 `planNavigation`；`fromSurface` 上下文 | 本 PR |
| **2** | `handleAgentChatSideEffects`；CV/clinic 统一 | +1 |
| **3** | Hub 页 `AgentTransitionProvider` + `HubLayerBar` + Switcher/Dialog/Overlay | 本 PR |
| **4** | Clinic 迁入 Provider；删除 escalation recovery 补丁 | +1 |

---

## 8. 验收（手动 Path B）

1. Clinic 点 job_search → 同页 expert 模式，Overlay。  
2. Clinic 点 CV → `/cv` + session ready。  
3. CV 点回门诊 → `/chat` + clinic。  
4. CV Switcher → Interview → confirm → `/interview`。  
5. Interview → job_search → confirm → `/chat` + job_search。  
6. 409 → confirm 后成功。  
7. 切换中 double-tap → 无重复 activate。

---

## 9. 非目标（v1.0）

- 不做 SPA 内嵌 Hub（仍用独立路由页）。  
- 不改变 BE Gateway 路由优先级。  
- Interview `useInterview` 专用 API 不重写为 agents/chat（Phase 3 仅接 switcher）。

---

## 10. 变更记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-07-10 | 初稿：Orchestrator + 导航矩阵 + 迁移计划 |
