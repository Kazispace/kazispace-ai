/** KAZI-1493: the reads Form mode needs, on existing endpoints only (no form endpoint, D42). */
import { apiRequest } from '@/lib/api-client';
import { normalizeSpaceSummary } from '@/lib/spaces-api';
import type { SpaceSummary } from '@/types/spaces';

import { FORM_TEMPLATE_ID } from './model';

/**
 * `GET /api/v1/me` → `english_exams` (D44): the user's own ordered exam list, already limited by the
 * server to exams it has questions for. `null` when the field is missing (an older server) or the read
 * failed; the page then shows its "no exam list" state.
 */
export async function getEnglishExams(): Promise<string[] | null> {
  const res = await apiRequest<Record<string, unknown>>('/api/v1/me');
  if (!res.success || !res.data) return null;
  const raw = res.data.english_exams;
  if (!Array.isArray(raw)) return null;
  return raw.filter((e): e is string => typeof e === 'string' && e.length > 0);
}

/** Past and current sets: `GET /api/v1/spaces?include_form=true`, `exam_form` only, newest first. */
export async function listFormSets(): Promise<SpaceSummary[] | null> {
  const res = await apiRequest<{ spaces?: Record<string, unknown>[] }>('/api/v1/spaces?include_form=true');
  if (!res.success || !res.data) return null;
  return (res.data.spaces ?? [])
    .map(normalizeSpaceSummary)
    .filter((s) => s.template_id === FORM_TEMPLATE_ID && s.status !== 'deleted')
    .sort((a, b) => (b.last_active_at ?? '').localeCompare(a.last_active_at ?? ''));
}
