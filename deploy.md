# KaziSpace Staging 浏览器 UAT 与部署验证手册

本文档汇总 **staging 浏览器手工 UAT** 的账号、OTP、Space/Clinic 路径、过程记录与 Jira 报告写法。  
与 **Core API 脚本 UAT** 对齐时，手机号/OTP 以 `kazispace-backend/scripts/uat_fixtures.py` 为 SSOT。

**环境**

| 用途 | URL |
|------|-----|
| Web（浏览器 UAT） | https://kazispace.ai（中文常用 `/zh/login`、`/zh/chat`、`/zh/clinic/hub`） |
| API / 脚本 UAT | https://bot.kazispace.ai |

---

## 1. 测试账号选择

**原则：先读 Jira 票 / UAT 矩阵里的 Fixture，再登录；不要默认「随便一个号」。**

### 1.1 默认（大多数 Clinic / Hub / CV / Router 观测）

| 名称 | 手机号 | OTP | 说明 |
|------|--------|-----|------|
| **Fixture A（China-first）** | `+8613262788342` | `123456` | 落地 `zh` / `CN`；`user_id` 以登录后 `GET /api/v1/me` 为准（历史上常见如 379） |

适合：Hub、Workspace 资产 Rail、一般多轮 Clinic、与 `kazispace-backend` 的 `staging_core_*_uat.py` 对齐的浏览器复现。

### 1.2 隔离 / 专用号（状态写脏后难以恢复）

| 场景 | 号码 | 纪律 |
|------|------|------|
| 与 A 并行、互不污染 | A2：`+8613262788343` | 同 OTP |
| 身份冷启动（禁止 PATCH `full_name` 等） | F：`+8613262788344` | **独占**（如 KAZI-892） |
| `current_status` 从未写过 | G：`+8613262788345` | KAZI-921 / 931 |
| ET 冷态（`preferences.english` 空） | H：`+8613262788346` | ET 写作会写偏好；需 ops 重置 |
| KAZI-492 G1/G4 / G2 | `+8613262788352` / `8351` 等 | 见 backend `docs/uat/KAZI-492-STAGING-UAT.md` |
| Router 等票面条目 | 票上指定（如 831、982） | 与脚本 `STAGING_UAT_PHONE` 一致 |

**经验：** Fixture A 常带 **CV review_confirm / 历史会话**；测干净 leave/stay、G2 intake 时用 **G2 专用号**，避免误判为产品缺陷。

### 1.3 与 kazispace-test 浏览器规则

