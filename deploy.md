# Staging 浏览器 UAT（实测）

本文是 us-west staging 上 **浏览器走产品面** 的操作手册，来自 2026-10-09 KAZI-1044 / KAZI-1041 一类票的复测，不是理论清单。

手机号 / OTP 的 SSOT 仍是 `kazispace-backend/scripts/uat_fixtures.py`。这里只写 **浏览器里实际会发生什么**，以及脚本 UAT 对不上时该怎么开页。

---

## 0. 先选对入口

| 用途 | URL | 什么时候用 |
|------|-----|------------|
| 未合入 / 刚合入、要验 **owen 上的 FE** | `https://owen--kazispace.netlify.app` | 票面写「须含某 sha / 不要用 kazispace.ai」时 **必须用这个** |
| 已发布到生产前端 | `https://kazispace.ai` | 只验已经打到这个 host 的构建 |
| API / 脚本 UAT / Trace | `https://bot.kazispace.ai` | 后端 us-west staging |

KAZI-1041 写回 13515 用错过入口：`kazispace.ai` 上的 JS 没有票面要验的 FE 提交。KAZI-1044 派单写明前端用 owen Netlify、须含 `d336261`。

核 FE 是否对：打开站点 JS，搜票面关键字（例如 `writing_revision`、`修改后重新提交`）。不要用 `/health` 当「已部署」依据；后端 SHA 只认主机 `git rev-parse HEAD`。

中文产品面一律走 `/{locale}`，localePrefix 是 `always`。China-first 夹具用 **`/zh`**。

---

## 1. 账号

默认 **Fixture A**：

| 项 | 值 |
|----|----|
| 手机 | `+8613262788342` |
| OTP | `123456`（staging `SMS_PROVIDER=mock`） |
| locale / country | `zh` / `CN` |
| 落地用户 | `GET /api/v1/me` 为准；这台 us-west 上常见 `user_id=379` |

只填国家号 `13262788342` **过不了** 前端校验：`isValidOtpPhone` 要求 `+7` / `+998` / `+86` 的 E.164。登录页 placeholder 是 `+8613800138000`，按钮文案是「发送验证码」不是「获取验证码」。

其它夹具（A2 / F / G / H 等）只在票面点名时用，见 backend `uat_fixtures.py`。不要为了「干净一点」自己换号。

---

## 2. OTP：两条路

### 2.1 页面上点

1. 打开 `{FE}/zh/login`。
2. 手机号框填 **完整 E.164**。
3. 点「发送验证码」。成功后切到验证码步（一个 6 位框，placeholder `000000`）。
4. 填 `123456`，点「验证」。
5. 登录成功会 `replace` 到 `redirect` 或 `/{locale}/chat`。Fixture A 的 `primary_locale` 会把 locale 钉在 `zh`。

这一步在 **owen Netlify → bot.kazispace.ai** 上，真 Chrome **经常走不通**，见 §3。页面会出「网络错误」（i18n `login.networkError`），Network 里是 `net::ERR_FAILED`。

### 2.2 API 拿 token，再注入会话（自动化兜底）

从任意能打到 bot 的环境（本机脚本、CI、关了 CORS 的浏览器都可）：

```http
POST https://bot.kazispace.ai/api/v1/auth/otp/request
{"phone":"+8613262788342"}
```

记下 `otp_request_id`，再：

```http
POST https://bot.kazispace.ai/api/v1/auth/otp/verify
{"phone":"+8613262788342","otp_code":"123456","otp_request_id":"…","locale":"zh","country":"CN"}
```

回包里要用的字段：`access_token`、`user`、`home_api_base`、`data_region`、`directory_version`。us-west 上一般是 `home_api_base=https://bot.kazispace.ai`、`data_region=global`、`directory_version` 为数字（实测过 4）。

然后 **三件事一起做**，少一件就会被踢回登录页：

1. `localStorage.kazi.region.session` =  
   `{ token, home_api_base, data_region, directory_version }`  
   四个字段都要合法。`home_api_base` 必须在前端 bundled directory 里（`isKnownApiBase`），`data_region` 只能是 `global` 或 `cn-mainland`，且必须和 directory 那一行一致。缺字段或类型不对，`getSession()` 会整包清掉。
2. Cookie `kazi_token` = 同一个 token（`path=/`、`Secure`、`SameSite=Lax`，domain 写成当前 FE host，例如 `owen--kazispace.netlify.app`）。middleware 只看这颗 cookie，不看 localStorage；`/spaces/*`、`/clinic/*` 不在公开名单里，没 cookie 直接 302 到 `/zh/login?redirect=…`。
3. `localStorage.kazi_user_info` = verify / `/me` 的 user。可有可无，但注入后 `/me` 失败时前端会清会话，所以 cookie + region session 之后 **立刻打一次 `/me` 必须 200**。

