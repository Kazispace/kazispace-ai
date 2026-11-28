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
  types: null as Record<string, string[]> | null,
  sets: [] as unknown[],
  createSpace: vi.fn(),
  sendSpaceTurn: vi.fn(),
  deleteSpace: vi.fn(),
  getSpace: vi.fn(),
  fetchChatHistory: vi.fn(),
}));

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/lib/exam-form/api', () => ({
  getExamCatalog: async () => (api.exams ? { exams: api.exams, types: api.types } : null),
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
  EtFormBlock: ({ form, active, onSubmit, onCancel }: {
    form: { kind: string }; active: boolean; onSubmit?: (s: unknown) => void; onCancel?: () => void;
  }) => (
    <>
      <button
        type="button"
        data-testid={`form-${form.kind}`}
        data-active={active ? '1' : '0'}
        onClick={() => onSubmit?.({ display: 'answers', meta: { action_type: 'et_form_submit', form_id: 'et:objective_set:x' } })}
      />
      {/* The real block asks first; here a tap stands in for "confirmed". */}
      {onCancel ? <button type="button" data-testid={`cancel-${form.kind}`} onClick={() => onCancel()} /> : null}
    </>
  ),
}));

let ExamFormPanel: typeof import('./exam-form-panel').ExamFormPanel;

beforeAll(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  ({ ExamFormPanel } = await import('./exam-form-panel'));
});

// Each kind in the one (presentation, control) shape the form contract allows.
const SHAPE: Record<string, { presentation: string; control: string }> = {
  objective_set: { presentation: 'inline', control: 'objective_set' },
  writing_draft: { presentation: 'modal', control: 'textarea' },
  writing_revision: { presentation: 'modal', control: 'textarea' },
};

const turnResponse = (kind: string | null, text = 'reply') => ({
  success: true,
  data: { envelope: { reply: text, assistant_response: { content: text, meta: kind ? { form: {
    form_id: `et:${kind}:x`, kind, ...SHAPE[kind], title: 't', options: [],
    items: kind === 'objective_set' ? [{ item_id: 'q1', item_kind: 'mcq', prompt_text: 'p', options: ['a', 'b'] }] : [],
  } } : {} } } },
});

/** A stored tutor reply as chat history returns it (the same envelope shape as a turn response). */
const historyRow = (id: string, kind: string | null, text = 'reply') => ({
  id, role: 'assistant', content: text, ...turnResponse(kind, text).data.envelope,
});

const settle = () => act(async () => {
  await new Promise((r) => setTimeout(r, 0));
});

const openSet = { id: 'sp_open', name: '雅思 IELTS · 写作 · 11月27日', template_id: 'exam_form', status: 'active', master_session_id: 's', last_active_at: '2026-11-27T10:00:00Z' };

let root: Root | null = null;
let host: HTMLDivElement | null = null;

async function render() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<ExamFormPanel locale="zh" />);
  });
  // Home reads the exams and sets, then the newest set's turns: let every request settle.
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

const q = (id: string) => host!.querySelector<HTMLElement>(`[data-testid="${id}"]`);

