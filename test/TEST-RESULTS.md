# KaziSpace Web App 测试结果 v3（后端更新后）

> **测试日期**：2026-06-29 11:40  
> **触发**：Owen 报告后端已更新，用邮箱登录仍返回 HTTP 422  
> **方法**：API 端到端验证（curl）+ 前端浏览器操作

---

## 执行摘要

| 指标 | 数值 |
|------|------|
| 后端可用端点 | 22 个（含认证、聊天、CV、面试、推荐、计费、任务）|
| 前端阻塞问题 | **2 个 Critical** — 字段名不一致 + 路径不匹配 |
| 可正常工作的 API | OTP→Login→Chat→Billing→Jobs→CV→NBA 全链路 |

**核心结论：后端已大幅更新，功能基本可用。问题集中在前端 `api-client.ts` 的请求参数和端点路径与后端不一致。**

---

## 已验证 API 清单（2026-06-29 后端版本）

### ✅ 可用端点

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| POST | `/api/v1/auth/otp/request` | 请求验证码 | ✅ 正常（字段 `phone`，支持 +7/+998/+86）|
| POST | `/api/v1/auth/otp/verify` | 验证 OTP | ✅ 正常 |
| POST | `/api/v1/chat` | 聊天 | ✅ 正常 |
| POST | `/api/v1/chat/messages` | 聊天（替代路径）| ✅ 正常 |
| GET | `/api/v1/me` | 获取用户信息 | ✅ 正常 |
| GET | `/api/v1/billing/summary` | 积分/余额 | ✅ 正常（返回 credits + entitlements）|
| GET | `/api/v1/plans/current` | 当前套餐 | ✅ 正常 |
| POST | `/api/v1/billing/orders` | 创建订单 | ✅ 正常（需 `package_id` + `amount_kzt`）|
| GET | `/api/v1/cv/documents` | CV 列表 | ✅ 正常（空列表，无 CV）|
| GET | `/api/v1/job-recommendations` | 岗位推荐 | ✅ 正常（返回 3 条推荐）|
| GET | `/api/v1/daily-tasks/today` | 每日任务 | ✅ 正常 |
| GET | `/api/v1/interview/history` | 面试历史 | ✅ 正常（空列表）|
| GET | `/api/v1/users/{id}/next-best-action` | NBA | ✅ 正常 |

### ❌ 不可用 / 缺失端点

| 方法 | 路径 | 问题 | 影响 |
|------|------|------|------|
| PUT | `/api/v1/me` | 405 Method Not Allowed | Profile 无法保存 |
| — | `/api/v1/credits` | 404 — 应为 `/api/v1/billing/summary` | 前端路径错误 |
| — | `/api/v1/credits/ledger` | 404 — 无对应端点 | 账单流水无 API |
| — | `/api/v1/plans` | 404 — 应为 `/api/v1/plans/current` | 前端路径错误 |

---

##  阻塞问题（Critical）

### BUG-001：前端 OTP 请求字段名错误
- **现象**：Send Code 返回 HTTP 422
- **前端代码**：`api-client.ts` 发送 `{"contact": phoneOrEmail}`
- **后端要求**：`{"phone": "+77015551234"}`
- **影响**：登录流程完全阻塞，所有后续功能不可用
- **修复**：`api-client.ts` 中 `requestOtp()` 和 `verifyOtp()` 的 `contact` 改为 `phone`

### BUG-002：前端不支持邮箱登录
- **现象**：输入邮箱 `shouwen.lai@icloud.com` 点击 Send Code → 422
- **后端限制**：仅支持手机号（+7 / +998 / +86 前缀）
- **影响**：邮箱用户无法登录
- **修复**：前端需限制输入框仅接受手机号，或后端扩展支持邮箱 OTP

### BUG-003：前端端点路径与后端不匹配
- **现象**：Credits/Ledger/Subscription 页面无数据
- **根因**：前端可能调用旧路径（如 `/api/v1/credits`），后端已迁移到新路径（`/api/v1/billing/summary`）
- **影响**：积分、账单、套餐页面无数据
- **修复**：`api-client.ts` 中所有端点路径对齐后端 OpenAPI spec

---

##  高优先级问题

### BUG-004：Profile 保存无端点
- **后端**：`/api/v1/me` 仅 GET，PUT/PATCH 返回 405
- **影响**：用户无法保存个人资料
- **修复**：后端实现 `PUT /api/v1/me` 或 `PATCH /api/v1/me`

### BUG-005：Ledger 流水无端点
- **后端**：无积分流水查询端点
- **影响**：Ledger 页面无数据
- **修复**：后端实现 `/api/v1/billing/ledger` 或类似端点

### BUG-006：邮箱登录输入未限制
- **前端**：登录页 placeholder 显示 "Phone or Email"，暗示支持邮箱
- **后端**：仅支持手机号
- **修复**：前端去掉 "Email" 提示，或后端增加邮箱支持

---

## ✅ 已验证通过的功能

| 功能 | API 验证 | 说明 |
|------|---------|------|
| OTP 登录 | ✅ | 字段正确时全链路通 |
| 聊天 | ✅ | 回复正常，credits 计数正确 |
| 积分查询 | ✅ | `/api/v1/billing/summary` 返回余额 2 |
| 当前套餐 | ✅ | 返回 sprint_7d 套餐信息 |
| 岗位推荐 | ✅ | 返回 3 条推荐（Customer Care, Desktop Support, Executive Assistant）|
| 每日任务 | ✅ | 返回 reflection 任务 |
| CV 管理 | ✅ | 列表正常（空）|
| 面试历史 | ✅ | 列表正常（空）|
| NBA | ✅ | 返回 next-best-action: complete_profile |
| 计费下单 | ✅ | 端点存在，需正确字段 |

---

## 建议修复顺序

| 优先级 | 修复项 | 改动范围 | 预计影响 |
|--------|--------|---------|---------|
| **P0** | `api-client.ts` 中 `contact` → `phone` | 前端 2 行代码 | 解除登录阻塞 |
| **P0** | 对齐端点路径（`/api/v1/credits` → `/api/v1/billing/summary` 等）| 前端 api-client.ts | 解除积分/套餐/账单阻塞 |
| **P1** | 登录页去掉 "Phone or **Email**" 提示 | 前端 login page | 减少用户困惑 |
| **P1** | 后端实现 `PUT /api/v1/me` | 后端 | Profile 保存 |
| **P2** | 后端实现 `/api/v1/billing/ledger` | 后端 | 账单流水 |
| **P2** | 后端支持邮箱 OTP 或前端限制手机号格式 | 前后端 | 邮箱登录 |
