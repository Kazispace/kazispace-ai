const REDIRECT_TO_SEGMENT: Record<string, string> = {
  '/onboarding': 'profile',
  '/interview/sessions/new': 'interview',
  '/job-recommendations': 'jobs',
  '/cv/documents': 'cv',
  '/billing': 'subscription',
};

const ACTION_TO_SEGMENT: Record<string, string> = {
  complete_profile: 'profile',
  start_interview: 'interview',
  view_job_recommendations: 'jobs',
  start_job_focused_preparation: 'jobs',
  continue_highest_leverage_preparation: 'cv',
  return_via_new_job_opportunity: 'jobs',
  upgrade_to_unlock_more: 'subscription',
  use_pro_to_accelerate_results: 'cv',
  edit_cv: 'cv',
  pay_upgrade: 'subscription',
};

/** Map backend `redirect_url` / `action_type` to a locale-prefixed app route. */
export function resolveNbaHref(
  locale: string,
  redirectUrl: string,
  actionType: string
): string {
  const segment =
    REDIRECT_TO_SEGMENT[redirectUrl] ?? ACTION_TO_SEGMENT[actionType];
  if (segment) {
    return `/${locale}/${segment}`;
  }
  if (redirectUrl.startsWith('/')) {
    const trimmed = redirectUrl.replace(/^\//, '').split('/')[0];
    if (trimmed && !trimmed.includes('.')) {
      return `/${locale}/${trimmed}`;
    }
  }
  return `/${locale}/chat`;
}
