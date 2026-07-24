import type { ChatNextAction } from '@/types/chat-envelope';
import { getCompleteProfileHref } from '@/lib/profile-routing';

import {
  resolveInSpaceChatPrompt,
  type InSpaceChatPromptType,
} from '@/lib/next-action/i18n-prompts';

const IN_SPACE_CHAT_PROMPT_TYPES = new Set<string>([
  'mock_interview',
  'cv_builder',
  'edit_cv',
  'english_tutor',
  'job_search',
]);

function isInSpaceChatPromptType(type: string): type is InSpaceChatPromptType {
  return IN_SPACE_CHAT_PROMPT_TYPES.has(type);
}

function normalizeAppPath(locale: string, rawPath: string): string | null {
  const path = rawPath.trim();
  if (!path || /^https?:\/\//i.test(path)) return null;
  if (path.startsWith(`/${locale}/`) || path === `/${locale}`) return path;
  if (path.startsWith('/')) return `/${locale}${path}`;
  return `/${locale}/${path.replace(/^\//, '')}`;
}

/**
 * Optional deep-link for Clinic/Space next_actions (KAZI-321).
 * `mock_interview` never maps to `/interview` by type alone; `open_interview` or explicit `path` may.
 */
export function resolveNextActionHref(
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
export function resolveNextActionChatPrompt(
  action: ChatNextAction,
  locale: string
): string | null {
  const payload = action.payload?.trim();
  if (payload) return payload;
  if (!isInSpaceChatPromptType(action.type)) return null;
  return resolveInSpaceChatPrompt(locale, action.type);
}
