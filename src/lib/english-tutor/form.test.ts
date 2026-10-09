import { describe, expect, it } from 'vitest';

import {
  buildEtFormSubmit,
  ET_FORM_SUBMIT_ACTION_TYPE,
  isLatestTurn,
  parseEtForm,
  revisionPrefill,
  type EtForm,
} from '@/lib/english-tutor/form';
import { mapStrategySelectTurnContexts } from '@/lib/strategy-select';

/** Shapes copied from the KAZI-1040 staging write-back (JIRA comment 13492). */
const WRITING = {
  form_id: 'et:writing_draft:ielts_w_task2_discussion_media_015',
  kind: 'writing_draft',
  presentation: 'modal',
  control: 'textarea',
  title: '写作文',
  prompt: 'Social media improves democracy. Discuss both views.',
  options: [],
  submit_label: '提交作文',
  constraints: { min_words: 40, max_chars: 4000 },
};
const SPEAKING = {
  form_id: 'et:speaking_answer:ielts_s_part2_identity_002',
  kind: 'speaking_answer',
  presentation: 'inline',
  control: 'audio',
  title: '口语作答',
  prompt: 'Describe a person who has influenced your career.',
  options: [],
  submit_label: '提交回答',
  allow_text: true,
};
const EXAM = {
  form_id: 'et:exam_select',
  kind: 'exam_select',
  presentation: 'inline',
  control: 'radio',
  title: '选择目标考试',
  prompt: null,
  options: [
    { id: 'cet4', label: 'CET4（大学英语四级）' },
    { id: 'ielts', label: 'IELTS（雅思）' },
  ],
  submit_label: '确定',
};

function parsed(raw: Record<string, unknown>): EtForm {
  const form = parseEtForm({ form: raw });
  if (!form) throw new Error('expected a form');
  return form;
}

describe('parseEtForm', () => {
  it('reads the three backend kinds', () => {
    expect(parsed(WRITING)).toMatchObject({
      kind: 'writing_draft',
      presentation: 'modal',
      control: 'textarea',
      constraints: { min_words: 40, max_chars: 4000 },
    });
    expect(parsed(SPEAKING)).toMatchObject({ kind: 'speaking_answer', allow_text: true });
    expect(parsed(EXAM).options.map((o) => o.id)).toEqual(['cet4', 'ielts']);
  });

  it('no form key ⇒ no form (the turn takes free text)', () => {
    expect(parseEtForm({ event: 'writing_review' })).toBeNull();
    expect(parseEtForm(undefined)).toBeNull();
  });

  it.each([
    ['unknown kind (e.g. the withdrawn mode_select)', { ...EXAM, kind: 'mode_select' }],
    ['kind/shape mismatch', { ...WRITING, presentation: 'inline' }],
    ['radio without options', { ...EXAM, options: [] }],
    ['missing form_id', { ...WRITING, form_id: '' }],
  ])('off-contract ⇒ null: %s', (_name, raw) => {
    expect(parseEtForm({ form: raw })).toBeNull();
  });

  it('keeps constraints only on textarea and allow_text only on audio', () => {
    expect(parsed({ ...EXAM, constraints: { min_words: 40 } }).constraints).toBeUndefined();
    expect(parsed({ ...WRITING, allow_text: true }).allow_text).toBeUndefined();
  });
});

describe('buildEtFormSubmit (SSOT §5.3.6.3)', () => {
  it('radio: label is shown, option id rides action_payload', () => {
    expect(buildEtFormSubmit(parsed(EXAM), { optionId: 'ielts' })).toEqual({
      display: 'IELTS（雅思）',
      meta: {
        action_type: ET_FORM_SUBMIT_ACTION_TYPE,
        form_id: 'et:exam_select',
        action_payload: 'ielts',
      },
    });
  });

  it('textarea / audio: text is the content, no payload', () => {
    const essay = buildEtFormSubmit(parsed(WRITING), { text: '  My essay.  ' });
    expect(essay).toEqual({
      display: 'My essay.',
      meta: { action_type: ET_FORM_SUBMIT_ACTION_TYPE, form_id: WRITING.form_id },
    });
    expect(buildEtFormSubmit(parsed(SPEAKING), { text: 'I think…' })?.meta).not.toHaveProperty(
      'action_payload'
    );
  });

  it('refuses answers that do not fit the control', () => {
    expect(buildEtFormSubmit(parsed(EXAM), { optionId: 'toefl' })).toBeNull();
    expect(buildEtFormSubmit(parsed(EXAM), { text: 'IELTS' })).toBeNull();
    expect(buildEtFormSubmit(parsed(WRITING), { optionId: 'ielts' })).toBeNull();
    expect(buildEtFormSubmit(parsed(WRITING), { text: '   ' })).toBeNull();
  });
});

