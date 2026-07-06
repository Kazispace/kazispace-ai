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

export function sortEnglishCtas(ctas: EnglishCtaHint[]): EnglishCtaHint[] {
  return [...ctas].sort((a, b) => {
    if (a.primary && !b.primary) return -1;
    if (!a.primary && b.primary) return 1;
    return 0;
  });
}

export function getEnglishCtaHref(
  cta: EnglishCtaHint,
  locale: string
): string | null {
  const base = `/${locale}/english`;
  switch (cta.cta_type) {
    case 'start_training':
      return `${base}/training?scenario=${encodeURIComponent(
        cta.scenario_id ?? 'workplace_oral_interview_intro_v1'
      )}`;
    case 'retake_assessment':
      return `${base}/assessment`;
    case 'view_history':
      return `${base}/growth`;
    case 'view_sample_jobs':
      return base;
    default:
      return null;
  }
}

export function normalizeEnglishCtaHints(
  hints: EnglishCtaHint[] | undefined | null
): EnglishCtaHint[] {
  if (!hints?.length) return [];
  return hints.filter((h) => isEnglishCtaType(h.cta_type));
}
