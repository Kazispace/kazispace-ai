# KaziSpace Web App 测试结果报告

> **测试日期**：2026-06-29  
> **测试版本**：https://kazispace.ai/（分支 owen）  
> **测试人**：Owen（人工）+ Agent（自动化 + API 验证）  
> **测试方法**：真实用户视角浏览器操作 + API 端到端验证

---

## 执行摘要

| 指标 | 数值 |
|------|------|
| 总用例数 | 14 |
| 已执行 | 7 |
| PASS | 1 |
| FAIL | 6 |
| 待执行 | 7 |
| 阻塞率 | 85.7%（已执行用例中）|

**整体结论：Web App 核心链路存在多个 Critical 级别阻塞问题，无法完成基本的用户注册→登录→聊天流程。**

---

## 已发现问题（按严重程度排序）

### 🔴 Critical

| # | 问题 | 用例 | 根因 | 建议修复 |
|---|------|------|------|---------|
| 1 | **OTP 登录失败**：Send Code 返回 HTTP 422 | TC-002 | 前端 `api-client.ts` 发送 `{"contact":"..."}` 但后端要求 `{"phone":"..."}`，字段名不一致 | 前端改为 `{"phone": phoneOrEmail}`，或与后端对齐使用 `contact` 字段 |
| 2 | **未登录聊天报错**：直接显示 HTTP 422，无友好提示 | TC-001 | 前端未做认证拦截，无 token 直接调用 `/api/v1/chat` | 前端增加认证状态检查，未登录时引导跳转登录页 |
| 3 | **Credits API 未实现**：`/api/v1/credits` 返回 404 | TC-008 | 后端未实现此端点 | 后端实现 credits 端点，或前端增加 fallback |
| 4 | **Ledger API 未实现**：`/api/v1/credits/ledger` 返回 404 | TC-009 | 后端未实现此端点 | 后端实现 ledger 端点 |

### 🟠 High

| # | 问题 | 用例 | 根因 | 建议修复 |
|---|------|------|------|---------|
| 5 | **专家入口全部 disabled** | TC-005 | 未登录状态下所有功能按钮不可点击，无引导提示 | 增加 disabled 状态的引导文案（如"登录后使用"）|
| 6 | **Profile 保存无后端端点** | TC-007 | 后端 `/api/v1/me` 仅 GET，无 PUT/PATCH | 后端实现 profile 更新端点 |
| 7 | **Subscription API 未实现** | TC-010 | `/api/v1/plans` 等端点均返回 404 | 后端实现订阅相关端点 |
| 8 | **JWT 过期无跳转** | TC-013 | 代码中 401 响应仅清除 token 但未跳转登录页 | 401 响应时 redirect 到 `/login` |

### 🟡 Medium

| # | 问题 | 用例 | 根因 | 建议修复 |
|---|------|------|------|---------|
| 9 | **KK 语言翻译缺失**：导航栏"Профиль"仍为俄语 | TC-011 | i18n kk.json 翻译不完整 | 补全 KK 语言翻译 |
| 10 | **首页重定向**：`/` 直接 302 到 `/chat`，无产品介绍 | TC-012 | 设计决策或配置问题 | 确认是否需要保留首页产品介绍 |

---

## API 端到端验证（curl）

以下验证使用正确的字段名和有效 JWT，确认**后端 API 本身工作正常**：

```bash
# 1. 请求 OTP（正确字段 phone）
curl -X POST https://bot.kazispace.ai/api/v1/auth/otp/request \
  -H "Content-Type: application/json" \
  -d '{"phone": "+77015551234"}'
# ✅ 返回: {"status": "sent", "_mock_code": "123456", ...}

# 2. 验证 OTP
curl -X POST https://bot.kazispace.ai/api/v1/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"phone": "+77015551234", "code": "123456"}'
# ✅ 返回: {"access_token": "eyJ...", "user": {...}, ...}

# 3. 聊天（带 JWT）
curl -X POST https://bot.kazispace.ai/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"message": "Hello"}'
# ✅ 返回: {"reply": "Hello! Welcome to KaziSpace!...", ...}
```

**结论：后端 API 链路完整可用，问题出在前端请求参数和前端错误处理。**

---

## 测试用例执行详情

### TC-001：未登录用户发送聊天消息 — ❌ FAIL
- **操作**：不登录，在 https://kazispace.ai/ 输入 "Hello" 发送
- **结果**：页面显示 "HTTP 422"
- **截图**：见 Owen 提供的截图

### TC-002：OTP 登录流程 — ❌ FAIL
- **操作**：打开 /login，输入 +77015551234，点击 Send Code
- **结果**：页面显示 "HTTP 422"，验证码未发送
- **截图**：[tc002-login-422.png](screenshots/tc002-login-422.png)

### TC-003：登录后聊天 — ⏳ 待执行
- **依赖**：TC-002 修复后执行

### TC-004：专家切换 — ⏳ 待执行
- **依赖**：TC-003 通过后执行

### TC-005：专家入口按钮 — ❌ FAIL
- **结果**：所有按钮 disabled，无引导文案

### TC-006：个人中心 — ⏳ 待执行
- **依赖**：TC-002 修复后执行

### TC-007：Profile 保存 — ⏳ 待执行
- **依赖**：TC-002 修复后执行

### TC-008：Credits 页面 — ❌ FAIL
- **结果**：后端 `/api/v1/credits` 返回 404

### TC-009：Ledger 页面 — ❌ FAIL
- **结果**：后端 `/api/v1/credits/ledger` 返回 404

### TC-010：Subscription — ⏳ 待执行
- **依赖**：后端实现相关 API

### TC-011：国际化切换 — ❌ FAIL
- **结果**：KK 版本导航栏"Профиль"仍为俄语

### TC-012：首页重定向 — ⚠️ 注意
- **结果**：`/` 直接 302 到 `/chat`

### TC-013：JWT 过期处理 — ⏳ 待执行
- **依赖**：TC-002 修复后执行

### TC-014：响应式布局 — ✅ PASS
- **结果**：移动端布局正常，无错位

---

## 建议修复优先级

### 第一优先（立即修复 — 阻塞基本流程）
1. 修复 `api-client.ts` 中 OTP 请求字段名：`contact` → `phone`
2. 增加未认证状态的聊天拦截：未登录时引导跳转 `/login`

### 第二优先（核心功能完善）
3. 后端实现 `/api/v1/credits` 端点
4. 后端实现 `/api/v1/credits/ledger` 端点
5. 后端实现 Profile 更新端点（PUT/PATCH `/api/v1/me`）

### 第三优先（体验优化）
6. 专家入口 disabled 状态增加引导文案
7. 补全 KK 语言翻译
8. 401 响应增加登录页跳转

---

## 测试环境

| 项目 | 值 |
|------|---|
| 前端 | https://kazispace.ai/ |
| 后端 API | https://bot.kazispace.ai |
| 测试用户（Free） | user_id=307, phone=+77015551234 |
| 测试用户（Pro） | user_id=300, phone=+77779991235 |
| 浏览器 | Chrome（桌面 + 移动端模拟）|
| 代码仓库 | https://github.com/Kazispace/kazispace-ai（分支 owen）|