beforeEach(() => {
  clearCurrentSet();
  api.exams = ['ielts', 'cet4', 'pet', 'fce'];
  api.types = null;
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
    expect(readCurrentSet()).toMatchObject({ spaceId: 'sp_form1', exam: 'cet4', type: 'grammar' });
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

  it('a draft sent back to finish is still in progress; the set is marked only when the reply has no answer form', async () => {
    api.sendSpaceTurn
      .mockResolvedValueOnce(turnResponse('writing_draft'))
      .mockResolvedValueOnce(turnResponse('writing_draft', 'Too short: add a paragraph.'))
      .mockResolvedValueOnce(turnResponse('writing_revision', 'Band 6. Revise?'));
    await render();
    await act(async () => {
      q('exam-form-start-ielts-writing')!.click();
    });
    await settle();
    await act(async () => {
      q('form-writing_draft')!.click();
    });
    await settle();
    expect(q('exam-form-done-back')).toBeNull();
    expect(readCurrentSet()).toMatchObject({ spaceId: 'sp_form1', exam: 'ielts', type: 'writing' });
    const drafts = host!.querySelectorAll('[data-testid="form-writing_draft"]');
    expect(drafts[drafts.length - 1].getAttribute('data-active')).toBe('1');
    await act(async () => {
      (drafts[drafts.length - 1] as HTMLElement).click();
    });
    await settle();
    expect(q('exam-form-done-back')).not.toBeNull();
    expect(readCurrentSet()).toBeNull();
    // The revision editor after marking stays usable.
    expect(q('form-writing_revision')?.getAttribute('data-active')).toBe('1');
  });

  it('the set in progress comes from the server, so it locks the list on a device that did not start it', async () => {
    api.sets = [openSet];
    api.fetchChatHistory.mockResolvedValue({ success: true, data: { messages: [historyRow('m1', 'writing_draft')] } });
    await render();
    expect(q('exam-form-in-progress-title')?.textContent).toBe('雅思 IELTS · 写作 · 11月27日');
    expect(q('exam-form-locked')).not.toBeNull();
    expect((q('exam-form-start-cet4-grammar') as HTMLButtonElement).disabled).toBe(true);
    expect(host!.querySelectorAll('[data-testid="exam-form-history-row"]').length).toBe(0);
  });

  it('a set whose last reply has no answer form is history, even if this device remembers it as open', async () => {
    writeCurrentSet({ spaceId: 'sp_open', exam: 'ielts', type: 'writing' });
    api.sets = [openSet];
    api.fetchChatHistory.mockResolvedValue({ success: true, data: { messages: [historyRow('m1', null, 'Band 6')] } });
    await render();
    expect(q('exam-form-in-progress')).toBeNull();
    expect(readCurrentSet()).toBeNull();
    expect(host!.querySelectorAll('[data-testid="exam-form-history-row"]').length).toBe(1);
  });

  it('drop removes the set and unlocks the list; a failed drop keeps it locked and says so', async () => {
    writeCurrentSet({ spaceId: 'sp_open', exam: 'ielts', type: 'writing' });
    api.sets = [openSet];
    api.fetchChatHistory.mockResolvedValue({ success: true, data: { messages: [historyRow('m1', 'writing_draft')] } });
    await render();
    expect(q('exam-form-in-progress-title')?.textContent).toBe('exams.ielts · types.writing');
    api.deleteSpace.mockResolvedValueOnce({ success: false, error: 'x' });
    await act(async () => {
      q('exam-form-drop')!.click();
    });
    await settle();
    expect(host!.textContent).toContain('dropFailed');
    expect(readCurrentSet()).toMatchObject({ spaceId: 'sp_open' });
    expect((q('exam-form-start-cet4-grammar') as HTMLButtonElement).disabled).toBe(true);
    api.sets = [];
    await act(async () => {
      q('exam-form-drop')!.click();
    });
    await settle();
    expect(api.deleteSpace).toHaveBeenLastCalledWith('sp_open');
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

  it('Cancel on the answer card drops the set like Drop this set: deleted, back on the list, unlocked (KAZI-1505)', async () => {
    await render();
    await act(async () => {
      q('exam-form-start-cet4-grammar')!.click();
    });
    await settle();
    api.sets = [];
    await act(async () => {
      q('cancel-objective_set')!.click();
    });
    await settle();
    await settle();
    expect(api.deleteSpace).toHaveBeenCalledWith('sp_form1');
    expect(api.sendSpaceTurn).toHaveBeenCalledTimes(1); // no turn is sent for a cancel
    expect(readCurrentSet()).toBeNull();
    expect(q('exam-form-home')).not.toBeNull();
    expect((q('exam-form-start-cet4-grammar') as HTMLButtonElement).disabled).toBe(false);
  });

  it('a failed Cancel keeps the set open and says so', async () => {
    api.deleteSpace.mockResolvedValue({ success: false, error: 'x' });
    await render();
    await act(async () => {
      q('exam-form-start-cet4-grammar')!.click();
    });
    await settle();
    await act(async () => {
      q('cancel-objective_set')!.click();
    });
    await settle();
    expect(q('exam-form-practice')).not.toBeNull();
    expect(host!.textContent).toContain('dropFailed');
    expect(readCurrentSet()).toMatchObject({ spaceId: 'sp_form1' });
  });

  it('once the set is marked there is nothing to cancel', async () => {
    api.sendSpaceTurn
      .mockResolvedValueOnce(turnResponse('objective_set'))
      .mockResolvedValueOnce(turnResponse(null, '4 / 5 correct'));
    await render();
    await act(async () => {
      q('exam-form-start-cet4-grammar')!.click();
    });
    await settle();
    await act(async () => {
      q('form-objective_set')!.click();
    });
    await settle();
    expect(q('cancel-objective_set')).toBeNull();
  });
});
