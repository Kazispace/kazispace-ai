import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TestReport } from './types.js';

export async function writeReport(report: TestReport, basename: string): Promise<string> {
  const dir = join(process.cwd(), 'reports');
  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = join(dir, `${basename}-${stamp}.json`);
  const mdPath = join(dir, `${basename}-${stamp}.md`);

  await writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  await writeFile(mdPath, formatMarkdown(report), 'utf8');

  console.log(`\nReport written:\n  ${jsonPath}\n  ${mdPath}`);
  return jsonPath;
}

function formatMarkdown(report: TestReport): string {
  const lines = [
    `# KaziSpace ${report.suite} Test Report`,
    '',
    `- **Started**: ${report.startedAt}`,
    `- **Finished**: ${report.finishedAt}`,
    `- **Duration**: ${report.durationMs}ms`,
    `- **Result**: ${report.passed ? 'PASS' : 'FAIL'}`,
    `- **Summary**: ${report.summary.passed}/${report.summary.total} passed`,
    '',
    '## Results',
    '',
    '| ID | Name | Result | Duration | Notes |',
    '|----|------|--------|----------|-------|',
  ];

  for (const r of report.results) {
    const note = r.error ?? (r.details ? JSON.stringify(r.details).slice(0, 80) : '');
    lines.push(
      `| ${r.id} | ${r.name} | ${r.passed ? 'PASS' : 'FAIL'} | ${r.durationMs}ms | ${note.replace(/\|/g, '/')} |`
    );
  }

  return lines.join('\n');
}

export function buildReport(
  suite: TestReport['suite'],
  startedAt: Date,
  results: TestReport['results']
): TestReport {
  const finishedAt = new Date();
  const passedCount = results.filter((r) => r.passed).length;
  return {
    suite,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    passed: passedCount === results.length,
    summary: {
      total: results.length,
      passed: passedCount,
      failed: results.length - passedCount,
    },
    results,
  };
}
