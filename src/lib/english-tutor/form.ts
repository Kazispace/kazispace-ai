/**
 * KAZI-1041 · english_tutor input form contract `meta.form`
 * (design: ET graph SSOT §5.3.6; backend: KAZI-1040).
 *
 * One assistant turn carries at most one form. The form only describes the
 * view — answers still go through the normal chat send path, tagged with
 * `meta = {action_type: 'et_form_submit', form_id, action_payload?}`.
 *
 * Freeze rule: only the **latest** message's form is interactive. ⛔ Never
 * freeze by `form_id` — the backend re-sends the same id when it re-asks
 * (e.g. `SHORT_DRAFT` re-sends `et:writing_draft:<qid>`).
 */
import type { UserMessageActionMeta } from '@/types/chat-envelope';

export const ET_FORM_SUBMIT_ACTION_TYPE = 'et_form_submit';

export type EtFormKind = 'exam_select' | 'writing_draft' | 'writing_revision' | 'speaking_answer';

export interface EtFormOption {
  id: string;
  label: string;
}

export interface EtForm {
  form_id: string;
  kind: EtFormKind;
  presentation: 'inline' | 'modal';
  control: 'radio' | 'textarea' | 'audio';
  title: string;
  prompt: string | null;
  options: EtFormOption[];
  submit_label: string;
  constraints?: { min_words?: number; max_chars?: number };
  allow_text?: boolean;
}

/** kind → the only (presentation, control) pair the contract allows. */
const SHAPE_BY_KIND: Record<EtFormKind, Pick<EtForm, 'presentation' | 'control'>> = {
  exam_select: { presentation: 'inline', control: 'radio' },
  writing_draft: { presentation: 'modal', control: 'textarea' },
  // KAZI-1044: after grading, the backend offers a revision editor (same shape as the draft).
  writing_revision: { presentation: 'modal', control: 'textarea' },
  speaking_answer: { presentation: 'inline', control: 'audio' },
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readPositive(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

/**
 * Parse `meta.form`. Anything off-contract ⇒ `null` (render nothing and let
 * the user type, which the backend still accepts) — never a half-built form.
 */
export function parseEtForm(meta?: Record<string, unknown> | null): EtForm | null {
  const raw = asRecord(meta?.form);
  if (!raw) return null;

  const formId = readString(raw.form_id);
  const kind = readString(raw.kind) as EtFormKind | undefined;
  if (!formId || !kind || !(kind in SHAPE_BY_KIND)) return null;

  const shape = SHAPE_BY_KIND[kind];
  if (raw.presentation !== shape.presentation || raw.control !== shape.control) return null;

  const options: EtFormOption[] = [];
  if (Array.isArray(raw.options)) {
    for (const item of raw.options) {
      const row = asRecord(item);
      const id = readString(row?.id);
      const label = readString(row?.label);
      if (id && label) options.push({ id, label });
    }
  }
  if (shape.control === 'radio' && options.length === 0) return null;

  const form: EtForm = {
    form_id: formId,
    kind,
    ...shape,
    title: readString(raw.title) ?? '',
    prompt: readString(raw.prompt) ?? null,
    options,
    submit_label: readString(raw.submit_label) ?? '',
  };

  const constraints = asRecord(raw.constraints);
  if (shape.control === 'textarea' && constraints) {
    form.constraints = {
      ...(readPositive(constraints.min_words) ? { min_words: readPositive(constraints.min_words) } : {}),
      ...(readPositive(constraints.max_chars) ? { max_chars: readPositive(constraints.max_chars) } : {}),
    };
  }
  if (shape.control === 'audio') form.allow_text = raw.allow_text === true;
  return form;
}

export interface EtFormSubmit {
  /** Text the user bubble shows; also the chat `content`. */
  display: string;
  meta: UserMessageActionMeta;
}

/**
 * Build the chat send for a form answer (SSOT §5.3.6.3).
 * - radio: `content` = option label, `action_payload` = option id
 *   (backend swaps the routed text for it ⇒ parsers see `ielts`, not the label).
 * - textarea / audio / audio-typed: `content` = the text, no payload.
 */
export function buildEtFormSubmit(
  form: EtForm,
  answer: { optionId: string } | { text: string }
): EtFormSubmit | null {
  const base = { action_type: ET_FORM_SUBMIT_ACTION_TYPE, form_id: form.form_id };
  if ('optionId' in answer) {
    if (form.control !== 'radio') return null;
    const option = form.options.find((o) => o.id === answer.optionId);
    if (!option) return null;
    return { display: option.label, meta: { ...base, action_payload: option.id } };
  }
  const text = answer.text.trim();
  if (!text || form.control === 'radio') return null;
  return { display: text, meta: base };
}

/**
 * Word count for the essay hint only — whitespace tokens. ⛔ Not the gate:
 * the backend decides (`SHORT_DRAFT`) with its own CJK-aware count, so the
 * editor never blocks submit on this number.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** The freeze rule: a turn is interactive only if no message follows it. */
export function isLatestTurn(messages: ReadonlyArray<unknown>, messageIndex: number): boolean {
  return messageIndex === messages.length - 1;
}

/**
 * KAZI-1044: text to prefill the revision editor with — the nearest user
 * message before this turn (usually the essay that was just graded).
 * Local only: the backend form never carries user data (SSOT §5.3.6).
 * Only the latest turn gets a value (frozen forms can't be opened anyway).
 */
export function revisionPrefill(
  messages: ReadonlyArray<{ role: string; content: string }>,
  messageIndex: number
): string | undefined {
  if (!isLatestTurn(messages, messageIndex)) return undefined;
  for (let i = messageIndex - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') return messages[i].content.trim() || undefined;
  }
  return undefined;
}