describe('freeze rule: position, never form_id', () => {
  it('only the last message is the latest turn', () => {
    const msgs = [{}, {}, {}];
    expect(msgs.map((_, i) => isLatestTurn(msgs, i))).toEqual([false, false, true]);
  });

  it('SHORT_DRAFT re-sends the same form_id — only the newer one is active', () => {
    const meta = { form: WRITING };
    const messages = [
      { role: 'assistant', content: 'Write about…', assistantMeta: meta },
      { role: 'user', content: 'too short' },
      { role: 'assistant', content: 'Send the full essay', assistantMeta: { ...meta, error: 'SHORT_DRAFT' } },
    ];
    const contexts = mapStrategySelectTurnContexts(messages, 'zh');
    expect(contexts.map((c) => c.latestTurn)).toEqual([false, false, true]);
    expect(parseEtForm(messages[0].assistantMeta)?.form_id).toBe(
      parseEtForm(messages[2].assistantMeta)?.form_id
    );
  });
});

describe('writing_revision (KAZI-1044)', () => {
  const REVISION = {
    ...WRITING,
    form_id: 'et:writing_revision:ielts_w_task2_discussion_media_015',
    kind: 'writing_revision',
    title: '修改作文',
    submit_label: '重新提交',
  };

  it('parses as a modal essay editor with the draft constraints', () => {
    const form = parsed(REVISION);
    expect(form).toMatchObject({ kind: 'writing_revision', presentation: 'modal', control: 'textarea' });
    expect(form.constraints).toEqual({ min_words: 40, max_chars: 4000 });
  });

  it('rejects an off-contract shape', () => {
    expect(parseEtForm({ form: { ...REVISION, presentation: 'inline' } })).toBeNull();
  });

  it('submits through the form channel with its own form_id', () => {
    expect(buildEtFormSubmit(parsed(REVISION), { text: 'Better essay.' })?.meta).toEqual({
      action_type: ET_FORM_SUBMIT_ACTION_TYPE,
      form_id: REVISION.form_id,
    });
  });

  const graded = { form: REVISION, grade_id: 'g1' };
  const followUp = { form: REVISION };

  it('prefill = the graded essay, only for the latest turn', () => {
    const messages = [
      { role: 'assistant', content: 'Write about…', assistantMeta: { form: WRITING } },
      { role: 'user', content: '  My essay.  ' },
      { role: 'assistant', content: 'Score 6.0', assistantMeta: graded },
    ];
    expect(revisionPrefill(messages, 2)).toBe('My essay.');
    expect(revisionPrefill(messages, 0)).toBeUndefined();
    expect(mapStrategySelectTurnContexts(messages, 'zh').map((c) => c.etFormPrefill)).toEqual([
      undefined,
      undefined,
      'My essay.',
    ]);
  });

  it('a follow-up question after grading does not replace the essay (review #224 🔴)', () => {
    const messages = [
      { role: 'user', content: 'My essay.' },
      { role: 'assistant', content: 'Score 6.0', assistantMeta: graded },
      { role: 'user', content: '第二条什么意思' },
      { role: 'assistant', content: 'It means…', assistantMeta: followUp },
    ];
    expect(revisionPrefill(messages, 3)).toBe('My essay.');
  });

  it('history rows keep only `form` (no grade_id): the earliest turn of the revision-form run anchors it', () => {
    const messages = [
      { role: 'user', content: 'My essay.' },
      { role: 'assistant', content: 'Score 6.0', assistantMeta: followUp },
      { role: 'user', content: '第二条什么意思' },
      { role: 'assistant', content: 'It means…', assistantMeta: followUp },
    ];
    expect(revisionPrefill(messages, 3)).toBe('My essay.');
  });

  it('after a graded revision, prefill is the revision (the newest graded draft)', () => {
    const messages = [
      { role: 'user', content: 'My essay.' },
      { role: 'assistant', content: 'Score 6.0', assistantMeta: graded },
      { role: 'user', content: 'My better essay.' },
      { role: 'assistant', content: 'Score 6.5', assistantMeta: { form: REVISION, grade_id: 'g2' } },
    ];
    expect(revisionPrefill(messages, 3)).toBe('My better essay.');
  });

  it('no revision form and no grade on the latest turn ⇒ no prefill', () => {
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi', assistantMeta: {} },
    ];
    expect(revisionPrefill(messages, 1)).toBeUndefined();
  });
});
