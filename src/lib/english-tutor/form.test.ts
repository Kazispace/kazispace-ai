import { describe, expect, it } from 'vitest';

import {
  buildEtFormSubmit,
  ET_FORM_SUBMIT_ACTION_TYPE,
  isLatestTurn,
  parseEtForm,
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
