/**
 * KAZI-1145 · cv_builder input form contract `meta.form`
 * (design: `kazi-cv-form-contract-v1.0.md` §2–§4; backend: KAZI-1144,
 * `agents/cv_builder/form_schema.py`).
 *
 * Same key, same submit channel and same freeze rule as the english_tutor
 * forms (`@/lib/english-tutor/form`, KAZI-1041):
 * - a CV form is recognised by `form_id` starting with `cv:`;
 * - answers go through the normal chat send path with
 *   `meta = {action_type: 'cv_form_submit', form_id, action_payload?}` —
 *   except `cv_upload`, which posts the file to `/api/v1/inputs` (that
 *   endpoint already returns the next CV reply);
 * - only the latest message's form is interactive. ⛔ Never freeze by
 *   `form_id`: the backend re-sends the same id on every collecting turn.
 *
 * Anything off-contract parses to `null` ⇒ render nothing; the reply text
 * still reads fine and the user can type.
 */
import type { UserMessageActionMeta } from '@/types/chat-envelope';

export const CV_FORM_SUBMIT_ACTION_TYPE = 'cv_form_submit';
export const CV_FORM_ID_PREFIX = 'cv:';

export type CvFormKind =
  | 'cv_start'
  | 'cv_upload'
  | 'cv_paste'
  | 'cv_wizard'
  | 'cv_pick'
  | 'cv_archive';

export type CvFormControl = 'radio' | 'upload' | 'textarea' | 'wizard' | 'checkbox';
export type CvFormPresentation = 'inline' | 'modal';

export interface CvFormOption {
  id: string;
  label: string;
}

export interface CvWizardField {
  field_id: string;
  label: string;
  type: 'input' | 'textarea';
  required: boolean;
  placeholder?: string;
}

export interface CvWizardStep {
  step_id: string;
  title: string;
  repeatable: boolean;
  fields: CvWizardField[];
}

export interface CvForm {
  form_id: string;
  kind: CvFormKind;
  presentation: CvFormPresentation;
  control: CvFormControl;
  title: string;
  prompt: string | null;
  options: CvFormOption[];
  submit_label: string;
  /** `cv_upload` only: allowed file extensions, lower-case with the dot. */
  accept?: string[];
  /** Hints only — the backend decides (design §2.3 rule 5). */
  constraints?: { max_bytes?: number; max_chars?: number };
  /** `cv_wizard` only, in order (the order *is* the navigation). */
  steps?: CvWizardStep[];
  /** `cv_wizard` edit mode: prefill from `GET /api/v1/cv/documents/{id}`. */
  document_id?: number;
}

