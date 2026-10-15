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

export type EtFormKind =
  | 'exam_select'
  | 'writing_draft'
  | 'writing_revision'
  | 'speaking_answer'
  | 'objective_set';

export interface EtFormOption {
  id: string;
  label: string;
}

/**
 * KAZI-1044 follow-up (ET SSOT §5.3.6.6): the follow-up box under the
 * revision card — "questions about the feedback?". A second entry on the
 * same form (still one form per turn); submitted through the form channel
 * with its own `form_id` so the backend explains instead of regrading.
 */
export interface EtFormFollowup {
  form_id: string;
  title: string;
  placeholder: string;
  submit_label: string;
  max_chars?: number;
}

export const ET_FOLLOWUP_FORM_ID_PREFIX = 'et:review_followup:';

/**
 * KAZI-1075 · one question of an `objective_set` form (ET SSOT §5.3.6.7 item 3).
 * The backend never sends the answer key, explanation or tags here — grading
 * happens server-side on submit.
 */
export interface EtObjectiveItem {
  item_id: string;
  /** `mcq` · `cloze` · `error_correction` today; anything else is still shown. */
  item_kind: string;
  prompt_text: string;
  /** Present ⇒ pick one (`mcq`, `error_correction`); absent ⇒ type the word (`cloze`). */
  options?: string[];
}

export interface EtForm {
  form_id: string;
  kind: EtFormKind;
  presentation: 'inline' | 'modal';
  control: 'radio' | 'textarea' | 'audio' | 'objective_set';
  title: string;
  prompt: string | null;
  options: EtFormOption[];
  submit_label: string;
  constraints?: { min_words?: number; max_chars?: number };
  allow_text?: boolean;
  /** Only on `writing_revision` (see `EtFormFollowup`). */
  followup?: EtFormFollowup;
  /** Only on `objective_set`: the questions, in the order the backend set them. */
  items?: EtObjectiveItem[];
}

/** kind → the only (presentation, control) pair the contract allows. */
const SHAPE_BY_KIND: Record<EtFormKind, Pick<EtForm, 'presentation' | 'control'>> = {
  exam_select: { presentation: 'inline', control: 'radio' },
  writing_draft: { presentation: 'modal', control: 'textarea' },
  // KAZI-1044: after grading, the backend offers a revision editor (same shape as the draft).
  writing_revision: { presentation: 'modal', control: 'textarea' },
  speaking_answer: { presentation: 'inline', control: 'audio' },
  // KAZI-1075: grammar / vocabulary set — all questions answered, then one submit.
  objective_set: { presentation: 'inline', control: 'objective_set' },
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
  const items = shape.control === 'objective_set' ? parseObjectiveItems(raw.items) : undefined;
  if (shape.control === 'objective_set' && !items) return null;

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
  if (kind === 'writing_revision') {
    const followup = parseFollowup(raw.followup);
    if (followup) form.followup = followup;
  }
  if (items) form.items = items;
  return form;
}

/**
 * KAZI-1075: every question must be answerable, or the whole form is dropped.
 * ⛔ No half-built set: the backend grades a missing question as wrong, so
 * silently hiding one would cost the learner a point they never saw.
 */
function parseObjectiveItems(value: unknown): EtObjectiveItem[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const items: EtObjectiveItem[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const row = asRecord(entry);
    const itemId = readString(row?.item_id);
    const prompt = readString(row?.prompt_text);
    if (!row || !itemId || !prompt || seen.has(itemId)) return undefined;
    seen.add(itemId);
    const item: EtObjectiveItem = { item_id: itemId, item_kind: readString(row.item_kind) ?? '', prompt_text: prompt };
    if (row.options !== undefined) {
      if (!Array.isArray(row.options)) return undefined;
      const options = row.options.filter((o): o is string => typeof o === 'string' && o.trim() !== '');
      if (options.length < 2 || options.length !== row.options.length) return undefined;
      item.options = options;
    }
    items.push(item);
  }
  return items;
}

/** The key the backend reads answers from (`objective_set.ANSWERS_KEY`). */
export const ET_OBJECTIVE_ANSWERS_KEY = 'answers';

/**
 * KAZI-1075 · the chat send for a whole set (SSOT §5.3.6.7 item 4).
 * - `action_payload` = JSON `{"answers": {item_id: value}}` — only answered
 *   questions; an unanswered one is simply absent (the backend grades it wrong).
 * - `content` = one line per question, so the user bubble shows what was sent.
 * At least one answer is required: an all-blank submit is a misclick, not a set.
 */
