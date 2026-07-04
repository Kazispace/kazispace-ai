import type { InterviewCta, InterviewCtaType } from '@/types';

const CTA_TYPES: InterviewCtaType[] = [
  'weakness_drill',
  'retry_full',
  'edit_cv',
  'view_jobs',
  'back_to_clinic',
];

export function isInterviewCtaType(value: string): value is InterviewCtaType {
  return CTA_TYPES.includes(value as InterviewCtaType);
}

/** Returns route href, or null when the CTA is handled in-app (retry / drill). */
export function getInterviewCtaHref(
  locale: string,
  cta: InterviewCta,
  sessionJobId?: string | null
): string | null {
  const jobId = cta.job_id ?? sessionJobId ?? null;

  switch (cta.cta_type) {
    case 'edit_cv':
      return jobId
        ? `/${locale}/cv?job_id=${encodeURIComponent(jobId)}`
        : `/${locale}/cv`;
    case 'view_jobs':
      return `/${locale}/jobs`;
    case 'back_to_clinic':
      return `/${locale}/chat`;
    case 'weakness_drill':
    case 'retry_full':
      return null;
    default:
      return null;
  }
}

export function sortInterviewCtas(ctas: InterviewCta[]): InterviewCta[] {
  return [...ctas].sort((a, b) => Number(b.primary) - Number(a.primary));
}
