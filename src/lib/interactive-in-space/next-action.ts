import type { ChatNextAction } from '@/types/chat-envelope';
import { getCompleteProfileHref } from '@/lib/profile-routing';

/** NL opener when user accepts a mock_interview referral in Clinic (KAZI-321). */
export const MOCK_INTERVIEW_REFERRAL_OPENING = '我想练习面试';

const IN_SPACE_CHAT_PROMPT_BY_TYPE: Record<string, string> = {
  mock_interview: MOCK_INTERVIEW_REFERRAL_OPENING,
  cv_builder: '帮我优化简历',
  edit_cv: '帮我优化简历',
  english_tutor: '我想练习英语',
  job_search: '帮我找工作',
};

function normalizeAppPath(locale: string, rawPath: string): string | null {
  const path = rawPath.trim();
  if (!path || /^https?:\/\//i.test(path)) return null;
  if (path.startsWith(`/${locale}/`) || path === `/${locale}`) return path;
  if (path.startsWith('/')) return `/${locale}${path}`;
  return `/${locale}/${path.replace(/^\//, '')}`;
}

/**
 * Optional deep-link for next_actions (KAZI-321).
 * `mock_interview` never maps to `/interview` by type alone; `open_interview` or explicit `path` may.
 */
export function resolveInteractiveNextActionHref(
  locale: string,
  action: ChatNextAction
): string | null {
  const explicit = action.path?.trim();
  if (explicit) {
    return normalizeAppPath(locale, explicit);
  }

  switch (action.type) {
    case 'open_interview':
      return `/${locale}/interview`;
    case 'open_list':
    case 'view_job_recommendations':
      return `/${locale}/jobs`;
    case 'complete_profile':
      return getCompleteProfileHref(locale);
    case 'upgrade_pro':
    case 'unlock_pro':
      return `/${locale}/subscription`;
    default:
      return null;
  }
}

/** User message to send in the current Clinic/Space thread (no Hub hop). */
export function resolveInteractiveNextActionChatPrompt(
  action: ChatNextAction
): string | null {
  const payload = action.payload?.trim();
  if (payload) return payload;
  return IN_SPACE_CHAT_PROMPT_BY_TYPE[action.type] ?? null;
}