export function buildEtObjectiveSubmit(
  form: EtForm,
  answers: Readonly<Record<string, string>>
): EtFormSubmit | null {
  if (form.control !== 'objective_set' || !form.items) return null;
  const picked: Record<string, string> = {};
  const lines: string[] = [];
  form.items.forEach((item, index) => {
    const value = (answers[item.item_id] ?? '').trim();
    if (value) picked[item.item_id] = value;
    lines.push(`${index + 1}. ${value || '—'}`);
  });
  if (Object.keys(picked).length === 0) return null;
  return {
    display: lines.join('\n'),
    meta: {
      action_type: ET_FORM_SUBMIT_ACTION_TYPE,
      form_id: form.form_id,
      action_payload: JSON.stringify({ [ET_OBJECTIVE_ANSWERS_KEY]: picked }),
    },
  };
}

/**
 * KAZI-1075: for `error_correction`, mark where each option sits in the
 * sentence (the prompt says "underlined part"). Options are looked up in
 * order; if any one is missing the sentence is returned unmarked — ⛔ never a
 * partial underline that points at the wrong words.
 */
export function splitUnderlined(
  sentence: string,
  options: ReadonlyArray<string>
): Array<{ text: string; underlined: boolean }> {
  const parts: Array<{ text: string; underlined: boolean }> = [];
  let cursor = 0;
  for (const option of options) {
    const at = sentence.indexOf(option, cursor);
    if (at < 0) return [{ text: sentence, underlined: false }];
    if (at > cursor) parts.push({ text: sentence.slice(cursor, at), underlined: false });
    parts.push({ text: option, underlined: true });
    cursor = at + option.length;
  }
  if (cursor < sentence.length) parts.push({ text: sentence.slice(cursor), underlined: false });
  return parts;
}

/** Off-contract follow-up ⇒ dropped (the revision editor still renders). */
function parseFollowup(value: unknown): EtFormFollowup | undefined {
  const raw = asRecord(value);
  const formId = readString(raw?.form_id);
  // No button label ⇒ off-contract (a blank button is worse than no box; review #227).
  const submitLabel = readString(raw?.submit_label);
  if (!raw || !formId || !formId.startsWith(ET_FOLLOWUP_FORM_ID_PREFIX) || raw.control !== 'text' || !submitLabel) {
    return undefined;
  }
  const maxChars = readPositive(asRecord(raw.constraints)?.max_chars);
  return {
    form_id: formId,
    title: readString(raw.title) ?? '',
    placeholder: readString(raw.placeholder) ?? '',
    submit_label: submitLabel,
    ...(maxChars ? { max_chars: maxChars } : {}),
  };
}

/** A follow-up question ⇒ the same form channel, with the follow-up `form_id`. */
export function buildEtFollowupSubmit(followup: EtFormFollowup, text: string): EtFormSubmit | null {
  const question = text.trim();
  if (!question) return null;
  if (followup.max_chars && question.length > followup.max_chars) return null;
  return {
    display: question,
    meta: { action_type: ET_FORM_SUBMIT_ACTION_TYPE, form_id: followup.form_id },
  };
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
  // objective_set answers go through `buildEtObjectiveSubmit` (a JSON payload), never as one text.
  if (!text || form.control === 'radio' || form.control === 'objective_set') return null;
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

type PrefillMessage = {
  role: string;
  content: string;
  assistantMeta?: Record<string, unknown> | null;
};

/**
 * KAZI-1044: text to prefill the revision editor with — **the essay that was
 * graded**, ⛔ not simply the latest user message.
 *
 * The backend offers the revision form on *every* ET turn while the essay sits
 * graded (`writing_phase = review`, SSOT v1.76 §5.3.6.2), e.g. after a
 * follow-up question "what does point 2 mean?". So walk back from this turn
 * through assistant turns that carry the revision form, stop at the first one
 * carrying `grade_id` (the graded turn — history rows keep it too, backend
 * `PERSISTED_SURFACE_META_KEYS`), and take the user message just before it.
 * No graded turn in that run ⇒ no prefill (⛔ no guessing: guessing the
 * earliest turn picked the first draft after a revision + reload).
 *
 * Local only: the backend form never carries user data (SSOT §5.3.6).
 * Only the latest turn gets a value (frozen forms can't be opened anyway).
 */
export function revisionPrefill(
  messages: ReadonlyArray<PrefillMessage>,
  messageIndex: number
): string | undefined {
  if (!isLatestTurn(messages, messageIndex)) return undefined;
  let graded = -1;
  for (let i = messageIndex; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== 'assistant') continue;
    const meta = message.assistantMeta ?? undefined;
    if (meta?.grade_id) {
      graded = i;
      break;
    }
    if (parseEtForm(meta)?.kind !== 'writing_revision') break;
  }
  if (graded < 0) return undefined;
  for (let i = graded - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') return messages[i].content.trim() || undefined;
  }
  return undefined;
}