不要只写 `kazi_auth_token`。`setRegionAuthSession` 会清掉这个 legacy key，SSOT 是 `kazi.region.session`。

Playwright 里还要 `addInitScript` 再写一遍 session，否则下一次导航 / 新 document 会丢。`chromium.launch({ userDataDir })` 会被拒；用 `launchPersistentContext('/tmp/…')`。

OTP 失败时先看：号是不是 E.164、是不是 whitelist、出口 IP 是不是 `TEST_IP_WHITELIST`（不在会 `RATE_LIMIT_EXCEEDED`）、以及是不是 CORS 把 request / verify 拦了（那种会显示「网络错误」，不是验证码错）。

---

## 3. CORS：owen 调 bot 会被浏览器拦

us-west `deploy/clusters/us-west.env` 里：

```
CORS_ALLOWED_ORIGINS=https://kazispace.ai,https://www.kazispace.ai,http://localhost:3000
```

**没有** `https://owen--kazispace.netlify.app`。

实测：

- 真 Chrome 从 owen 发 OPTIONS 到 `bot.kazispace.ai` → **400**，页面「网络错误」。
- 同一接口从 `https://kazispace.ai` Origin 发 OPTIONS → **200 + ACAO**。

所以：

| 你在验什么 | 怎么开浏览器 |
|------------|--------------|
| 已发布 FE（kazispace.ai） | 普通 Chrome 即可 |
| owen 构建 + 真用户点击 OTP | 过不了，除非先改集群 CORS（测产品 AC 时不要顺手改） |
| owen 构建的 **产品面行为**（表单、预填、路由） | Chrome `--disable-web-security` + `--disable-features=IsolateOrigins,site-per-process`，或走 §2.2 注入后再操作 |

KAZI-1044 复测用的是 headed Chrome + `launchPersistentContext`，关 web security，只为了让 owen 构建能打到 bot。写回时把 CORS 限制单独记一笔，不要把它写成产品 FAIL。

`localhost:3000` 在 CORS 名单里：本地 `next dev` 对 bot 的浏览器 UAT 不需要关安全。

---

## 4. 打开页面

locale 前缀不能省。常用：

| 目的 | 打开 |
|------|------|
| 登录 | `/zh/login` |
| 门诊 Clinic（系统 Space `__clinic__`） | `/zh/chat` 或 `/zh/clinic/hub` |
| 用户 Space | `/zh/spaces/{sp_…}` |
| 新建 Space | 已登录后侧栏「新建空间」 |

**不要**用 `/zh/english` 当 ET 写作入口。写作表单走 Clinic 对话或 `ielts_prep` Space 的气泡 / 弹窗，不跳到独立 `/english` 页。

公开路径（middleware 不查 cookie）：`/`、`/login`、`/chat`、`/tma`。`/spaces/*`、`/clinic/*`、`/jobs` 等要 cookie。

### 4.1 新建 Space（浏览器）

1. 先保证已经离开 `/login`。
2. 点「新建空间」。
3. 选模板。ET / 雅思写作用 **「雅思备考」**（`template_id=ielts_prep`），不要选空白对话再指望写作表单自己出现。
4. 进 `/zh/spaces/sp_…`。

UI 创建失败时（侧栏没出来、按钮 disabled），用同一 token：

```http
POST https://bot.kazispace.ai/api/v1/spaces
Authorization: Bearer <token>
{"template_id":"ielts_prep","name":"KAZI-1044 改稿表单复测"}
```

然后 `goto` `{FE}/zh/spaces/{id}`。

票面说「必须新建 Space」时，不要复用脏空间。KAZI-1041 的 `sp_3fc5f6671042` 有遗留 pending，复测会误判。KAZI-1044 主空间是 `sp_7565e870c854`。

写回时同时记：`space_id`、完整 URL、`user_id`。Trace 表 `core_trace_turns` **没有** `space_id` 列，session 长得像 `sess_sp_7565e870c854`。

### 4.2 对话与表单