/** kind → the (presentation, control) pairs the contract allows. */
const SHAPES: Record<CvFormKind, { presentations: CvFormPresentation[]; control: CvFormControl }> = {
  cv_start: { presentations: ['inline'], control: 'radio' },
  cv_upload: { presentations: ['inline'], control: 'upload' },
  cv_paste: { presentations: ['inline'], control: 'textarea' },
  cv_wizard: { presentations: ['modal'], control: 'wizard' },
  cv_pick: { presentations: ['inline'], control: 'radio' },
  // ≤ 8 resumes inline, more in a dialog (backend `ARCHIVE_INLINE_MAX`).
  cv_archive: { presentations: ['inline', 'modal'], control: 'checkbox' },
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

/** `cv:<kind>[:<ref>]` → `kind` (or undefined for anything else, incl. ET's `et:`). */
export function cvKindOfFormId(formId: string | undefined): string | undefined {
  if (!formId || !formId.startsWith(CV_FORM_ID_PREFIX)) return undefined;
  return formId.slice(CV_FORM_ID_PREFIX.length).split(':', 1)[0] || undefined;
}

function parseSteps(value: unknown): CvWizardStep[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const steps: CvWizardStep[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const row = asRecord(entry);
    const stepId = readString(row?.step_id);
    if (!row || !stepId || seen.has(stepId) || typeof row.repeatable !== 'boolean') return undefined;
    seen.add(stepId);
    if (!Array.isArray(row.fields) || row.fields.length === 0) return undefined;
    const fields: CvWizardField[] = [];
    const fieldIds = new Set<string>();
    for (const rawField of row.fields) {
      const field = asRecord(rawField);
      const fieldId = readString(field?.field_id);
      const label = readString(field?.label);
      const type = field?.type;
      if (!field || !fieldId || !label || fieldIds.has(fieldId)) return undefined;
      if (type !== 'input' && type !== 'textarea') return undefined;
      fieldIds.add(fieldId);
      const placeholder = readString(field.placeholder);
      fields.push({
        field_id: fieldId,
        label,
        type,
        required: field.required === true,
        ...(placeholder ? { placeholder } : {}),
      });
    }
    steps.push({ step_id: stepId, title: readString(row.title) ?? stepId, repeatable: row.repeatable, fields });
  }
  return steps;
}

/**
 * Parse `meta.form` as a CV form. Anything off-contract ⇒ `null` (never a
 * half-built form): unknown kind, `form_id` not `cv:<kind>…`, a
 * presentation / control the kind does not allow, a choice form without
 * options, a wizard without valid steps, an upload without `accept`.
 */
export function parseCvForm(meta?: Record<string, unknown> | null): CvForm | null {
  const raw = asRecord(meta?.form);
  if (!raw) return null;

  const formId = readString(raw.form_id);
  const kind = readString(raw.kind) as CvFormKind | undefined;
  if (!formId || !kind || !Object.prototype.hasOwnProperty.call(SHAPES, kind)) return null;
  if (cvKindOfFormId(formId) !== kind) return null;

  const shape = SHAPES[kind];
  const presentation = raw.presentation as CvFormPresentation;
  if (!shape.presentations.includes(presentation) || raw.control !== shape.control) return null;

  const options: CvFormOption[] = [];
  if (Array.isArray(raw.options)) {
    for (const item of raw.options) {
      const row = asRecord(item);
      const id = readString(row?.id);
      const label = readString(row?.label);
      if (id && label) options.push({ id, label });
    }
  }
  if ((shape.control === 'radio' || shape.control === 'checkbox') && options.length === 0) return null;

  const form: CvForm = {
    form_id: formId,
    kind,
    presentation,
    control: shape.control,
    title: readString(raw.title) ?? '',
    prompt: readString(raw.prompt) ?? null,
    options,
    submit_label: readString(raw.submit_label) ?? '',
  };

  const constraints = asRecord(raw.constraints);
  if (shape.control === 'upload') {
    const accept = Array.isArray(raw.accept)
      ? raw.accept
          .filter((a): a is string => typeof a === 'string' && a.trim() !== '')
          .map((a) => {
            const ext = a.trim().toLowerCase();
            return ext.startsWith('.') ? ext : `.${ext}`;
          })
      : [];
    if (accept.length === 0) return null;
    form.accept = accept;
    const maxBytes = readPositive(constraints?.max_bytes);
    if (maxBytes) form.constraints = { max_bytes: maxBytes };
  }
  if (shape.control === 'textarea') {
    const maxChars = readPositive(constraints?.max_chars);
    if (maxChars) form.constraints = { max_chars: maxChars };
  }
  if (shape.control === 'wizard') {
    const steps = parseSteps(raw.steps);
    if (!steps) return null;
    form.steps = steps;
    if (raw.document_id !== undefined && raw.document_id !== null) {
      const docId = raw.document_id;
      if (typeof docId !== 'number' || !Number.isInteger(docId) || docId < 1) return null;
      form.document_id = docId;
    }
  }
  return form;
}

export interface CvFormSubmit {
  /** Text the user bubble shows; also the chat `content`. */
  display: string;
  meta: UserMessageActionMeta;
}

function baseMeta(form: CvForm): UserMessageActionMeta {
  return { action_type: CV_FORM_SUBMIT_ACTION_TYPE, form_id: form.form_id };
}

/** radio (`cv_start`, `cv_pick`): `content` = option label, `action_payload` = option id. */
export function buildCvChoiceSubmit(form: CvForm, optionId: string): CvFormSubmit | null {
  if (form.control !== 'radio') return null;
  const option = form.options.find((o) => o.id === optionId);
  if (!option) return null;
  return { display: option.label, meta: { ...baseMeta(form), action_payload: option.id } };
}

/**
 * checkbox (`cv_archive`): `action_payload` = JSON `{"archive": [document ids]}`
 * (numbers). At least one; ids not on the form are dropped, and a form whose
 * option ids aren't document ids submits nothing.
 */
export function buildCvArchiveSubmit(
  form: CvForm,
  selectedIds: ReadonlyArray<string>,
  display: string
): CvFormSubmit | null {
  if (form.control !== 'checkbox') return null;
  const ids: number[] = [];
  for (const option of form.options) {
    if (!selectedIds.includes(option.id)) continue;
    const n = Number(option.id);
    if (!Number.isInteger(n) || n < 1) return null;
    ids.push(n);
  }
  if (ids.length === 0) return null;
  return {
    display,
    meta: { ...baseMeta(form), action_payload: JSON.stringify({ archive: ids }) },
  };
}

/** textarea (`cv_paste`): `content` = the pasted text, no payload. */
export function buildCvPasteSubmit(form: CvForm, text: string): CvFormSubmit | null {
  if (form.control !== 'textarea') return null;
  const body = text.trim();
  if (!body) return null;
  const max = form.constraints?.max_chars;
  if (max && body.length > max) return null;
  return { display: body, meta: baseMeta(form) };
}

// ---------------------------------------------------------------------------
// Wizard
// ---------------------------------------------------------------------------

export type CvWizardItem = Record<string, string>;

/**
 * In-progress wizard input. Lives outside the dialog (see `cv-wizard-drafts`)
 * so closing and reopening keeps both the step and what was typed.
 *
 * Edit mode stores a draft only once the user has edited a field (`dirty`),
 * and keeps the `version` of the `GET /cv/documents/{id}` it was prefilled
 * from: every open refetches, and a different version drops the draft so a
 * save never reverts newer content.
 */
export interface CvWizardDraft {
  step: number;
  /** Non-repeatable steps: step_id → field_id → value. */
  values: Record<string, CvWizardItem>;
  /** Repeatable steps: step_id → items. */
  items: Record<string, CvWizardItem[]>;
  /**
   * Edit mode: the resume the wizard was prefilled from. Fields the wizard
   * does not show (e.g. `achievements`) are carried back unchanged, so saving
   * never silently drops them.
   */
  base?: Record<string, unknown>;
  /** True once the user changed a field (navigation alone does not count). */
  dirty?: boolean;
  /** Edit mode: the document `version` the prefill came from. */
  version?: number | string | null;
}

export function emptyCvWizardDraft(): CvWizardDraft {
  return { step: 0, values: {}, items: {} };
}

/** True once the user (or the prefill) has put anything in the draft. */
export function cvWizardDraftHasData(draft: CvWizardDraft | undefined): boolean {
  if (!draft) return false;
  const filled = (item: CvWizardItem) => Object.values(item).some((v) => v.trim() !== '');
  return (
    Object.values(draft.values).some(filled) ||
    Object.values(draft.items).some((list) => list.length > 0)
  );
}

export interface CvWizardMissing {
  /** Index in a repeatable step; absent for a non-repeatable step. */
  item?: number;
  field_id: string;
}

function isBlankItem(item: CvWizardItem): boolean {
  return Object.values(item).every((v) => v.trim() === '');
}

/**
 * Required fields for one step. Non-repeatable: the required fields must be
 * filled. Repeatable: zero items is fine (a new resume often has no work
 * experience), but every item that exists needs its required fields (a
 * wholly blank item does not count — it is dropped on submit).
 */
export function validateCvWizardStep(step: CvWizardStep, draft: CvWizardDraft): CvWizardMissing[] {
  const required = step.fields.filter((f) => f.required);
  const missing: CvWizardMissing[] = [];
  if (step.repeatable) {
    (draft.items[step.step_id] ?? []).forEach((item, index) => {
      // A wholly blank item is dropped on submit (`buildCvResume`), so it
      // doesn't count as an item — "Add another" then "Next" isn't blocked.
      if (isBlankItem(item)) return;
      for (const field of required) {
        if (!(item[field.field_id] ?? '').trim()) missing.push({ item: index, field_id: field.field_id });
      }
    });
    return missing;
  }
  const values = draft.values[step.step_id] ?? {};
  for (const field of required) {
    if (!(values[field.field_id] ?? '').trim()) missing.push({ field_id: field.field_id });
  }
  return missing;
}

/** Index of the first step that does not validate, or -1. */
export function firstInvalidCvWizardStep(steps: ReadonlyArray<CvWizardStep>, draft: CvWizardDraft): number {
  return steps.findIndex((step) => validateCvWizardStep(step, draft).length > 0);
}

/** `skills`: comma (incl. full-width) or newline separated, trimmed, non-empty. */
export function splitCvSkills(text: string): string[] {
  return text
    .split(/[,，、\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** A typed list bullet at the start of a line: "- ", "* " or "•". */
const LEADING_BULLET = /^(?:[-*](?:\s+|$)|•\s*)/;

/** `highlights`: one per line, typed bullets ("- ", "• ", "* ") stripped. */
export function splitCvLines(text: string): string[] {
  return text
    .split('\n')
    .map((s) => s.trim().replace(LEADING_BULLET, '').trim())
    .filter(Boolean);
}

/** Field ids whose value is a list in `ResumeDocument`, and how to split it. */
const LIST_FIELDS: Record<string, (text: string) => string[]> = {
  skills: splitCvSkills,
  highlights: splitCvLines,
};

/** The non-repeatable step whose fields nest under `resume.contact`. */
const CONTACT_STEP_ID = 'contact';

function itemToRecord(fields: ReadonlyArray<CvWizardField>, item: CvWizardItem): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    const value = (item[field.field_id] ?? '').trim();
    const split = LIST_FIELDS[field.field_id];
    if (split) {
      out[field.field_id] = value ? split(value) : [];
    } else if (value) {
      // Empty strings are omitted: the backend defaults them (`summary: str = ""`
      // rejects null, so null would be worse than absent).
      out[field.field_id] = value;
    }
  }
  return out;
}

/**
 * Build the `ResumeDocument`-shaped object the wizard submits (design §2.4.2).
 * Field ids *are* the `ResumeDocument` field names, so the mapping is
 * generic: the `contact` step nests under `contact`; other single steps
 * write top-level fields; a repeatable step is a top-level list named by its
 * `step_id`. `skills` / `highlights` become lists. Wholly blank repeatable
 * items are dropped.
 */
export function buildCvResume(
  steps: ReadonlyArray<CvWizardStep>,
  draft: CvWizardDraft
): Record<string, unknown> {
  const resume: Record<string, unknown> = {};
  if (Array.isArray(draft.base?.achievements)) resume.achievements = draft.base.achievements;
  for (const step of steps) {
    if (step.repeatable) {
      resume[step.step_id] = (draft.items[step.step_id] ?? [])
        .filter((item) => !isBlankItem(item))
        .map((item) => itemToRecord(step.fields, item));
      continue;
    }
    const record = itemToRecord(step.fields, draft.values[step.step_id] ?? {});
    if (step.step_id === CONTACT_STEP_ID) {
      resume.contact = record;
    } else {
      Object.assign(resume, record);
    }
  }
  if (!resume.contact) resume.contact = {};
  return resume;
}

/** wizard: `action_payload` = JSON `{"resume": R}`; `content` = a short summary line. */
export function buildCvWizardSubmit(form: CvForm, draft: CvWizardDraft, display: string): CvFormSubmit | null {
  if (form.control !== 'wizard' || !form.steps) return null;
  if (firstInvalidCvWizardStep(form.steps, draft) >= 0) return null;
  return {
    display,
    meta: {
      ...baseMeta(form),
      action_payload: JSON.stringify({ resume: buildCvResume(form.steps, draft) }),
    },
  };
}

function textOf(value: unknown, joiner: string): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string' && v.trim() !== '').join(joiner);
  }
  return '';
}

