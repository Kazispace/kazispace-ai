/**
 * @vitest-environment jsdom
 *
 * KAZI-1493 — Exam · Form mode (kazispace-ui Exam 0.7.2, D43–D45). Owen, 2026-11-27, quoted as written:
 * "为什么计费两次？ 不能接受。" and "答完题之前不能点击。 点完后， 过去的题集作为历史保存 并显示。 用户可以再点击。"
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CAMBRIDGE_EXAMS,
  clearCurrentSet,
  groupExams,
  isAnswerForm,
  presetTurn,
  problemTypesFor,
  readCurrentSet,
  setName,
  writeCurrentSet,
} from '@/lib/exam-form/model';

const api = vi.hoisted(() => ({
  exams: ['ielts', 'cet4', 'pet', 'fce'] as string[] | null,
  sets: [] as unknown[],
  createSpace: vi.fn(),
  sendSpaceTurn: vi.fn(),
  deleteSpace: vi.fn(),
  getSpace: vi.fn(),
  fetchChatHistory: vi.fn(),
}));

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/lib/exam-form/api', () => ({
  getEnglishExams: async () => api.exams,
  listFormSets: async () => api.sets,
}));
vi.mock('@/lib/spaces-api', () => ({
  createSpace: (...a: unknown[]) => api.createSpace(...a),
  sendSpaceTurn: (...a: unknown[]) => api.sendSpaceTurn(...a),
  deleteSpace: (...a: unknown[]) => api.deleteSpace(...a),
  getSpace: (...a: unknown[]) => api.getSpace(...a),
}));
vi.mock('@/lib/api-client', () => ({ fetchChatHistory: (...a: unknown[]) => api.fetchChatHistory(...a) }));
vi.mock('@/components/clinic/markdown-content', () => ({
  MarkdownContent: ({ content }: { content: string }) => <p>{content}</p>,
}));
// The real block is covered by its own tests; here a button stands in for "the user submitted this form".
vi.mock('@/components/english/envelope/et-form-block', () => ({
  EtFormBlock: ({ form, active, onSubmit }: { form: { kind: string }; active: boolean; onSubmit?: (s: unknown) => void }) => (
    <button
      type="button"
      data-testid={`form-${form.kind}`}
      data-active={active ? '1' : '0'}
      onClick={() => onSubmit?.({ display: 'answers', meta: { action_type: 'et_form_submit', form_id: 'et:objective_set:x' } })}
    />
  ),
}));

let ExamFormPanel: typeof import('./exam-form-panel').ExamFormPanel;

beforeAll(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  ({ ExamFormPanel } = await import('./exam-form-panel'));
});

const turnResponse = (kind: string | null, text = 'reply') => ({
  success: true,
  data: { envelope: { reply: text, assistant_response: { content: text, meta: kind ? { form: {
    form_id: `et:${kind}:x`, kind, presentation: 'inline', control: kind === 'objective_set' ? 'objective_set' : 'radio',
    title: 't', options: [], items: kind === 'objective_set' ? [{ item_id: 'q1', item_kind: 'mcq', prompt_text: 'p', options: ['a', 'b'] }] : [],
  } } : {} } } },
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
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

const q = (id: string) => host!.querySelector<HTMLElement>(`[data-testid="${id}"]`);

beforeEach(() => {
  clearCurrentSet();
  api.exams = ['ielts', 'cet4', 'pet', 'fce'];
  api.sets = [];
  api.createSpace.mockReset().mockResolvedValue({ success: true, data: { id: 'sp_form1' } });
  api.sendSpaceTurn.mockReset().mockResolvedValue(turnResponse('objective_set'));
  api.deleteSpace.mockReset().mockResolvedValue({ success: true });
  api.getSpace.mockReset().mockResolvedValue({ success: true, data: { master_session_id: 'sess_sp_form1' } });
  api.fetchChatHistory.mockReset().mockResolvedValue({ success: true, data: { messages: [] } });
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

describe('Form mode model', () => {
  it('groups the Cambridge levels where the first appears, keeping the server order', () => {
    expect(groupExams(['cet4', 'pet', 'ielts', 'fce'])).toEqual([
      { id: 'cet4', exams: ['cet4'] },
      { id: 'cambridge', exams: ['pet', 'fce'] },
      { id: 'ielts', exams: ['ielts'] },
    ]);
    expect(CAMBRIDGE_EXAMS).toEqual(['pet', 'fce', 'cae']);
  });

  it('lists reading only for Gaokao', () => {
    expect(problemTypesFor('gaokao')).toContain('reading');
    expect(problemTypesFor('cet4')).not.toContain('reading');
    expect(problemTypesFor('ielts')).toContain('speaking');
  });

  it('the preset turn is the Chat sentence with the exam attached and no form id (D45)', () => {
    const turn = presetTurn('cet4', 'grammar');
    expect(turn).toEqual({ message: '练语法', meta: { action_type: 'et_form_preset', exam_type: 'cet4' } });
    expect(turn.meta).not.toHaveProperty('form_id');
    expect(presetTurn('gaokao', 'reading').message).toBe('练阅读'); // Chat's own way into Gaokao reading
  });

  it('names a set by exam, problem type and day; remembers the set in progress', () => {
    expect(setName('CET-4', '语法', 'zh', new Date('2026-11-27T12:00:00Z'))).toMatch(/^CET-4 · 语法 · 11月2[678]日$/);
    writeCurrentSet({ spaceId: 'sp_1', exam: 'cet4', type: 'grammar' });
    expect(readCurrentSet()).toEqual({ spaceId: 'sp_1', exam: 'cet4', type: 'grammar' });
    clearCurrentSet();
    expect(readCurrentSet()).toBeNull();
    expect(isAnswerForm('objective_set')).toBe(true);
    expect(isAnswerForm('exam_select')).toBe(false);
  });
});

describe('Form mode page', () => {
  it('with no exam list, points to Chat and offers nothing to tap', async () => {
    api.exams = null;
    await render();
    expect(q('exam-form-no-list')?.textContent).toBe('noList');
    expect(host!.querySelectorAll('[data-testid^="exam-form-start-"]').length).toBe(0);
  });

  it("lists the user's exams in the server's order with their problem types; Cambridge is one group", async () => {
    await render();
    const groups = Array.from(host!.querySelectorAll('[data-testid^="exam-form-group-"]')).map((g) => g.getAttribute('data-testid'));
    expect(groups).toEqual(['exam-form-group-ielts', 'exam-form-group-cet4', 'exam-form-group-cambridge']);
    expect(q('exam-form-start-ielts-speaking')).not.toBeNull();
    expect(q('exam-form-start-cet4-reading')).toBeNull();
  });

  it('a tap starts a set with ONE turn: an exam_form space, then the preset message with the exam', async () => {
    await render();
    await act(async () => {
      q('exam-form-start-cet4-grammar')!.click();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(api.createSpace).toHaveBeenCalledTimes(1);
    const body = api.createSpace.mock.calls[0][0];
    expect(body.template_id).toBe('exam_form');
    expect(body.name).toMatch(/^exams\.cet4 · types\.grammar · /);
    expect(api.sendSpaceTurn).toHaveBeenCalledTimes(1);
    expect(api.sendSpaceTurn.mock.calls[0]).toEqual([
      'sp_form1',
      { message: '练语法', meta: { action_type: 'et_form_preset', exam_type: 'cet4' } },
    ]);
    expect(q('form-objective_set')?.getAttribute('data-active')).toBe('1');
    expect(readCurrentSet()).toEqual({ spaceId: 'sp_form1', exam: 'cet4', type: 'grammar' });
  });

  it('submitting the set marks it done, unlocks the list and offers the way back', async () => {
    api.sendSpaceTurn
      .mockResolvedValueOnce(turnResponse('objective_set'))
      .mockResolvedValueOnce(turnResponse(null, '4 / 5 correct'));
    await render();
    await act(async () => {
      q('exam-form-start-cet4-grammar')!.click();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    await act(async () => {
      q('form-objective_set')!.click();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(api.sendSpaceTurn).toHaveBeenCalledTimes(2);
    expect(api.sendSpaceTurn.mock.calls[1][1]).toEqual({
      message: 'answers', meta: { action_type: 'et_form_submit', form_id: 'et:objective_set:x' },
    });
    expect(host!.textContent).toContain('4 / 5 correct');
    expect(q('exam-form-done-back')).not.toBeNull();
    expect(readCurrentSet()).toBeNull();
  });

  it('a set in progress locks the list until it is continued to the end or dropped', async () => {
    writeCurrentSet({ spaceId: 'sp_open', exam: 'ielts', type: 'writing' });
    api.sets = [{ id: 'sp_open', name: 'n', template_id: 'exam_form', status: 'active', master_session_id: 's', last_active_at: null }];
    await render();
    expect(q('exam-form-in-progress')).not.toBeNull();
    expect(q('exam-form-locked')).not.toBeNull();
    expect((q('exam-form-start-cet4-grammar') as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {
      q('exam-form-drop')!.click();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(api.deleteSpace).toHaveBeenCalledWith('sp_open');
    expect(readCurrentSet()).toBeNull();
    expect((q('exam-form-start-cet4-grammar') as HTMLButtonElement).disabled).toBe(false);
  });

  it('a remembered set that no longer exists does not lock the list', async () => {
    writeCurrentSet({ spaceId: 'sp_gone', exam: 'ielts', type: 'writing' });
    api.sets = [];
    await render();
    expect(q('exam-form-in-progress')).toBeNull();
    expect(readCurrentSet()).toBeNull();
  });

  it('past sets are listed as history, newest first, apart from the one in progress', async () => {
    api.sets = [
      { id: 'sp_a', name: '大学英语四级 · 语法 · 11月27日', template_id: 'exam_form', status: 'active', master_session_id: 'a', last_active_at: '2026-11-27T10:00:00Z' },
      { id: 'sp_b', name: '雅思 IELTS · 写作 · 11月26日', template_id: 'exam_form', status: 'active', master_session_id: 'b', last_active_at: '2026-11-26T10:00:00Z' },
    ];
    await render();
    const rows = Array.from(host!.querySelectorAll('[data-testid="exam-form-history-row"]')).map((r) => r.textContent);
    expect(rows).toEqual(['大学英语四级 · 语法 · 11月27日', '雅思 IELTS · 写作 · 11月26日']);
  });
});
