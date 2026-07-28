import { buildClinicCvRailOpenHref } from '@/lib/cv-entry';
import { getCompleteProfileHref } from '@/lib/profile-routing';
import type { ReadinessCheckSource } from '@/types';

export type JobPrimaryCta =
  | 'complete_profile'
  | 'edit_cv'
  | 'start_interview'
  | 'assess_readiness'
  | 'unlock_pro';

export function isJobPrimaryCta(value: string | undefined): value is JobPrimaryCta {
  return (
    value === 'complete_profile' ||
    value === 'edit_cv' ||
    value === 'start_interview' ||
    value === 'assess_readiness' ||
    value === 'unlock_pro'
  );
}

/** Returns route href, or null when the CTA should open paywall / has no navigation. */
export function getJobCtaHref(
  locale: string,
  cta: string,
  jobId?: string,
  options?: { readinessSource?: ReadinessCheckSource }
): string | null {
  switch (cta) {
    case 'complete_profile':
      return getCompleteProfileHref(locale);
    case 'edit_cv':
      return buildClinicCvRailOpenHref(locale, jobId);
    case 'start_interview':
      return jobId
        ? `/${locale}/interview?job_id=${encodeURIComponent(jobId)}`
        : `/${locale}/interview`;
    case 'assess_readiness': {
      if (!jobId) return `/${locale}/interview/readiness`;
      const params = new URLSearchParams({ job_id: jobId });
      const source = options?.readinessSource ?? 'job_search_detail';
      params.set('source', source);
      return `/${locale}/interview/readiness?${params.toString()}`;
    }
    case 'unlock_pro':
      return null;
    default:
      return null;
  }
}

/** Fallback list: backend returns ≤3 items, each with complete_profile (TR-V01-02). */
export function shouldShowProfileFallbackCta(
  items: Array<{ primary_cta?: string }>
): boolean {
  return (
    items.length > 0 &&
    items.length <= 3 &&
    items.every((item) => item.primary_cta === 'complete_profile')
  );
}

export function shouldRenderListPrimaryCta(
  primaryCta: string | undefined
): primaryCta is JobPrimaryCta {
  return isJobPrimaryCta(primaryCta) && primaryCta !== 'complete_profile';
}

/** Avoid duplicate unlock buttons when primary_cta already handles unlock_pro. */
export function shouldShowLegacyUnlockButton(item: {
  is_locked?: boolean;
  primary_cta?: string;
}): boolean {
  return Boolean(item.is_locked) && item.primary_cta !== 'unlock_pro';
}

export function shouldRenderDetailPrimaryCta(
  primaryCta: string | undefined,
  locked: boolean
): primaryCta is JobPrimaryCta {
  if (!isJobPrimaryCta(primaryCta) || primaryCta === 'complete_profile') {
    return false;
  }
  // Locked detail uses the pro banner for unlock_pro (API §10.2).
  if (locked && primaryCta === 'unlock_pro') {
    return false;
  }
  return true;
}
