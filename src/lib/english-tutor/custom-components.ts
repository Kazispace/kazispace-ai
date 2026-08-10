import type {
  EnglishTutorConfidence,
  EnglishTutorEnvelopeComponent,
  EssaySpanIssue,
  ExamPickerOption,
  ProgressSummaryItem,
  ScoreDimension,
} from '@/types/english-tutor-envelope';

const ENGLISH_TUTOR_COMPONENT_TYPES = new Set([
  'exam_picker',
  'essay_prompt',
  'essay_diff',
  'writing_scorecard',
  'speaking_radar',
  'model_answer',
  'progress_summary',
]);

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function parseExamOptions(raw: unknown): ExamPickerOption[] {
  if (!Array.isArray(raw)) return [];
  const options: ExamPickerOption[] = [];
  for (const item of raw) {
    const row = asRecord(item);
    if (!row) continue;
    const id = readString(row.id ?? row.exam_id ?? row.exam_type);
    const label = readString(row.label ?? row.name ?? row.title);
    if (!id || !label) continue;
    options.push({
      id,
      label,
      description: readString(row.description ?? row.subtitle),
    });
  }
  return options;
}

function parseSpanIssues(raw: unknown): EssaySpanIssue[] {
  if (!Array.isArray(raw)) return [];
  const issues: EssaySpanIssue[] = [];
  for (const item of raw) {
    const row = asRecord(item);
    if (!row) continue;
    const start = readNumber(row.start ?? row.span_start ?? row.offset_start);
    const end = readNumber(row.end ?? row.span_end ?? row.offset_end);
    const category = readString(row.category ?? row.type ?? row.code) ?? 'issue';
    const message = readString(row.message ?? row.comment ?? row.reason) ?? '';
    if (start == null || end == null || end <= start) continue;
    issues.push({
      start,
      end,
      category,
      message,
      rewrite_example: readString(row.rewrite_example ?? row.suggestion ?? row.fix),
    });
  }
  return issues;
}

function parseDimensions(raw: unknown): ScoreDimension[] {
  if (!Array.isArray(raw)) return [];
  const dimensions: ScoreDimension[] = [];
  for (const item of raw) {
    const row = asRecord(item);
    if (!row) continue;
    const key = readString(row.key ?? row.id ?? row.dimension);
    const score = readNumber(row.score ?? row.value);
    if (!key || score == null) continue;
    dimensions.push({
      key,
      label: readString(row.label ?? row.name),
      score,
      max: readNumber(row.max ?? row.max_score) ?? null,
    });
  }
  return dimensions;
}

function parseProgressItems(raw: unknown): ProgressSummaryItem[] {
  if (!Array.isArray(raw)) return [];
  const items: ProgressSummaryItem[] = [];
  for (const item of raw) {
    const row = asRecord(item);
    if (!row) continue;
    const label = readString(row.label ?? row.title);
    const value = readString(row.value ?? row.text);
    if (!label || !value) continue;
    items.push({ label, value });
  }
  return items;
}

function parseEnglishTutorComponent(raw: unknown): EnglishTutorEnvelopeComponent | null {
  const row = asRecord(raw);
  if (!row) return null;
  const type = readString(row.type);
  if (!type || !ENGLISH_TUTOR_COMPONENT_TYPES.has(type)) return null;

  switch (type) {
    case 'exam_picker': {
      const options = parseExamOptions(row.options ?? row.exams ?? row.choices);
      if (options.length === 0) return null;
      return {
        type,
        options,
        selected_id: readString(row.selected_id ?? row.selected ?? row.value) ?? null,
      };
    }
    case 'essay_prompt': {
      const promptId = readString(row.prompt_id ?? row.id);
      const title = readString(row.title ?? row.topic);
      const body = readString(row.body ?? row.prompt ?? row.text);
      if (!promptId || !title || !body) return null;
      const provenance = readString(row.provenance);
      return {
        type,
        prompt_id: promptId,
        title,
        body,
        word_limit: readNumber(row.word_limit ?? row.max_words) ?? null,
        exam_type: readString(row.exam_type ?? row.exam) ?? null,
        ai_synthetic:
          row.ai_synthetic === true ||
          provenance === 'ai_synthetic' ||
          row.provenance === 'ai_synthetic',
        provenance: provenance ?? null,
      };
    }
    case 'essay_diff': {
      const original = readString(row.original ?? row.text ?? row.essay);
      if (!original) return null;
      return {
        type,
        original,
        rewrite: readString(row.rewrite ?? row.rewrite_example ?? row.revised) ?? null,
        issues: parseSpanIssues(row.issues ?? row.spans ?? row.annotations),
      };
    }
    case 'writing_scorecard': {
      const dimensions = parseDimensions(row.dimensions ?? row.scores);
      if (dimensions.length === 0 && readNumber(row.overall) == null) return null;
      return {
        type,
        overall: readNumber(row.overall ?? row.total_score) ?? null,
        dimensions,
        summary: readString(row.summary ?? row.feedback) ?? null,
        show_revise_cta: row.show_revise_cta === true,
      };
    }
    case 'speaking_radar': {
      const dimensions = parseDimensions(row.dimensions ?? row.scores);
      if (dimensions.length === 0) return null;
      return {
        type,
        dimensions,
        summary: readString(row.summary ?? row.feedback) ?? null,
      };
    }
    case 'model_answer': {
      const text = readString(row.text ?? row.answer ?? row.content);
      if (!text) return null;
      return {
        type,
        text,
        audio_url: readString(row.audio_url ?? row.tts_url) ?? null,
      };
    }
    case 'progress_summary': {
      const items = parseProgressItems(row.items ?? row.summary);
      if (items.length === 0) return null;
      return { type, items };
    }
    default:
      return null;
  }
}

/** Parse english_tutor custom_components; skips citation_list and unknown types. */
export function parseEnglishTutorCustomComponents(
  customComponents: unknown
): EnglishTutorEnvelopeComponent[] {
  if (!Array.isArray(customComponents)) return [];
  const parsed: EnglishTutorEnvelopeComponent[] = [];
  for (const raw of customComponents) {
    const component = parseEnglishTutorComponent(raw);
    if (component) parsed.push(component);
  }
  return parsed;
}

export function isLowConfidenceMeta(
  meta?: Record<string, unknown> | null
): boolean {
  if (!meta) return false;
  const confidence = readString(meta.confidence);
  return confidence === 'low';
}

export function normalizeConfidence(
  meta?: Record<string, unknown> | null
): EnglishTutorConfidence | undefined {
  const raw = readString(meta?.confidence);
  if (raw === 'low' || raw === 'medium' || raw === 'high') return raw;
  return undefined;
}

/** next_action types that should focus the composer without navigation (KAZI-502). */
export const ENGLISH_TUTOR_REVISE_ACTION_TYPES = new Set([
  'submit_essay_revision',
  'revise_essay',
  'submit_revision',
]);

export function isEnglishTutorReviseAction(type: string): boolean {
  return ENGLISH_TUTOR_REVISE_ACTION_TYPES.has(type);
}