[kazispace-test：`staging-uat-browser-login.mdc`](https://github.com/Kazispace/kazispace-test/blob/main/.cursor/rules/staging-uat-browser-login.mdc) 仍列 **+7** 系列号，便于 MCP 自动填表。  
**Core / Router 相关浏览器 UAT 请以 +86 China-first 夹具为准**，并与 backend 脚本使用同一号码与 deploy SHA。

---

## 2. OTP 登录

Staging 约定（backend `scripts/uat_fixtures.py`）：

1. **`SMS_PROVIDER=mock`** → 验证码固定 **`123456`**（可用 env `STAGING_UAT_OTP` 覆盖，一般不必）。
2. 手机号须在 staging **`TEST_PHONE_WHITELIST`**；出口 IP 常需 **`TEST_IP_WHITELIST`**，否则可能 **`RATE_LIMIT_EXCEEDED`**（例如 3600s 冷却）。
3. **浏览器步骤**
   - 打开 `/{locale}/login`（如 `/zh/login`）
   - 输入 E.164 手机号（含 `+86`）
   - 点击「获取验证码」
   - 输入 `123456` → 登录
4. 成功后 JWT 在 **cookie `kazi_token`** 与 **localStorage**（双写策略见 Web SDD）。
5. **勿**将 OTP / JWT 写入公开文档或 Jira 附件；报告里写 **Fixture 名 + 手机后四位** 即可。

**排查：** OTP 失败时先确认 **客户端出口 IP** 与 **号码** 均在 staging 白名单。

---

## 3. Space 与 Clinic

- **Clinic** 是系统 Space **`__clinic__`**，不是用户创建的；`/zh/chat` 与 `POST /api/v1/spaces/__clinic__/turn` 同源（design：`docs/sdd/kazi-spaces-v1.0.md`）。
- **新建用户 Space（浏览器）**
  1. 登录 → Space 列表 / 侧栏
  2. 创建并选模板：`blank_conversation` · `job_sprint` · `ielts_prep`
  3. 成功后会进入 `/spaces/{space_id}`，发消息走 `POST /api/v1/spaces/{space_id}/turn`
- **测专家 / Hub（不新建 Space）**
  - 门诊：`/zh/chat`
  - 激活 Cap：Hub 卡片或对话 `activate {cap}` → `POST /api/v1/agents/{id}/activate`
  - Workspace Hub：`/zh/clinic/hub`（资产 Rail 等）

写 Jira 报告时请标明是 **`__clinic__`** 还是 **`sp_*`**，便于对照 Trace。

---

## 4. 过程记录

与 [kazispace-test TEST-PLAN v2.0](https://github.com/Kazispace/kazispace-test/blob/main/docs/TEST-PLAN-v2.0.md) 一致：**PASS/FAIL + 截图或录屏 + 执行人 + 日期**。

### 4.1 Jira / 报告模板

```markdown
## UAT — KAZI-xxxx · YYYY-MM-DD · staging · browser

**环境:** kazispace.ai + bot.kazispace.ai · deploy SHA: `xxxxxxxx`
**夹具:** Fixture A · +8613262788342 · user_id=…（GET /me）

| Step | 操作 | 期望 | 结果 | 证据 |
|------|------|------|------|------|
| 1 | /zh/login → OTP | 进入 /chat | PASS | [01_login.png](Drive链接) |
| 2 | … | … | PASS | [录屏](Drive链接) |

**Trace:** `trc_xxxxxxxx`
**Verdict:** PASS n/n · 备注：…
```

### 4.2 截图 vs 录屏

- 多轮 / 路由 / 澄清：**短录屏**（只录关键轮次）。
- 静态 UI / Hub：**1～3 张截图**（前态 / 问题态 / 后态）。
- 与 **`staging_core_*_uat.py`** 同票时，注明 **同号、同 flag、同 SHA**；仅 FE 差异单独标 **FE-only**。

---

## 5. 截图存 Google Drive（推荐）

1. 目录示例：`KaziSpace/UAT/YYYY-MM/KAZI-xxxx/`
2. 命名：`KAZI982_step03_clarify_card.png`
3. 分享：**知道链接的任何人可查看**（团队内）；避免仅自己可见。
4. 大图 / 录屏放 Drive，**Jira 只贴链接**，避免附件过大难检索。
5. 勿上传含真实 PII 的公开链接。

---

## 6. Jira 评论中的链接

Jira Cloud 评论支持 Markdown：

```markdown
### 证据
- 登录：[01_login.png](https://drive.google.com/file/d/FILE_ID/view?usp=sharing)
- 全流程：[demo.mp4](https://drive.google.com/file/d/FILE_ID/view?usp=sharing)
- 脚本对照：[KAZI-982 comment](https://kazispace.atlassian.net/browse/KAZI-982?focusedCommentId=xxxxx)
- 代码：`kazispace-backend` @ `commit_sha`
```

- 一行一链，链接文字说明步骤含义。
- 需要对比时用表格 **Step | 期望 | 链接**。
- 关联票用 `KAZI-xxx` 或完整 browse URL。

---

## 7. 常见问题

| 现象 | 常见原因 |
|------|----------|
| OTP 限流 | IP / 号不在白名单 |
| 与 API 脚本结论相反 | 账号或 deploy/flag 不一致 |
| Router 像没跑 | 固定 `request_id` 命中 replay；应新会话 |
| Space 行为像 Clinic | 仍在 `__clinic__` 或未进入新建 `sp_*` |
| Trace 对不上 | 未记录 `trc_*` / `user_id` / UTC 时间 |

---

## 8. 延伸阅读

| 主题 | 位置 |
|------|------|
| 手机号 / OTP / 专用号 | `kazispace-backend/scripts/uat_fixtures.py` |
| Staging 脚本 vs 浏览器 | `kazispace-backend/docs/uat/STAGING-UAT-SCRIPTS.md` |
| Space API | `kazispace-design/docs/sdd/kazi-spaces-v1.0.md` |
| Hub 浏览器清单示例 | `kazispace-backend/docs/uat/KAZI-402-WORKSPACE-ASSET-RAIL-UAT.md` |
| UAT 总纲 | [kazispace-test TEST-PLAN v2.0](https://github.com/Kazispace/kazispace-test/blob/main/docs/TEST-PLAN-v2.0.md) |
| MCP 浏览器登录夹具 | [staging-uat-browser-login.mdc](https://github.com/Kazispace/kazispace-test/blob/main/.cursor/rules/staging-uat-browser-login.mdc) |

---

*文档版本：2026-10-09 · 来源：Cloud Agent 浏览器 UAT 实践总结*
