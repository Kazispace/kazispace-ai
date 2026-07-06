#!/usr/bin/env tsx
/**
 * Stress Test — N users run CV builder scripts concurrently with per-user assertions.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  activateAgent,
  loginWithOtp,
  sendAgentMessage,
} from '../src/auth.js';
import { extractCvMarkdown, extractPipelineState } from '../src/api-client.js';
import { runAssertions, summarizeUserResults } from '../src/assertions.js';
import { buildCrossUserBlocklist, loadStressScenario } from '../src/scenario-loader.js';
import { buildReport, writeReport } from '../src/reporters/markdown.js';
import type { AuthSession, ScriptedUser, StepResult, TestCaseResult, UserRunResult } from '../src/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENARIO_PATH =
  process.env.STRESS_SCENARIO ?? join(__dirname, 'scenarios/cv-concurrent-10.yaml');
const MAX_USERS = Number(process.env.STRESS_USER_COUNT ?? '10');
const MAX_STEP_LATENCY_MS = Number(process.env.STRESS_MAX_LATENCY_MS ?? '90000');

async function loginAll(users: ScriptedUser[]): Promise<Map<string, AuthSession>> {
  const sessions = new Map<string, AuthSession>();
  for (const user of users) {
    console.log(`  Login ${user.id} (${user.phone})...`);
    const session = await loginWithOtp(user.phone, user.device_id);
    sessions.set(user.id, session);
    await sleep(1100);
  }
  return sessions;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runUserFlow(
  user: ScriptedUser,
  session: AuthSession,
  agentId: string,
  crossBlocklist: string[]
): Promise<UserRunResult> {
  const result: UserRunResult = {
    userId: user.id,
    phone: user.phone,
    steps: [],
    passed: false,
    errors: [],
  };

  try {
    let activated: { sessionId: string };
    let startStep = 0;
    try {
      activated = await activateAgent(session, agentId);
    } catch {
      const bootstrap = await sendAgentMessage(session, agentId, user.script[0]);
      if (!bootstrap.ok) throw new Error(`Bootstrap chat failed: ${bootstrap.error}`);
      const sid =
        (typeof bootstrap.data?.session_id === 'string' && bootstrap.data.session_id) ||
        `stress_${user.id}_${Date.now()}`;
      activated = { sessionId: sid };
      startStep = 1;
    }
    result.sessionId = activated.sessionId;

    let cvMarkdown = '';
    let totalLatency = 0;

    for (let i = startStep; i < user.script.length; i++) {
      const message = user.script[i];
      const res = await sendAgentMessage(session, agentId, message, activated.sessionId);
      const step: StepResult = {
        step: i + 1,
        message,
        status: res.status,
        latencyMs: res.latencyMs,
        ok: res.ok,
        error: res.error,
        pipelineState: extractPipelineState(res.data),
        cvPreview: extractCvMarkdown(res.data),
      };
      result.steps.push(step);
      totalLatency += res.latencyMs;

      if (!res.ok) {
        result.errors.push(`Step ${i + 1}: ${res.error}`);
        break;
      }

      const md = extractCvMarkdown(res.data);
      if (md) cvMarkdown = md;
    }

    if (!cvMarkdown) {
      for (const confirmMsg of ['confirm', '__action:confirm']) {
        const confirm = await sendAgentMessage(session, agentId, confirmMsg, activated.sessionId);
        totalLatency += confirm.latencyMs;
        if (confirm.ok) {
          cvMarkdown = extractCvMarkdown(confirm.data) ?? cvMarkdown;
          if (cvMarkdown) break;
        }
      }
    }

    result.cvMarkdown = cvMarkdown;
    const { results, passed, errors } = runAssertions(
      cvMarkdown,
      user.assert,
      crossBlocklist,
      { latencyMs: totalLatency, maxLatencyMs: MAX_STEP_LATENCY_MS * user.script.length }
    );
    result.assertionResults = results;
    result.errors.push(...errors);
    result.passed = passed && result.errors.length === 0;
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err));
    result.passed = false;
  }

  return result;
}

async function main() {
  const startedAt = new Date();
  console.log('KaziSpace Stress Test\n');

  const scenario = await loadStressScenario(SCENARIO_PATH);
  const users = scenario.users.slice(0, MAX_USERS);
  console.log(`Scenario: ${scenario.scenario} (${users.length} users)\n`);

  console.log('Phase A: serial login');
  const sessions = await loginAll(users);

  console.log('\nPhase B: concurrent CV builder flows');
  const userResults = await Promise.all(
    users.map((user) => {
      const session = sessions.get(user.id);
      if (!session) throw new Error(`No session for ${user.id}`);
      const blocklist = buildCrossUserBlocklist(users, user.id);
      return runUserFlow(user, session, scenario.agent_id, blocklist);
    })
  );

  const summary = summarizeUserResults(userResults);
  console.log(`\nStress summary: ${summary.passed}/${summary.total} users passed`);

  for (const ur of userResults) {
    const icon = ur.passed ? 'PASS' : 'FAIL';
    console.log(`  ${ur.userId}: ${icon}${ur.errors.length ? ` — ${ur.errors[0]}` : ''}`);
  }

  const testCases: TestCaseResult[] = userResults.map((ur) => ({
    id: ur.userId,
    name: `Concurrent CV flow ${ur.userId}`,
    passed: ur.passed,
    durationMs: ur.steps.reduce((s, st) => s + st.latencyMs, 0),
    error: ur.errors[0],
    details: {
      sessionId: ur.sessionId,
      assertions: ur.assertionResults?.filter((a) => !a.passed),
      fingerprint: users.find((u) => u.id === ur.userId)?.profile.fingerprint,
    },
  }));

  const report = buildReport('stress', startedAt, testCases);
  await writeReport(report, 'stress-test');
  console.log(`\nStress Test: ${report.passed ? 'PASS' : 'FAIL'}`);
  process.exit(report.passed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
