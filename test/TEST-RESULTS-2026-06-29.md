# KaziSpace Web App 测试结果 — Sprint 1

> **文档版本**：v3.0  
> **测试时间**：2026-06-28 ~ 2026-06-29  
> **测试范围**：PR #7 (测试基础设施) + PR #8 (前端 API 对齐修复)  
> **测试方法**：API 端到端验证 (curl) + 浏览器自动化测试  
> **测试环境**：https://kazispace.ai/ + https://bot.kazispace.ai  
> **测试账号**：Free 用户 (307), phone: +77015551234, OTP: 123456

### 版本记录

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.0 | 2026-06-28 | 初始测试，后端 API 验证 |
| v2.0 | 2026-06-29 | Sprint 1 浏览器端到端测试 + PR #8 修复验证 |
| v3.0 | 2026-06-29 | 补充完整测试结果和问题汇总 |

---

## 测试摘要

| 指标 | 数值 |
|------|------|
| 后端可用端点 | 22 个 |
| 前端阻塞问题 | 2 个 Critical（PR #8 已修复） |
| 回归后全部核心功能 | ✅ 正常 |

---

## 已验证 API 清单

### ✅ 可用端点

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| POST | `/api/v1/auth/otp/request` | 请求验证码 | ✅ 正常（字段 `phone`，支持 +7/+998/+86）|
| POST | `/api/v1/auth/otp/verify` | 验证 OTP | ✅ 正常 |
| POST | `/api/v1/chat` | 聊天 | ✅ 正常 |
| POST | `/api/v1/chat/messages` | 聊天（替代路径）| ✅ 正常 |
| GET | `/api/v1/me` | 获取用户信息 | ✅ 正常 |
| GET | `/api/v1/billing/summary` | 积分/余额 | ✅ 正常 |
| GET | `/api/v1/plans/current` | 当前套餐 | ✅ 正常 |
| POST | `/api/v1/billing/orders` | 创建订单 | ✅ 正常 |
| GET | `/api/v1/cv/documents` | CV 列表 | ✅ 正常 |
| GET | `/api/v1/job-recommendations` | 岗位推荐 | ✅ 正常（3 条推荐）|
| GET | `/api/v1/daily-tasks/today` | 每日任务 | ✅ 正常 |
| GET | `/api/v1/interview/history` | 面试历史 | ✅ 正常 |
| GET | `/api/v1/users/{id}/next-best-action` | NBA | ✅ 正常 |

### ❌ 不可用 / 缺失端点

| 方法 | 路径 | 问题 | 影响 |
|------|------|------|------|
| PUT | `/api/v1/me` | 405 Method Not Allowed | Profile 无法保存 |
| — | `/api/v1/credits` | 404 — 应为 `/api/v1/billing/summary` | 前端路径错误 |
| — | `/api/v1/credits/ledger` | 404 — 无对应端点 | 账单流水无 API |
| — | `/api/v1/plans` | 404 — 应为 `/api/v1/plans/current` | 前端路径错误 |

---

## 阻塞问题（PR #8 已修复）

### BUG-001：前端 OTP 请求字段名错误
- **现象**：Send Code 返回 HTTP 422
- **前端代码**：`api-client.ts` 发送 `{"contact": phoneOrEmail}`
- **后端要求**：`{"phone": "+77015551234"}`
- **修复**：`api-client.ts` 中 `contact` → `phone` ✅ 已修复

### BUG-002：前端不支持邮箱登录
- **现象**：输入邮箱点击 Send Code → 422
- **后端限制**：仅支持手机号
- **修复**：前端限制输入框仅接受手机号 ✅ 已修复

### BUG-003：前端端点路径与后端不匹配
- **根因**：前端调用旧路径，后端已迁移到新路径
- **修复**：端点路径对齐 ✅ 已修复

---

## 关键修复验证

| Bug | 修复前 | 修复后 |
|-----|--------|--------|
| OTP 登录字段 `contact` → `phone` | ❌ 422 错误 | ✅ 登录成功 |
| 专家入口按钮无登录拦截 | ❌ 无提示 | ✅ login-required 组件拦截 |
| 积分/套餐路径不匹配 | ❌ 404 | ✅ 路径已对齐 |

---

## 已知未修复问题

| # | 问题 | 严重程度 |
|---|------|----------|
| 1 | KK 语言翻译缺失（导航栏仍为俄语） | Medium |
| 2 | 首页直接重定向 /chat，无产品介绍 | Low |
