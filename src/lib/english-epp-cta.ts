import type { EnglishCtaHint, EnglishCtaType } from '@/types';

const ENGLISH_CTA_TYPES: EnglishCtaType[] = [
  'start_training',
  'retake_assessment',
  'view_history',
  'view_sample_jobs',
];

export function isEnglishCtaType(value: string): value is EnglishCtaType {
  return ENGLISH_CTA_TYPES.includes(value as EnglishCtaType);
}

function upsertEnglishCtaHint(out: EnglishCtaHint[], hint: EnglishCtaHint): void {
  const idx = out.findIndex((h) => h.cta_type === hint.cta_type);
  if (idx < 0) {
    out.push(hint);
    return;
  }
  const existing = out[idx];
  out[idx] = {
    ...existing,
    ...hint,
    primary: Boolean(hint.primary || existing.primary),
    label: hint.label?.trim() ? hint.label : existing.label,
    scenario_id: hint.scenario_id ?? existing.scenario_id,
  };
}

export function normalizeEnglishCtaHints(
  hints: EnglishCtaHint[] | undefined | null
): EnglishCtaHint[] {
  if (!hints?.length) return [];
  const out: EnglishCtaHint[] = [];
  for (const hint of hints) {
    if (!isEnglishCtaType(hint.cta_type)) continue;
    upsertEnglishCtaHint(out, hint);
  }
  return out;
}
