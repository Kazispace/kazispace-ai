#!/usr/bin/env tsx
/**
 * Function Test — smoke + critical user journeys against KaziSpace API.
 */
import {
  activateAgent,
  getBillingSummary,
  getMe,
  loginWithOtp,
  sendAgentMessage,
  sendClinicMessage,
} from '../src/auth.js';
import { extractCvMarkdown, extractPipelineState } from '../src/api-client.js';
import { runAssertions } from '../src/assertions.js';
import { buildReport, writeReport } from '../src/reporters/markdown.js';
import type { TestCaseResult } from '../src/types.js';

const PHONE = process.env.KAZI_TEST_PHONE ?? '+77015551234';
const DEVICE = 'function-test-device';

async function runCase(
  id: string,
  name: string,
  fn: () => Promise<void>
): Promise<TestCaseResult> {
  const started = Date.now();
  try {
    await fn();
    return { id, name, passed: true, durationMs: Date.now() - started };
  } catch (err) {
    return {
      id,
      name,
      passed: false,
      durationMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main() {
  const startedAt = new Date();
  console.log('KaziSpace Function Test\n');

  const session = await loginWithOtp(PHONE, DEVICE);
  console.log(`Logged in as user ${session.userId} (${PHONE})`);

  const results: TestCaseResult[] = [];

  results.push(
    await runCase('FT-001', 'GET /me returns user profile', async () => {
      const res = await getMe(session);
      if (!res.ok) throw new Error(res.error);
    })
  );

  results.push(
    await runCase('FT-002', 'GET /billing/summary', async () => {
      const res = await getBillingSummary(session);
      if (!res.ok) throw new Error(res.error);
    })
  );

  let clinicSessionId = `web_${session.userId}_${Date.now()}`;
  results.push(
    await runCase('FT-003', 'Clinic chat message', async () => {
      const res = await sendClinicMessage(session, clinicSessionId, 'Hello from function test');
      if (!res.ok) throw new Error(res.error);
    })
  );

  let agentSessionId = '';
  const activateResult = await runCase('FT-004', 'Activate cv_builder agent', async () => {
    const res = await activateAgent(session, 'cv_builder');
    agentSessionId = res.sessionId;
    if (!agentSessionId) throw new Error('No session_id');
  });
  results.push(activateResult);

  if (!activateResult.passed) {
    console.log('  Note: activate failed — will rely on agent chat to establish session');
  }

  const fingerprint = `FuncTest-${session.userId}-${Date.now()}`;
  const script = [
    `My name is FunctionTestUser. Target role: QA Engineer. Ref: ${fingerprint}.`,
    'I worked at TestCorp using automated testing and API validation.',
    `Please generate my CV. Ref: ${fingerprint}.`,
  ];

  let cvMarkdown = '';
  let lastPipeline: string | null = null;
  for (let i = 0; i < script.length; i++) {
    const stepId = `FT-005-${i + 1}`;
    const msg = script[i];
    results.push(
      await runCase(stepId, `CV builder step ${i + 1}`, async () => {
        const res = await sendAgentMessage(session, 'cv_builder', msg, agentSessionId || undefined);
        if (!res.ok) throw new Error(res.error);
        if (!agentSessionId && res.data?.session_id && typeof res.data.session_id === 'string') {
          agentSessionId = res.data.session_id;
        }
        const md = extractCvMarkdown(res.data);
        if (md) cvMarkdown = md;
        lastPipeline = extractPipelineState(res.data);
        console.log(`  step ${i + 1}: pipeline=${lastPipeline ?? 'n/a'}, cv=${md ? 'yes' : 'no'}`);
      })
    );
  }

  results.push(
    await runCase('FT-006', 'CV content assertions', async () => {
      for (let attempt = 0; attempt < 3 && !cvMarkdown; attempt++) {
        const res = await sendAgentMessage(
          session,
          'cv_builder',
          attempt === 0 ? 'confirm' : '__action:confirm',
          agentSessionId
        );
        if (res.ok) {
          lastPipeline = extractPipelineState(res.data);
          const md = extractCvMarkdown(res.data);
          if (md) cvMarkdown = md;
        }
      }

      const { passed, errors } = runAssertions(cvMarkdown, {
        must_contain: [fingerprint],
        must_not_contain: ['Aizhan', 'Bekzat', 'Choco-Bekzat-02'],
      });

      if (!cvMarkdown) {
        throw new Error(
          `No CV generated (pipeline=${lastPipeline ?? 'unknown'}). ` +
            'Test user may need onboarding or backend CV generation. ' +
            errors.join('; ')
        );
      }
      if (!passed) throw new Error(errors.join('; '));
    })
  );

  const report = buildReport('function', startedAt, results);
  await writeReport(report, 'function-test');
  console.log(`\nFunction Test: ${report.passed ? 'PASS' : 'FAIL'} (${report.summary.passed}/${report.summary.total})`);
  process.exit(report.passed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
