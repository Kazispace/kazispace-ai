import type { NextBestActionItem, User } from '@/types';

/**
 * Country + locale set — matches backend `clinic_ready` (CV Builder gate per BE #55).
 * Distinct from `profile_completion.minimum_complete` (6-field NBA hook).
 */
export function hasClinicBasics(user: User | null | undefined): boolean {
  return Boolean(user?.country && user?.primaryLocale);
}

/** @deprecated Use hasClinicBasics */
export const isClinicReady = hasClinicBasics;

/**
 * Whether the user can enter CV Builder after saving profile from a gate flow.
 * Aligns with backend clinic_ready, not minimum_complete.
 */
export function canEnterCvBuilder(user: User | null | undefined): boolean {
  if (!hasClinicBasics(user)) return false;

  const missing = user?.profileCompletion?.missingMinimum;
  if (!missing?.length) return true;

  // Trust BE: if country/locale still flagged missing, do not route to CV.
  return (
    !missing.includes('primary_country') && !missing.includes('primary_locale')
  );
}

/**
 * When backend still returns `complete_profile` for r1 users but clinic_ready
 * is satisfied, show edit_cv on Mine so users are not stuck in a profile loop (KAZI-72).
 *
 * Only overrides when clinic basics are met per BE; does not require minimum_complete
 * because NBA hook and CV gate use different thresholds (paired with BE #55).
 */
export function shouldOverrideCompleteProfileNba(
  user: User | null | undefined
): boolean {
  return canEnterCvBuilder(user);
}

export function resolveMineNbaAction(
  action: NextBestActionItem,
  user: User | null | undefined
): NextBestActionItem {
  if (
    action.action_type !== 'complete_profile' ||
    !shouldOverrideCompleteProfileNba(user)
  ) {
    return action;
  }
  // redirect_url is locale-agnostic; NbaActionCard uses resolveNbaHref().
  return {
    action_type: 'edit_cv',
    title: action.title,
    description: action.description,
    redirect_url: '/cv/documents',
  };
}
