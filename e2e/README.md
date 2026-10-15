# Product E2E (Playwright)

Automates **Deploy Gate Smoke · Tier A** against a live FE host.

| Env | Default |
| --- | --- |
| FE | `https://kazispace.ai` (`PLAYWRIGHT_BASE_URL`) |
| API | `https://bot.kazispace.ai` (`PLAYWRIGHT_API_BASE`) |
| Fixture | A `+8613262788342` / OTP `123456` |
| Locale | `zh` |

Auth uses API OTP + session injection (`kazi.region.session` + `kazi_token` cookie) per [`deploy.md`](../deploy.md) §2.2. UI OTP is attempted on SMK-AUTH-01 when CORS allows.

## Commands

```bash
npx playwright install chromium   # once
npm run test:e2e                  # product smoke (desktop + mobile projects)
npm run test:e2e:smoke            # alias

# Preview FE (injection path — CORS often blocks UI OTP)
PLAYWRIGHT_BASE_URL=https://owen--kazispace.netlify.app npm run test:e2e
```

## Case map

| ID | Spec |
| --- | --- |
| SMK-AUTH-01..03 | `product-smoke.spec.ts` |
| SMK-CLN-01..02 | same |
| SMK-NAV-01..02 | same |
| SMK-HUB-01..03 | same |

Manual Tier B+ remains in [kazispace-test DEPLOY-SMOKE-TEST](https://github.com/Kazispace/kazispace-test/blob/main/docs/frontend/DEPLOY-SMOKE-TEST.md).
