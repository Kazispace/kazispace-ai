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
  const withJobId = (base: string) =>
    jobId ? `${base}&job_id=${encodeURIComponent(jobId)}` : base;

  switch (cta) {
    case 'complete_profile':
      return `/${locale}/chat`;
    case 'edit_cv':
      return withJobId(`/${locale}/chat?context_module=job_search`);
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
