# KaziSpace Web App 前端开发计划 v1.1

**日期**：2026-06-28  
**状态**：Draft（执行用）  
**代码库**：[kazispace-ai](https://github.com/Kazispace/kazispace-ai)  
**设计 SSOT**：[Web App SDD v1.1](https://github.com/Kazispace/kazispace-design/blob/main/docs/sdd/kazispace-web-app-v1.0.md)（[PR #221](https://github.com/Kazispace/kazispace-design/pull/221) 已合并）  
**基线分支**：`dev/next-app`（合并 `fix/next-app-review-fixes` 后开工）  
**后端**：`kazispace-backend` · API `https://bot.kazispace.ai`

### 本地目录（`~/Projects`）

| 路径 | 仓库 | 用途 |
| --- | --- | --- |
| `~/Projects/kazispace-ai` | 前端实现 | 本计划执行仓库；基线分支 `dev/next-app` |
| `~/Projects/kazispace-design` | 设计 / 契约 | SDD、API Spec、UX Guide；`main` 为 SSOT |
| `~/Projects/kazispace-backend` | 后端（可选 clone） | Agent Hub §13 联调 |

```bash
cd ~/Projects/kazispace-ai
git fetch origin
git checkout dev/next-app          # 或 feature 分支
cp .env.local.example .env.local   # NEXT_PUBLIC_API_BASE_URL=https://bot.kazispace.ai
npm install && npm run dev
```

---

## 1. 计划原则（适度）

| 原则 | 说明 |
| --- | --- |
| **先后端契约、后高级特性** | Agent Hub、门诊聊天可用后再做 SSE / 岗位列表 |
| **单页 Clinic 优先** | `/chat` 是 W1 核心；营销页、Dashboard 不阻塞 |
| **可 Mock 并行** | 后端未就绪时 MSW / 静态 JSON 撑 UI，接口字段按 API Spec v2.8 |
| **小步可验收** | 每阶段有 Demo 口径，避免大爆炸集成 |
| **不重复造文档** | 交互细节读 design repo；本文只排期与依赖 |

---

## 2. 现状快照（2026-06-28）

### 2.1 已有（`dev/next-app` + PR #2）

- [x] Next.js 14 骨架、i18n 四语言、Tailwind + shadcn 基元
- [x] 页面占位：`/chat`、`/login`、`/mine`、`/credits`、`/ledger`、`/subscription`、`/profile`
- [x] 基础 `api-client`（OTP、门诊 chat、credits）
- [x] Zustand：`auth` / `chat` / `ui` / `credits`（**未接入页面**）
- [x] `_reference/*.html` 视觉原型

### 2.2 缺口（相对 Web App SDD）

- [ ] **Clinic Shell**：`active_agent` 驱动、门诊/专家 UI 切换
- [ ] **Agent Hub API**：`GET /agents/active`、`activate`、`deactivate`、`POST /agents/chat`
- [ ] **agentStore** + 消息流隔离（`clinicMessages` / `agentMessages`）
- [ ] UX 组件：`AgentCard`、`ReferralPrompt`、`ChatHeader` 双模式、`AgentSwitcher` 等
- [ ] TanStack Query、`react-markdown`、SSE（可 Phase 1b）
- [ ] `/jobs`、CV、Interview 路由与实现
- [ ] TMA `initData` 启动流

---

## 3. 后端依赖矩阵

前端阶段与后端 **最低** 依赖（可并行开发，联调前需满足）：

| 前端阶段 | 必需 API | 后端状态假设 | 前端无后端时的策略 |
| --- | --- | --- | --- |
| **F0 地基** | `GET /health` | 已有 | — |
| **F1 认证** | OTP、`GET /me` | 已有 | Mock JWT |
| **F2 Clinic 门诊** | `POST /chat/messages`、sessions/messages | 已有 / 迭代中 | `_reference/chat.html` 行为对齐 |
| **F3 Agent Hub** | §13 全部 6 个 Agent 端点 | **开发中** | Mock `active_agent` + 静态 Registry YAML |
| **F4 转诊/切换** | activate 返回 `greeting`；deactivate 返回门诊总结 | 依赖 F3 | 本地假数据 |
| **F5 Billing** | `GET /billing/summary`、orders | 部分已有 | 静态 credits 页 |
| **F6 岗位** | `GET /job-recommendations`、`GET /jobs/{id}` | Wave 1 | 延后 |
| **F7 流式** | SSE on chat/agents/chat | **可选** | 同步 JSON Fallback（SDD §9.4） |
| **F8 TMA** | `POST /auth/telegram/webapp` | TMA SDD E2 | 仅浏览器 OTP |

**联调节奏建议**：每周与后端对齐 Agent Hub §13 字段；Staging `bot.kazispace.ai` 冒烟。

---

## 4. 阶段划分（4 个 Sprint，适度）

> 每个 Sprint 以 **可演示** 为结束标准，不绑定日历周数。

---

### Sprint 0 — 地基与合并（阻塞项）

**目标**：可 build、可部署、团队统一分支。

| # | 任务 | 产出 |
| --- | --- | --- |
| 0.1 | 合并 PR #2（`fix/next-app-review-fixes` → `dev/next-app`） | 空文件补齐、Netlify 可 build |
| 0.2 | 统一环境变量：`NEXT_PUBLIC_API_BASE_URL=https://bot.kazispace.ai` | `.env.local.example` |
| 0.3 | 根路由：`/` → `/{locale}/chat`（SDD §4.1） | 减少一步点击 |
| 0.4 | 设计 Token 初版：`tailwind.config.ts`（Navy + 橙；气泡色对齐 UX Guide） | 待产品确认主色后锁定 |
| 0.5 | 引入 `@tanstack/react-query` + Provider；**职责分离**（对齐 SDD v1.1 §2）：TanStack Query 管 `GET /me`、`GET /agents/active`、历史消息拉取；Zustand 管会话内 UI（当前消息流、`isSwitching`、modal） | 基础设施 |
| 0.6 | `components/clinic/` 目录占位 | 与 `components/chat/` 分工 |
| 0.7 | 认证双写骨架：`setAuthToken` 同时写 `localStorage` + `kazi_token` cookie（SDD v1.1 §4.2、§7.2） | middleware 可读 cookie |

**验收**：`npm run build` 通过；Staging 可打开 `/ru/chat`。

**后端依赖**：无。

---

### Sprint 1 — Clinic Shell 门诊模式（P0）

**目标**：用户 30s 内可在门诊发第一条消息；Welcome + 广场可见。

| # | 任务 | 设计依据 |
| --- | --- | --- |
| 1.1 | 重构 `/chat` → `ClinicShell` 组件树 | SDD §8.1 |
| 1.2 | `WelcomeView`：Serík 问候 + `AgentCard[]`（静态 Registry） | UX §3.1、Registry YAML |
| 1.3 | `english_level` chips（可选，写入 profile 或 localStorage） | Clinic Shell §2.2 |
| 1.4 | `ChatHeader` 门诊模式 | UX §7.5 |
| 1.5 | `MessageBubble` + 同步 `POST /chat/messages` | API §chat |
| 1.6 | `useChatStore` 接入页面（替换 `useState`） | SDD §5.3 |
| 1.7 | `ChatInput`：药丸形 24px、Enter 发送 | UX §6.4 |
| 1.8 | 历史消息：`GET /chat/sessions/{id}/messages` | API |
| 1.9 | Guest：`X-Device-ID` + session 持久化；**Guest 不可 `activate` 专家**（卡片 🔒，对齐 SDD §7.3） | User System §3 |
| 1.10 | OTP 登录页打通 `useAuthStore` | SDD §7 |

**暂不实现**：专家切换、SSE、转诊按钮（可显示 disabled）。

**验收**（对齐 SDD §17.1 子集）：

- [ ] Welcome 广场 ≥2 张专家卡片（Career Sprint 标 `Скоро`）
- [ ] 输入框始终可用
- [ ] 门诊消息收发正常
- [ ] 四语言切换正常

**后端依赖**：`POST /chat/messages`、OTP、`GET /me`（可选登录）。

---

### Sprint 2 — Agent Hub 与专家模式（P0）

**目标**：广场点专家 → 1.2s 内切换；可回门诊。

| # | 任务 | 设计依据 |
| --- | --- | --- |
| 2.1 | `agentStore`：`activeAgent`、`isSwitching`、`fetchActiveAgent` | SDD §5.4 |
| 2.2 | API：`getActiveAgent`、`activateAgent`、`deactivateAgent`、`sendAgentChat` | API §13 |
| 2.3 | 消息流隔离：`clinicMessages` + `agentMessages[agentId]` | SDD §5.3 |
| 2.4 | `useAgentSwitch` hook + fade 动画（300+700ms） | UX §8.2 |
| 2.5 | `ChatHeader` 专家模式 + 「← 回门诊」 | UX §3.3 |
| 2.6 | `AgentStatusBar`（Job Search 等有数据时） | UX §7.7 |
| 2.7 | `QuickReplies` chip 组 | UX §7.6 |
| 2.8 | `context_module` 深链 + `popstate` 后退 | SDD §8.3 |
| 2.9 | `AgentSwitcher`（`+` 面板） | UX §3.6 |
| 2.10 | 专家间切换过渡屏：`isSwitching === true` 时**不渲染 Welcome**，仅显示「🔄 Переключение...」过渡画面（SDD v1.1 §8.4、UX §5.3） | UX §5.3 |
| 2.11 | 错误：专家 500 → 回落门诊 + Toast | UX §9.3 |

**验收**：

- [ ] activate / deactivate 联调通过
- [ ] Header、placeholder、消息流随 `active_agent` 切换
- [ ] 浏览器后退 = 回门诊
- [ ] `visitor` 未登录时专家卡片 🔒

**后端依赖**：**Agent Hub §13 全部**（关键路径）。

**并行策略**：后端未就绪时用 Mock Server 返回固定 `greeting`；Registry 读 `src/lib/agents/registry.ts`。

---

### Sprint 3 — 体验补齐 + 账户/计费（P1）

**目标**：转诊、Markdown、账户页真实数据；为岗位模块铺路。

| # | 任务 | 设计依据 |
| --- | --- | --- |
| 3.1 | `ReferralPrompt`（门诊消息内嵌） | UX §3.4、§7.3 |
| 3.2 | 转诊 dismiss 24h（`referralDismissed` localStorage） | Clinic Shell §5.2 |
| 3.3 | `react-markdown` + remark-gfm 渲染助手消息 | SDD §10 |
| 3.4 | SSE 流式（**若后端就绪**）；否则保持同步 + `StreamingText` 假流 | SDD §9 |
| 3.5 | 发送失败：气泡标红 + 重试 | UX §9.1 |
| 3.6 | `/mine`、`/credits`、`/ledger`、`/subscription` 接真实 API | SDD §6 |
| 3.7 | Paywall Modal 骨架（`INSUFFICIENT_CREDITS` / Pro 锁） | PRD §4.5 |
| 3.8 | `middleware.ts`：i18n + 读 `kazi_token` **cookie** 守卫 `/mine` 等；登录 **双写** cookie + localStorage，登出双清（SDD v1.1 §4.2、§7.2） | SDD v1.1 |
| 3.9 | `PROFILE_INCOMPLETE` → Toast 回 Chat，**不**跳阻塞表单 | 平台 BR |

**验收**：

- [ ] 转诊主/次按钮可用
- [ ] Markdown 列表/代码块正常
- [ ] Credits 余额与后端一致
- [ ] Chat 余额不足仍 200 简版（不 402）

**后端依赖**：Billing summary；门诊 LLM 返回转诊结构（或前端解析 intent）。

---

### Sprint 4 — 扩展模块（P2，后端就绪再做）

**目标**：岗位推荐 + CV/Interview 最小可用；TMA 入口。

| 模块 | 任务 | 后端 | 参考 |
| --- | --- | --- | --- |
| **Jobs** | `/jobs` 列表 + `/jobs/[id]` 详情；G7 Pro 锁 UI | `GET /job-recommendations` | PRD §3.3.1、API §8 |
| **CV** | `/cv` 双栏（聊天 + 420px 预览） | `POST /cv/chat` | `_reference/cv.html` |
| **Interview** | `/interview` 回合 UI | `POST /interview/sessions` | `_reference/interview.html` |
| **TMA** | `Telegram.WebApp` initData 登录 + `startapp` 深链 | `/auth/telegram/webapp` | TMA SDD §4–§6 |

**原则**：**任一模块后端未就绪则整模块跳过**，不半成品硬上。

**验收**：按 Dev Checklist 子集逐项勾选。

---

## 5. 人员分工建议（小团队）

| 角色 | Sprint 0–1 | Sprint 2–3 | Sprint 4 |
| --- | --- | --- | --- |
| **前端 A** | ClinicShell、Welcome、MessageBubble | agentStore、切换动画 | Jobs 列表 |
| **前端 B** | Auth、api-client、i18n 补全 | Referral、Markdown/SSE | CV / Interview |
| **联调** | 每周 2 次与后端对 Agent Hub | Staging 端到端 | TMA 真机 |

---

## 6. 风险与缓解

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| Agent Hub 延期 | Sprint 2 阻塞 | Mock + 先完成 UI/动画；联调日对字段 |
| SSE 未实现 | 体验降级 | SDD §9.4 同步 Fallback，不挡上线 |
| 主色未拍板 | Tailwind 返工 | Sprint 0 用 CSS 变量，一处改 token |
| PR #2 未合并 | 重复劳动 | Sprint 0 第一件事合并 |
| 后端 chat 与 agents/chat 字段不一致 | 发送失败 | 严格按 API Spec v2.8 类型生成 |

---

## 7. 里程碑与 Demo 口径

| 里程碑 | 完成标准 | 建议分支 |
| --- | --- | --- |
| **M0** | Staging build 绿 | `dev/next-app` |
| **M1** | 门诊聊天 Demo（中/英/俄） | `feat/clinic-welcome` |
| **M2** | Job Search 专家切换 Demo | `feat/agent-hub` |
| **M3** | 登录 + Credits + 转诊 Demo | `feat/clinic-polish` |
| **M4** | Jobs 或 CV 任一路径 E2E | `feat/jobs` or `feat/cv` |

---

## 8. 文档阅读顺序（开发时）

### 8.1 文档层级（摘自 SDD v1.1 §1.3）

```
PRD v2.0 / API Spec v2.8
        ↓
Web App SDD v1.1（前端工程总纲 — 信实现决策）
        ↓
  ┌─────┼─────┐
  ↓     ↓     ↓
Clinic  UX    TMA
Shell   Guide SDD
```

**冲突时**：PRD / API Spec > Web App SDD > Clinic Shell / UX Guide。

### 8.2 推荐阅读顺序

1. 本文（排期）
2. [Web App SDD v1.1](https://github.com/Kazispace/kazispace-design/blob/main/docs/sdd/kazispace-web-app-v1.0.md) — 实现细节
3. [Clinic Shell SDD](https://github.com/Kazispace/kazispace-design/blob/main/docs/sdd/web-app-clinic-shell-v1.0.md) — `active_agent` 协议
4. [UX Guide](https://github.com/Kazispace/kazispace-design/blob/main/docs/ux/clinic-specialist-ux-guide-v1.0.md) — 视觉走查
5. [API Spec v2.8](https://github.com/Kazispace/kazispace-design/blob/main/docs/api/web-app-api-spec-v2.7.md) — 联调
6. `~/Projects/kazispace-ai/_reference/*.html` — 像素参考

---

## 9. 变更日志

| 版本 | 日期 | 变更 |
| --- | --- | --- |
| v1.0 | 2026-06-28 | 初版：4 Sprint 适度计划，对齐 Web App SDD PR #220 |
| v1.1 | 2026-06-28 | 对齐 SDD v1.1（PR #221）：SSOT 引用、认证双写、TanStack/Zustand 分工、§8.4 过渡屏、Guest 不可 activate、`~/Projects` 本地说明 |

---

*本计划随 backend Agent Hub 与 design repo `main` 同步更新。*
