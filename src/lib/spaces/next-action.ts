import type { ChatNextAction } from '@/types/chat-envelope';
import { getCompleteProfileHref } from '@/lib/profile-routing';

/**
 * Resolve a Space-chat next_actions CTA to an in-app href.
 * Prefer BE `path` when present; otherwise map known Clinic-compatible types.
 */
export function resolveSpaceNextActionHref(
  locale: string,
  action: ChatNextAction
): string | null {
  const rawPath = action.path?.trim();
  if (rawPath) {
    if (/^https?:\/\//i.test(rawPath)) return null;
    if (rawPath.startsWith(`/${locale}/`) || rawPath === `/${locale}`) {
      return rawPath;
    }
    if (rawPath.startsWith('/')) {
      return `/${locale}${rawPath}`;
    }
    return `/${locale}/${rawPath.replace(/^\//, '')}`;
  }

  switch (action.type) {
    case 'mock_interview':
    case 'open_interview':
      return `/${locale}/interview`;
    case 'open_list':
    case 'view_job_recommendations':
    case 'job_search':
      return `/${locale}/jobs`;
    case 'edit_cv':
    case 'cv_builder':
      return `/${locale}/cv`;
    case 'english_tutor':
      return `/${locale}/english`;
    case 'complete_profile':
      return getCompleteProfileHref(locale);
    case 'upgrade_pro':
    case 'unlock_pro':
      return `/${locale}/subscription`;
    default:
      return null;
  }
}
