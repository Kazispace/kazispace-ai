import type { AssertionResult, UserAssertions, UserRunResult } from './types.js';

function normalize(text: string): string {
  return text.toLowerCase();
}

export function runAssertions(
  cvMarkdown: string | undefined,
  assert: UserAssertions,
  extraBlocklist: string[] = [],
  technical: { maxLatencyMs?: number; latencyMs?: number } = {}
): { results: AssertionResult[]; passed: boolean; errors: string[] } {
  const results: AssertionResult[] = [];
  const errors: string[] = [];
  const body = cvMarkdown ?? '';

  if (!body || body.length < 100) {
    results.push({
      type: 'technical',
      field: 'cv_length',
      passed: false,
      detail: `CV markdown too short (${body.length} chars)`,
    });
    errors.push('CV output missing or too short');
  } else {
    results.push({
      type: 'technical',
      field: 'cv_length',
      passed: true,
      detail: `${body.length} chars`,
    });
  }

  if (technical.latencyMs !== undefined && technical.maxLatencyMs !== undefined) {
    const ok = technical.latencyMs <= technical.maxLatencyMs;
    results.push({
      type: 'technical',
      field: 'latency',
      passed: ok,
      detail: `${technical.latencyMs}ms (max ${technical.maxLatencyMs}ms)`,
    });
    if (!ok) errors.push(`Latency exceeded: ${technical.latencyMs}ms`);
  }

  const normalizedBody = normalize(body);

  for (const term of assert.must_contain) {
    const passed = normalizedBody.includes(normalize(term));
    results.push({ type: 'must_contain', field: term, passed });
    if (!passed) errors.push(`Missing required term: "${term}"`);
  }

  const allBlocked = [...assert.must_not_contain, ...extraBlocklist];
  const seen = new Set<string>();
  for (const term of allBlocked) {
    if (!term || seen.has(term)) continue;
    seen.add(term);
    const passed = !normalizedBody.includes(normalize(term));
    results.push({ type: 'must_not_contain', field: term, passed });
    if (!passed) errors.push(`Cross-contamination detected: "${term}"`);
  }

  const passed = results.every((r) => r.passed);
  return { results, passed, errors };
}

export function summarizeUserResults(results: UserRunResult[]): {
  total: number;
  passed: number;
  failed: number;
} {
  const passed = results.filter((r) => r.passed).length;
  return { total: results.length, passed, failed: results.length - passed };
}
