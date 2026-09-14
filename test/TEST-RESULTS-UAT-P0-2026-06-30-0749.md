# KaziSpace Web App — UAT P0 全量执行记录

> **规格 SSOT**：[WEB-APP-TEST-SPEC-v1.0.md](../kazispace-design/docs/test/WEB-APP-TEST-SPEC-v1.0.md) §6 P0  
> **执行脚本**：`test/scripts/run_uat_wa_p0.mjs`  
> **JSON 结果**：`test/results/uat_wa_p0_latest.json`

---

## 执行摘要

| 字段 | 值 |
| --- | --- |
| **测试轮次** | UAT-P0 / `owen` @ `99703c6` |
| **测试日期** | 2026-06-30 07:49 UTC |
| **测试人** | FrontEnd DEV (Playwright headless Chrome) |
| **Web App** | `http://localhost:3000`（`npm run build && npm start`） |
| **API 环境** | `https://bot.kazispace.ai` |
| **浏览器** | Chromium 375×812, locale `ru-RU` |
| **测试账号** | `+77015559920`, OTP `123456`（新注册用户） |

| 指标 | UAT P0 |
| --- | --- |
| P0 总数 | 10 |
| P0 通过 | **10** |
| P0 失败 | **0** |
| 阻塞缺陷 | 1（后端 activate 400，见下文；UAT 以 Mock 完成） |

### 环境说明

本地 UAT 启用 `NEXT_PUBLIC_AGENT_API_MOCK=true`（`.env.local`，未提交）。原因：Staging `POST /api/v1/agents/{id}/activate` 在已登录态返回 **400**（非 404），前端 Mock 降级仅在 404 或显式 mock 开关时触发。无 mock 时 **AGENT-02~05 全部失败**。

`npm run build`（WB NFR-03）在本轮执行前已通过。

---

## 黑盒执行记录（UAT-WA P0）

| 用例 ID | 结果 | 截图 | 备注 |
| --- | --- | --- | --- |
| UAT-WA-AUTH-01 | ✅ PASS | `auth01-guest.png` | Guest 横幅、问候语、3 张专家卡片、发送引导登录 |
| UAT-WA-AUTH-02 | ✅ PASS | `auth02-mine-profile.png` | OTP 登录成功；Mine 显示 `User 320` |
| UAT-WA-AUTH-03 | ✅ PASS | `auth03-after-login-mine.png` | `/mine` → login?redirect= → 登录后回到 Mine |
| UAT-WA-CLINIC-01 | ✅ PASS | `clinic01-first-message.png` | 发送「Привет」收到助手回复 |
| UAT-WA-AGENT-01 | ✅ PASS | `agent01-hub.png` | 欢迎语 + 2 available + 1 coming_soon |
| UAT-WA-AGENT-02 | ✅ PASS | `agent02-job-search.png` | 激活 Job Search；`context_module=job_search`；快速回复可见 |
| UAT-WA-AGENT-03 | ✅ PASS | `agent03-expert-reply.png` | 专家模式发消息收到回复（Mock） |
| UAT-WA-AGENT-04 | ✅ PASS | `agent04-back-clinic.png` | 返回门诊；URL 无 context_module |
| UAT-WA-AGENT-05 | ✅ PASS | `agent05-mock-interview.png` | Job Search ↔ Mock Interview 切换；快速回复随专家变化 |
| UAT-WA-NFR-03 | ✅ PASS | `nfr03-runtime.png` | 无白屏、无未捕获异常；Console 有 2 条 Staging API 网络警告（400/404，Mock 前） |

证据目录：`test/evidence/uat-p0/2026-06-30/`

---

## 缺陷清单

| ID | 用例 | 严重程度 | 标题 | 状态 |
| --- | --- | --- | --- | --- |
| BUG-WA-AGENT-400 | AGENT-02 / NFR-03 | **P0** | `POST /api/v1/agents/{id}/activate` 返回 400，未触发自动 Mock；Console 残留错误 | Open |

**复现**：登录后点击「Открыть」→ Network 见 `activate` 400 → 无 `NEXT_PUBLIC_AGENT_API_MOCK` 时切换失败。

**建议**：后端修复 activate 契约；或前端 `useMockFallback` 扩展至 4xx/5xx。

---

## 结论

| 维度 | 结论 |
| --- | --- |
| **认证 / 门诊** | P0 全绿 |
| **Agent Hub** | Mock 模式下 P0 全绿；**生产/Staging 无 mock 仍阻塞** |
| **NFR-03** | 构建通过；运行时无未捕获异常；Staging API 网络警告已记录 |
| **发布建议** | 认证/门诊 P0 可发布；Agent 需后端修复 activate 400 后方可关闭 Mock |

---

## 签核

| 角色 | 姓名 | 日期 | 签字 |
| --- | --- | --- | --- |
| 工程 | FrontEnd DEV | 2026-06-30 | 自动执行 |
| QA | | | |
| 产品 | | | |
