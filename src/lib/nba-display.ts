import type { NextBestActionItem } from '@/types';
import type { User } from '@/types';

/** Country + locale set — user can enter CV Builder (clinic_ready on backend). */
export function isClinicReady(user: User | null | undefined): boolean {
  return Boolean(user?.country && user?.primaryLocale);
}

/**
 * When backend still returns `complete_profile` for r1 users but clinic basics
 * are done, show edit_cv on Mine so users are not stuck in a profile loop (KAZI-72).
 */
export function resolveMineNbaAction(
  action: NextBestActionItem,
  user: User | null | undefined
): NextBestActionItem {
  if (action.action_type !== 'complete_profile' || !isClinicReady(user)) {
    return action;
  }
  return {
    action_type: 'edit_cv',
    title: action.title,
    description: action.description,
    redirect_url: '/cv/documents',
  };
}
