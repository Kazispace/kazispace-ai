# WB-WA-TMA 白盒重跑记录

**轮次**：WB-WA-TMA-2026-06-30-0636  
**分支**：`owen` @ PR #13 合并后（`99703c6`）  
**执行人**：Cloud Agent  
**脚本**：`test/scripts/run_wb_wa_tma.py`  
**原始 JSON**：`test/results/wb_wa_tma_latest.json`

---

## 结论

| 指标 | 数量 |
| --- | --- |
| **PASS** | 16 |
| **FAIL** | 0 |
| **BLOCKED** | 2（后端 API） |

☑ **前端 TMA 白盒全部通过**；仅 `POST /auth/telegram/webapp` 待后端 E2 部署后解除 BLOCKED。

---

## 用例结果

### API（Staging）

| 用例 ID | 结果 | 证据 |
| --- | --- | --- |
| WB-WA-AUTH-05 | **BLOCKED** | `POST /api/v1/auth/telegram/webapp` → **404** Not Found |
| WB-WA-AUTH-05b | **BLOCKED** | 同上（错误字段契约无法验证） |

### 代码静态

| 用例 ID | 结果 | 证据 |
| --- | --- | --- |
| WB-WA-TMA-01 | **PASS** | `api-client` 合并 `getTmaClientHeaders`；`X-Client-Variant: telegram_mini_app` |
| WB-WA-TMA-02 | **PASS** | `parseStartParam` + `consumePendingTmaAction` in `clinic-shell` |
| WB-WA-TMA-02-* | **PASS** | `agent_*` / `clinic` / `billing_pro` / `job_*` / 空 → 正确 action 类型 |
| WB-WA-TMA-03 | **PASS** | `middleware.ts` `PUBLIC_PATH_SEGMENTS` 含 `tma` |
| WB-WA-TMA-03b | **PASS** | launch 页 `tRef` 稳定 effect + `continueInBrowser` |
| WB-WA-TMA-04 | **PASS** | TMA 隐藏 Header/BottomNav；`chat-header`「Back to bot」 |
| WB-WA-AUTH-04-tma | **PASS** | `providers` 401 → `reauthTelegramIfPossible` 优先于 login |
| WB-WA-TMA-05-types | **PASS** | `isVerticalSwipesEnabled` 等 SDK 类型已补全 |
| WB-WA-TMA-theme | **PASS** | `setHeaderColor` + `setBackgroundColor` 同步 |
| WB-WA-TMA-routing-guard | **PASS** | `MAX_TMA_PARAM_ID_LEN = 64` + `clampId` |

### Middleware（local `npm start`）

| 用例 ID | 结果 | 证据 |
| --- | --- | --- |
| WB-WA-TMA-03-curl | **PASS** | `GET /ru/tma/launch` → **200**（无 cookie 不拦截） |
| WB-WA-TMA-03-curl-mine | **PASS** | `GET /ru/mine` → **307** `/ru/login?redirect=...` |

---

## 与上次对比（PR #13 合并前）

| 项 | 合并前 | 本次 |
| --- | --- | --- |
| WB-WA-TMA-01~03 | BLOCKED（代码未在 owen） | **PASS** |
| WB-WA-AUTH-05 | BLOCKED 404 | 仍 BLOCKED 404 |
| middleware `/tma/*` | 无 | **PASS** |

---

## 后续

1. **后端**部署 `POST /api/v1/auth/telegram/webapp` → 重跑 `python3 test/scripts/run_wb_wa_tma.py`
2. **UI Agent** 在 Telegram WebView 执行 UAT-WA-TMA-01~04（见 `test/UAT-HANDOFF.md`）
