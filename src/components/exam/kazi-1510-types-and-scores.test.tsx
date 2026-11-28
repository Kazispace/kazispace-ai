/**
 * @vitest-environment jsdom
 *
 * KAZI-1510 — Form mode reads each exam's problem types from the server and shows each past set's score
 * (kazispace-ui Exam 0.10, D47). Owen, 2026-11-28, quoted as written: 「标题可以固定 做过的题集显示得分 考试的题型由服务器下发」.
 *
 * - Problem types: `english_exam_problem_types` on `GET /api/v1/me`; missing, `{}` or no entry for an exam ⇒ this
 *   app's own table for that exam; an exam whose list is empty is not shown.
 * - History rows: `form_result` on `GET /api/v1/spaces?include_form=true`: "3 / 5", or "4.00 / 6" for writing and
 *   speaking; `null` or no key ⇒ no score.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearCurrentSet,
  formResultLabel,
  parseFormResult,
  parseServedProblemTypes,
  problemTypesFor,
  shownExams,
} from '@/lib/exam-form/model';

const api = vi.hoisted(() => ({
  me: {} as Record<string, unknown>,
  spaces: [] as Record<string, unknown>[],
}));

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
// The real reads, over a stubbed transport: so the parsing of both fields is covered end to end.
vi.mock('@/lib/api-client', () => ({
  apiRequest: async (path: string) =>
    path === '/api/v1/me'
      ? { success: true, data: api.me }
      : { success: true, data: { spaces: api.spaces } },
  fetchChatHistory: async () => ({ success: true, data: { messages: [] } }),
}));
vi.mock('@/lib/spaces-api', async () => {
  const real = await vi.importActual<typeof import('@/lib/spaces-api')>('@/lib/spaces-api');
  return {
    normalizeSpaceSummary: real.normalizeSpaceSummary,
    createSpace: vi.fn(),
    sendSpaceTurn: vi.fn(),
    deleteSpace: vi.fn(),
    getSpace: async () => ({ success: true, data: { master_session_id: 'm' } }),
  };
});
vi.mock('@/components/clinic/markdown-content', () => ({
  MarkdownContent: ({ content }: { content: string }) => <p>{content}</p>,
}));
vi.mock('@/components/english/envelope/et-form-block', () => ({ EtFormBlock: () => null }));

let ExamFormPanel: typeof import('./exam-form-panel').ExamFormPanel;

beforeAll(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  ({ ExamFormPanel } = await import('./exam-form-panel'));
});

let root: Root | null = null;
let host: HTMLDivElement | null = null;

async function render() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<ExamFormPanel locale="zh" />);
  });
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

const starts = () =>
  Array.from(host!.querySelectorAll('[data-testid^="exam-form-start-"]')).map((b) =>
    b.getAttribute('data-testid')!.replace('exam-form-start-', ''),
  );

const set = (id: string, at: string, form_result?: unknown) => ({
  id, name: `set ${id}`, template_id: 'exam_form', status: 'active', master_session_id: id, last_active_at: at,
  ...(form_result === undefined ? {} : { form_result }),
});

beforeEach(() => {
  clearCurrentSet();
  api.me = { english_exams: ['ielts', 'cet4'] };
  api.spaces = [];
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

describe('KAZI-1510 model', () => {
  it('reads the server list in the fixed order, known types only', () => {
    expect(parseServedProblemTypes({ ielts: ['speaking', 'grammar', 'listening'], cet4: [] })).toEqual({
      ielts: ['grammar', 'speaking'],
      cet4: [],
    });
    expect(parseServedProblemTypes(undefined)).toBeNull();
    expect(parseServedProblemTypes(['grammar'])).toBeNull();
  });

  it("uses the server's entry when there is one, else the fallback table", () => {
    expect(problemTypesFor('ielts', { ielts: ['writing'] })).toEqual(['writing']);
    expect(problemTypesFor('ielts', {})).toEqual(['grammar', 'vocabulary', 'writing', 'speaking']);
    expect(problemTypesFor('ielts', null)).toEqual(['grammar', 'vocabulary', 'writing', 'speaking']);
    expect(shownExams(['ielts', 'cet4'], { ielts: ['writing'], cet4: [] })).toEqual(['ielts']);
    expect(shownExams(['ielts', 'cet4'], null)).toEqual(['ielts', 'cet4']);
  });

  it('formats both result kinds; anything else is no score', () => {
    expect(formResultLabel(parseFormResult({ kind: 'score', correct: 3, total: 5 }))).toBe('3 / 5');
    expect(formResultLabel(parseFormResult({ kind: 'band', score: 4, max: 6 }))).toBe('4.00 / 6');
    expect(formResultLabel(parseFormResult({ kind: 'band', score: 5.48, max: 6.0 }))).toBe('5.48 / 6');
    expect(parseFormResult(null)).toBeNull();
    expect(parseFormResult({ kind: 'score', correct: '3', total: 5 })).toBeNull();
    expect(parseFormResult({ kind: 'grade', score: 1, max: 6 })).toBeNull();
  });
});

describe('KAZI-1510 Form page', () => {
  it("lists exactly the server's problem types under each exam", async () => {
    api.me = { english_exams: ['ielts', 'cet4'], english_exam_problem_types: { ielts: ['writing', 'speaking'], cet4: ['grammar'] } };
    await render();
    expect(starts()).toEqual(['ielts-writing', 'ielts-speaking', 'cet4-grammar']);
  });

  it('hides an exam whose list is empty; falls back for an exam with no entry', async () => {
    api.me = { english_exams: ['ielts', 'cet4'], english_exam_problem_types: { ielts: [] } };
    await render();
    expect(host!.querySelector('[data-testid="exam-form-group-ielts"]')).toBeNull();
    expect(starts()).toEqual(['cet4-grammar', 'cet4-vocabulary', 'cet4-writing']);
  });

  it('every exam hidden ⇒ the "no exam list" state', async () => {
    api.me = { english_exams: ['ielts'], english_exam_problem_types: { ielts: [] } };
    await render();
    expect(host!.querySelector('[data-testid="exam-form-no-list"]')).not.toBeNull();
    expect(starts()).toEqual([]);
  });

  it('an older server (no field) keeps the fallback table', async () => {
    await render();
    expect(starts()).toEqual([
      'ielts-grammar', 'ielts-vocabulary', 'ielts-writing', 'ielts-speaking',
      'cet4-grammar', 'cet4-vocabulary', 'cet4-writing',
    ]);
  });

  it("each past set's row shows its score; not marked or no key ⇒ none", async () => {
    api.spaces = [
      set('a', '2026-11-28T03:00:00Z', { kind: 'score', correct: 3, total: 5 }),
      set('b', '2026-11-28T02:00:00Z', { kind: 'band', score: 4, max: 6 }),
      set('c', '2026-11-28T01:00:00Z', null),
      set('d', '2026-11-28T00:00:00Z'),
    ];
    await render();
    const rows = Array.from(host!.querySelectorAll('[data-testid="exam-form-history-row"]'));
    expect(rows.map((r) => r.querySelector('[data-testid="exam-form-history-score"]')?.textContent ?? null)).toEqual([
      '3 / 5', '4.00 / 6', null, null,
    ]);
    expect(rows[0].textContent).toContain('set a');
  });
});