function recordFromResume(fields: ReadonlyArray<CvWizardField>, source: Record<string, unknown>): CvWizardItem {
  const out: CvWizardItem = {};
  for (const field of fields) {
    const text = textOf(source[field.field_id], field.field_id === 'skills' ? ', ' : '\n');
    if (text) out[field.field_id] = text;
  }
  return out;
}

/** Edit-mode prefill: the stored `resume` (or null ⇒ an empty draft). */
export function cvWizardDraftFromResume(
  steps: ReadonlyArray<CvWizardStep>,
  resume: Record<string, unknown> | null | undefined
): CvWizardDraft {
  const draft = emptyCvWizardDraft();
  if (!resume) return draft;
  draft.base = resume;
  for (const step of steps) {
    if (step.repeatable) {
      const list = Array.isArray(resume[step.step_id]) ? (resume[step.step_id] as unknown[]) : [];
      draft.items[step.step_id] = list
        .map((entry) => asRecord(entry))
        .filter((entry): entry is Record<string, unknown> => Boolean(entry))
        .map((entry) => recordFromResume(step.fields, entry));
      continue;
    }
    const source = step.step_id === CONTACT_STEP_ID ? asRecord(resume.contact) ?? {} : resume;
    draft.values[step.step_id] = recordFromResume(step.fields, source);
  }
  return draft;
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

/** Same ceiling as the backend's `cv_file_extract` and `CV_UPLOAD_MAX_BYTES`. */
export const CV_FORM_DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

export type CvUploadCheck = 'wrongType' | 'tooLarge' | null;

/** On-device check before upload (extension vs `accept`, size vs `max_bytes`). */
export function checkCvFormUpload(form: CvForm, file: Pick<File, 'name' | 'size'>): CvUploadCheck {
  const name = file.name.toLowerCase();
  const accept = form.accept ?? [];
  if (!accept.some((ext) => name.endsWith(ext))) return 'wrongType';
  const max = form.constraints?.max_bytes ?? CV_FORM_DEFAULT_MAX_BYTES;
  if (file.size > max) return 'tooLarge';
  return null;
}

// ---------------------------------------------------------------------------
// Wizard drafts — kept outside the dialog, keyed by `form_id`
// (`@/lib/cv-wizard-drafts`, a tiny module so logout can clear them without
// pulling this file into the auth store).
// ---------------------------------------------------------------------------

export {
  clearAllCvWizardDrafts,
  clearCvWizardDraft,
  readCvWizardDraft,
  writeCvWizardDraft,
} from '@/lib/cv-wizard-drafts';