- 输入框：最后一个 `textbox` / `textarea` / `[contenteditable=true]`。
- 发送：在输入框里 Enter。
- 等回复：看 body 文本。**不要**用第一次出现的「批改完成」当第 2 稿——它会匹配第 1 稿。第 2 稿要等「第 2 稿批改完成」。
- 「处理中…」还在就还没完。
- 打开写作 / 改稿卡：从 **最后一条还 enabled 的**「打开编辑器」/「写作文」/「修改后重新提交」点起，先 `scrollIntoViewIfNeeded`。更早的卡会冻成「这张表单已关闭」，点了没反应。
- 弹窗：`[role=dialog]` 里最后一个 `textarea`。提交钮文案是「重新提交」或「修改后重新提交」或「提交作文」。改稿表单标题「修改作文」。
- 离开 ET：对话框里打的字走 Router（KAZI-1004）。「第二条什么意思」「为什么这篇 Task Response 只有 1 分」在 1044 复测里都会 leave → `job_search`，旧改稿卡冻结。这不是「打开编辑器失败」，是已经不在 ET。

---

## 5. 抓 Trace，不要只看 UI

浏览器里 `POST /api/v1/spaces/{id}/turn` 的 JSON 顶层是：

```
envelope, assistant_message_id, routing
```

`request_id` / `event` / `form` / `leave_stay_verdict` 在 **`envelope.meta`**（有时也在 `meta`），不在顶层。只读 `body.request_id` 会得到 `null`。

对照主机 Trace 时用 `request_id` 或 `trc_*`。改稿表单提交 stay 的形状：`leave_stay_reason=probe_consumable_stay`、`target_capability=english_tutor`、`event=writing_revise_review`。对话框追问 leave 的形状：`leave_stay_verdict=leave`、`leave_task_id=job_search`。

---

## 6. 写回

每步：通过 / 不通过 + Space id + 截图 **或** Trace `request_id`。两步脚本 + 浏览器的票，脚本 JSON 原样贴，浏览器逐步表。

部署版本：

- 后端：主机 `git rev-parse HEAD`，不要写 `/health`。
- 前端：owen tip / 发布 JS 是否含票面字符串。

Jira `addCommentToJiraIssue` **没有附件字段**。Markdown `![](/opt/cursor/artifacts/…)` 会被转成 media 占位，`id` 空，票面 `attachment` 仍是 `[]`。截图先放 agent 会话（HTML `<img src="/opt/cursor/artifacts/…">`）或外链，再在评论里写 Space / Trace。

未改票状态，除非当前消息明确说转状态。

---

## 7. 踩过的坑（按出现顺序）

| 现象 | 实际原因 |
|------|----------|
| 登录页「网络错误」 | owen Origin 不在 `CORS_ALLOWED_ORIGINS`，OPTIONS 400 |
| 填了号点发送没反应 / phoneInvalid | 没写 `+86` |
| 注入 token 仍停在 /login | 只写了 localStorage，没写 `kazi_token` cookie；或 `kazi.region.session` 缺字段被 `parseRegionSession` 清掉；或 `/me` 失败被清会话 |
| `launch({ userDataDir })` 报错 | 改用 `launchPersistentContext` |
| 打开编辑器没弹出 | 点到了冻结的旧卡 |
| 第 5 步「已经批改完」其实是第 1 稿 | 等待条件用了「批改完成」而不是「第 2 稿批改完成」 |
| 追问后打不开改稿卡 | 追问已经 leave 到岗位推荐，不是预填坏了 |
| 脚本 PASS、浏览器像没进 ET | 进了 `/zh/english`，或复用了脏 Space，或 FE host 不是票面要的那份构建 |
| turn 响应里没有 request_id | 在 `envelope.meta` |

---

## 8. 最小复现顺序（ET 改稿表单）

1. 确认 FE = owen Netlify（或票面指定的 host），JS 含要验的字符串。
2. 确认后端 HEAD 是票面 merge；`CURRENT_TASK_PROBE_ET_ENABLED=1`、`ROUTER_PROBE_FRONT_LOAD_ENABLED=1` 只核不改。
3. Fixture A OTP（页面或 API+注入）。关 CORS 仅当 host 是 owen。
4. **新建** `ielts_prep` Space，不要 `sp_3fc5f6671042`。
5. 发「帮我练习雅思考试」→ 应直接出写作题 +「打开编辑器」。
6. 编辑器交作文 → 判分 +「修改作文」卡。
7. 打开卡：预填刚判的那一稿，按钮「修改后重新提交」，没有「至少 40 词」。
8. 改几句再交 → 「第 2 稿批改完成」，没有「你是想继续「英语练习」，还是去做「新的任务」？」。
9. 对话框追问仍走 Router；要核预填，追问必须还留在 ET。

---

*2026-10-09 · us-west 执行 Agent 浏览器复测（KAZI-1044 为主，入口纪律来自 KAZI-1041 13515）*
