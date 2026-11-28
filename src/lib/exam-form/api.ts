/** KAZI-1493: the reads Form mode needs, on existing endpoints only (no form endpoint, D42). */
import { apiRequest } from '@/lib/api-client';
import { normalizeSpaceSummary } from '@/lib/spaces-api';
import type { SpaceSummary } from '@/types/spaces';

import { FORM_TEMPLATE_ID, parseFormResult, parseServedProblemTypes, type FormResult, type ServedProblemTypes } from './model';

/** What the Form home page reads from `GET /api/v1/me`. */
export interface ExamCatalog {
  /** `english_exams` (D44): the user's own ordered exam list, already limited to exams the server can serve. */
  exams: string[];
  /** `english_exam_problem_types` (KAZI-1510); `null` when missing (an older server): use the fallback table. */
  types: ServedProblemTypes | null;
}

/**
 * `GET /api/v1/me` → the exam list and each exam's problem types. `null` when `english_exams` is missing (an
 * older server) or the read failed; the page then shows its "no exam list" state.
 */
export async function getExamCatalog(): Promise<ExamCatalog | null> {
  const res = await apiRequest<Record<string, unknown>>('/api/v1/me');
  if (!res.success || !res.data) return null;
  const raw = res.data.english_exams;
  if (!Array.isArray(raw)) return null;
  return {
    exams: raw.filter((e): e is string => typeof e === 'string' && e.length > 0),
    types: parseServedProblemTypes(res.data.english_exam_problem_types),
  };
}

/** A Form mode set as listed: its summary and its result (`form_result`; `null` = not marked, or an older server). */
export interface FormSetSummary extends SpaceSummary {
  form_result: FormResult | null;
}

/** Past and current sets: `GET /api/v1/spaces?include_form=true`, `exam_form` only, newest first. */
export async function listFormSets(): Promise<FormSetSummary[] | null> {
  const res = await apiRequest<{ spaces?: Record<string, unknown>[] }>('/api/v1/spaces?include_form=true');
  if (!res.success || !res.data) return null;
  return (res.data.spaces ?? [])
    .map((raw) => ({ ...normalizeSpaceSummary(raw), form_result: parseFormResult(raw.form_result) }))
    .filter((s) => s.template_id === FORM_TEMPLATE_ID && s.status !== 'deleted')
    .sort((a, b) => (b.last_active_at ?? '').localeCompare(a.last_active_at ?? ''));
}
