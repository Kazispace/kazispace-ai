#!/usr/bin/env tsx
/**
 * Monkey Test — random API interactions to surface crashes, 5xx, and validation gaps.
 */
import { apiFetch } from '../src/api-client.js';
import { loginWithOtp } from '../src/auth.js';
import { buildReport, writeReport } from '../src/reporters/markdown.js';
import type { MonkeyEvent, TestCaseResult } from '../src/types.js';

const PHONE = process.env.KAZI_TEST_PHONE ?? '+77015551234';
const DEVICE = 'monkey-test-device';
const DURATION_SEC = Number(process.env.MONKEY_DURATION_SEC ?? '45');
const ACTIONS_PER_TICK = 3;

const AGENTS = ['job_search', 'mock_interview', 'cv_builder', 'nonexistent_agent'];
const GIBBERISH = [
  '',
  'a'.repeat(5000),
  '<script>alert(1)</script>',
  '你好 مرحبا Қазақ',
  '?agent=job_search&context_module=mock_interview',
  '__action:confirm',
  'DROP TABLE users;',
  String.fromCharCode(0),
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function runMonkeyAction(
  token: string,
  deviceId: string,
  sessionId: string
): Promise<MonkeyEvent> {
  const roll = Math.random();
  const started = Date.now();

  if (roll < 0.2) {
    const agent = pick(AGENTS);
    const res = await apiFetch(`/api/v1/agents/${agent}/activate`, {
      method: 'POST',
      token,
      deviceId,
      body: {},
    });
    return {
      action: `activate:${agent}`,
      endpoint: `/api/v1/agents/${agent}/activate`,
      status: res.status,
      latencyMs: res.latencyMs,
      ok: res.status < 500,
      error: res.status >= 500 ? res.error : undefined,
    };
  }

  if (roll < 0.5) {
    const agent = pick(['job_search', 'mock_interview', 'cv_builder']);
    const msg = pick(GIBBERISH);
    const res = await apiFetch('/api/v1/agents/chat', {
      method: 'POST',
      token,
      deviceId,
      body: { agent_id: agent, message: msg, session_id: sessionId },
    });
    return {
      action: `agent_chat:${agent}`,
      endpoint: '/api/v1/agents/chat',
      status: res.status,
      latencyMs: res.latencyMs,
      ok: res.status < 500,
      error: res.status >= 500 ? res.error : undefined,
    };
  }

  if (roll < 0.7) {
    const res = await apiFetch('/api/v1/chat/messages', {
      method: 'POST',
      token,
      deviceId,
      body: { session_id: sessionId, content: pick(GIBBERISH) },
    });
    return {
      action: 'clinic_chat',
      endpoint: '/api/v1/chat/messages',
      status: res.status,
      latencyMs: res.latencyMs,
      ok: res.status < 500,
      error: res.status >= 500 ? res.error : undefined,
    };
  }

  if (roll < 0.85) {
    const path = pick([
      '/api/v1/me',
      '/api/v1/billing/summary',
      '/api/v1/plans/current',
      '/api/v1/billing/ledger',
      '/api/v1/job-recommendations',
    ]);
    const res = await apiFetch(path, { token, deviceId });
    return {
      action: `read:${path}`,
      endpoint: path,
      status: res.status,
      latencyMs: res.latencyMs,
      ok: res.status < 500,
      error: res.status >= 500 ? res.error : undefined,
    };
  }

  const res = await apiFetch('/api/v1/auth/otp/verify', {
    method: 'POST',
    deviceId,
    body: { phone: pick(['+77015559999', 'invalid', '']), code: pick(['000000', 'abc', '']) },
  });
  return {
    action: 'bad_otp',
    endpoint: '/api/v1/auth/otp/verify',
    status: res.status,
    latencyMs: res.latencyMs,
    ok: res.status < 500,
    error: res.status >= 500 ? res.error : undefined,
  };
}

async function main() {
  const startedAt = new Date();
  console.log(`KaziSpace Monkey Test (${DURATION_SEC}s)\n`);

  const session = await loginWithOtp(PHONE, DEVICE);
  const chatSessionId = `monkey_${session.userId}_${Date.now()}`;

  const events: MonkeyEvent[] = [];
  const deadline = Date.now() + DURATION_SEC * 1000;

  while (Date.now() < deadline) {
    const batch = await Promise.all(
      Array.from({ length: ACTIONS_PER_TICK }, () =>
        runMonkeyAction(session.token, session.deviceId, chatSessionId)
      )
    );
    events.push(...batch);
    const fails = batch.filter((e) => !e.ok);
    if (fails.length) {
      console.log(`  WARN: ${fails.map((f) => `${f.action}→${f.status}`).join(', ')}`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  const serverErrors = events.filter((e) => e.status >= 500);
  const total = events.length;
  const ok = events.filter((e) => e.ok).length;

  console.log(`\nMonkey: ${ok}/${total} actions without 5xx`);
  console.log(`  5xx count: ${serverErrors.length}`);

  const results: TestCaseResult[] = [
    {
      id: 'MK-001',
      name: 'No server errors (5xx) during monkey run',
      passed: serverErrors.length === 0,
      durationMs: DURATION_SEC * 1000,
      error: serverErrors[0] ? `${serverErrors[0].action}: ${serverErrors[0].error}` : undefined,
      details: { totalActions: total, serverErrors: serverErrors.length },
    },
    {
      id: 'MK-002',
      name: 'Monkey completed full duration',
      passed: events.length > 0,
      durationMs: DURATION_SEC * 1000,
      details: { events: events.length },
    },
  ];

  const report = buildReport('monkey', startedAt, results);
  await writeReport(report, 'monkey-test');
  console.log(`\nMonkey Test: ${report.passed ? 'PASS' : 'FAIL'}`);
  process.exit(report.passed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
