import type { EnglishProfileStatus } from '@/types';

export type EnglishSecondaryRoute = 'onboarding' | 'passport';

/** Client-side redirect target for EPP secondary pages, or null to stay. */
export function englishProfileRedirectTarget(params: {
  page: EnglishSecondaryRoute;
  isProfileLoading: boolean;
  profileError?: string | null;
  profileStatus?: EnglishProfileStatus | null;
  hasProfile: boolean;
}): EnglishSecondaryRoute | null {
  if (params.isProfileLoading) return null;
  if (params.profileError && !params.hasProfile) return null;

  if (params.page === 'passport') {
    if (params.profileStatus === 'empty' || !params.hasProfile) return 'onboarding';
    return null;
  }

  if (
    params.hasProfile &&
    (params.profileStatus === 'ready' || params.profileStatus === 'active')
  ) {
    return 'passport';
  }

  return null;
}

export function englishWorkspaceShowsOnboarding(params: {
  isProfileLoading: boolean;
  profileStatus?: EnglishProfileStatus | null;
}): boolean {
  if (params.isProfileLoading) return false;
  return params.profileStatus === 'empty' || params.profileStatus == null;
}
