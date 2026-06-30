# Web App 黑盒测试交接（UAT Agent）

**交接方**：工程白盒 Cloud Agent  
**接收方**：UI Agent（有浏览器 / Telegram WebView 环境）  
**规格**：[WEB-APP-TEST-SPEC-v1.0.md](https://github.com/Kazispace/kazispace-design/blob/main/docs/test/WEB-APP-TEST-SPEC-v1.0.md) §6  
**白盒结果**：[TEST-RESULTS-2026-06-30-0615.md](./TEST-RESULTS-2026-06-30-0615.md)  
**结果模板**：复制 [kazispace-design `WEB-APP-TEST-RESULTS-TEMPLATE.md`](https://github.com/Kazispace/kazispace-design/blob/main/docs/test/WEB-APP-TEST-RESULTS-TEMPLATE.md) → `test/TEST-RESULTS-YYYY-MM-DD-HHmm.md`

---

## 测试环境

| 项 | 值 |
| --- | --- |
| **Web App** | https://kazispace.ai/ （或 Netlify `owen` Preview） |
| **API** | https://bot.kazispace.ai |
| **默认 locale** | `ru` |
| **Free 账号** | `+77015551234` · OTP `123456`（mock） |
| **新用户** | 任意未用过的 `+7` 号 + OTP `123456` |
| **视口** | 375×812（必测）+ 1280×800（抽检） |

---

## 执行范围

执行 **全部 `UAT-WA-*` 用例**（§6），按 Sprint 优先级：

### P0 必测（阻塞签核）

| 用例 ID | 场景 |
| --- | --- |
| UAT-WA-AUTH-01 | Guest 门诊浏览 |
| UAT-WA-AUTH-02 | OTP 登录 |
| UAT-WA-AUTH-03 | 受保护页重定向 |
| UAT-WA-CLINIC-01 | 门诊多轮对话 |
| UAT-WA-CLINIC-03 | Markdown 渲染 |
| UAT-WA-AGENT-01 | 广场激活 Job Search |
| UAT-WA-AGENT-02 | 回门诊 |
| UAT-WA-AGENT-08 | 浏览器后退 |
| UAT-WA-AGENT-09 | 深链 `?agent=job_search` |
| UAT-WA-CLINIC-04 | 转诊接受 |
| UAT-WA-CLINIC-05 | 转诊拒绝 24h |
| UAT-WA-CLINIC-06 | 发送失败重试 |
| UAT-WA-BILL-01 | Credits 余额 |
| UAT-WA-CLINIC-07 | Profile 不完整 Toast |
| UAT-WA-NFR-03 | 部署后无白屏 |
| UAT-WA-J01 | 登录→门诊→专家→回门诊 旅程 |
| UAT-WA-J02 | 深链→对话→后退 旅程 |

### P1 建议本轮回测

| 用例 ID | 场景 |
| --- | --- |
| UAT-WA-AUTH-04~05 | 登出、会话过期 |
| UAT-WA-CLINIC-02 | 历史消息恢复 |
| UAT-WA-AGENT-03~07 | 专家间切换、QuickReplies、Switcher |
| UAT-WA-AGENT-10 | 转诊深链 `?referral=` |
| UAT-WA-BILL-02~05 | 订阅、Paywall、Ledger |
| UAT-WA-NFR-01~02 | 移动端、四语言、深色模式 |
| UAT-WA-J03 | 转诊闭环旅程 |

### BLOCKED（可标 N/A）

| 用例 | 原因 |
| --- | --- |
| UAT-WA-TMA-01~04 | TMA PR #13 未合并；Telegram WebView 待后端 webapp |
| UAT-WA-AGENT-* 部分 | 若后端 §13 未部署，专家切换走 Mock 文案，须在结果中注明 |

---

## 工程白盒已确认（UAT 可聚焦差异）

| 项 | 白盒结论 | UAT 关注 |
| --- | --- | --- |
| OTP API | ✅ PASS | 仅验证 UI 流程与跳转 |
| 门诊 chat 200 | ✅ PASS | 验证气泡、滚动、文案 |
| Agent API | ⊘ BLOCKED (404) | 验证 Mock 降级 UX 是否可接受 |
| 深链 URL | 代码已 `context_module` | 目视确认地址栏规范化 |
| middleware | ✅ `/mine` → login | 验证登录后 redirect 回跳 |
| build | ✅ PASS | Staging 目视无白屏 |

---

## 交付物

1. `test/TEST-RESULTS-YYYY-MM-DD-HHmm.md` — 逐条 UAT 结果 + 截图编号
2. 截图/录屏目录（建议 `test/evidence/uat-YYYYMMDD/`）
3. 缺陷用 `BUG-WA-YYYYMMDD-NN` 格式登记

---

## 注意事项

- **不要**用 `career_mentor` 测深链；有效 ID：`job_search`、`mock_interview`
- `career_sprint` 应为「Скоро / Coming soon」不可激活
- 门诊 Credits 不足时应仍有简版回复，**不应**整页 402
- 四语言抽检：`/en/chat`、`/ru/chat`、`/kk/chat`、`/uz/chat`
