export type JobPrimaryCta =
  | 'complete_profile'
  | 'edit_cv'
  | 'start_interview'
  | 'unlock_pro';

export function isJobPrimaryCta(value: string | undefined): value is JobPrimaryCta {
  return (
    value === 'complete_profile' ||
    value === 'edit_cv' ||
    value === 'start_interview' ||
    value === 'unlock_pro'
  );
}

/** Returns route href, or null when the CTA should open paywall / has no navigation. */
export function getJobCtaHref(
  locale: string,
  cta: string,
  jobId?: string
): string | null {
  switch (cta) {
    case 'complete_profile':
      return `/${locale}/chat`;
    case 'edit_cv':
      return jobId
        ? `/${locale}/cv?job_id=${encodeURIComponent(jobId)}`
        : `/${locale}/cv`;
    case 'start_interview':
      return jobId
        ? `/${locale}/interview?job_id=${encodeURIComponent(jobId)}`
        : `/${locale}/interview`;
    case 'unlock_pro':
      return null;
    default:
      return null;
  }
}

export function shouldShowProfileFallbackCta(
  items: Array<{ primary_cta?: string }>
): boolean {
  return (
    items.length > 0 &&
    items.length <= 3 &&
    items.every((item) => item.primary_cta === 'complete_profile')
  );
}
