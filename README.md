# kazispace-test

Test suite for [KaziSpace](https://kazispace.ai) — **Function Test**, **Stress Test**, and **Monkey Test**.

Targets the KaziSpace Bot API (`https://bot.kazispace.ai`) and validates both **availability** and **correctness** (per-user CV isolation under concurrency).

## Test Types

| Suite | Command | Purpose |
|-------|---------|---------|
| **Function** | `npm run test:function` | Smoke + critical journeys: login, clinic chat, CV builder, content assertions |
| **Stress** | `npm run test:stress` | N users run CV scripts **concurrently**; each user has a golden profile + fingerprint |
| **Monkey** | `npm run test:monkey` | Random API calls, invalid inputs, agent switching — hunt 5xx and crashes |

## Quick Start

```bash
git clone https://github.com/Kazispace/kazispace-test.git
cd kazispace-test
npm install
cp .env.example .env

# Run individual suites
npm run test:function
npm run test:stress      # default: 10 concurrent users
npm run test:monkey

# Run all
npm run test:all
```

Reports are written to `reports/` as JSON + Markdown.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `KAZI_API_BASE_URL` | `https://bot.kazispace.ai` | API base URL |
| `KAZI_OTP_MOCK_CODE` | `123456` | Fallback OTP when mock mode omits `_mock_code` |
| `KAZI_TEST_PHONE` | `+77015551234` | Phone for function/monkey tests |
| `STRESS_USER_COUNT` | `10` | Concurrent users in stress test |
| `STRESS_SCENARIO` | `stress-test/scenarios/cv-concurrent-10.yaml` | Scenario file path |
| `MONKEY_DURATION_SEC` | `45` | Monkey test duration |

## Stress Test: Golden Profile Design

Each of the 10 users in `stress-test/scenarios/cv-concurrent-10.yaml` has:

- **Unique persona** — name, role, company, skills
- **Fingerprint** — e.g. `Kaspi-Aizhan-01` embedded in messages
- **must_contain** — resume must include user-specific terms
- **must_not_contain** — resume must NOT include other users' names/fingerprints (detects session bleed)

### Execution model

```
Phase A: Serial login (avoid OTP rate limits)
Phase B: All users run CV builder script concurrently
Phase C: Per-user assertion (independent PASS/FAIL)
```

## Function Test Cases

| ID | Coverage |
|----|----------|
| FT-001 | `GET /me` |
| FT-002 | `GET /billing/summary` |
| FT-003 | Clinic chat message |
| FT-004 | Activate `cv_builder` agent |
| FT-005 | Multi-step CV intake |
| FT-006 | CV content assertions (fingerprint) |

## Monkey Test

Randomly exercises:

- Agent activate / chat (`job_search`, `mock_interview`, `cv_builder`, invalid agent)
- Clinic chat with gibberish / XSS-like / multilingual input
- Read endpoints (`/me`, billing, jobs)
- Invalid OTP payloads

**Pass criteria**: zero HTTP 5xx during the run.

## Project Structure

```
kazispace-test/
├── function-test/       # Function / smoke tests
│   └── run.ts
├── stress-test/         # Concurrent load + golden-profile assertions
│   ├── run.ts
│   └── scenarios/
├── monkey-test/         # Random API fuzzing
│   └── run.ts
├── src/                 # Shared helpers
│   ├── api-client.ts
│   ├── auth.ts
│   ├── assertions.ts
│   ├── scenario-loader.ts
│   └── reporters/
└── reports/             # Generated output (gitignored)
```

## CI

GitHub Actions workflow runs function + monkey on push/PR. Stress test is manual (LLM cost).

## Related

- Frontend: [kazispace-ai](https://github.com/Kazispace/kazispace-ai)
- API: `https://bot.kazispace.ai`
- Web: `https://kazispace.ai`

## License

© Kazispace. Internal testing tool.
