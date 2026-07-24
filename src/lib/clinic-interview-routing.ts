import type { ChatNextAction } from '@/types/chat-envelope';

/** BE CTA types that may deep-link to the Mock Interview hub (optional). */
export const CLINIC_INTERVIEW_HUB_ACTION_TYPES = ['open_interview'] as const;

export type ClinicInterviewHubActionType =
  (typeof CLINIC_INTERVIEW_HUB_ACTION_TYPES)[number];

const INTERVIEW_HUB_ACTION_TYPE_SET = new Set<string>(
  CLINIC_INTERVIEW_HUB_ACTION_TYPES
);

function hasExplicitInterviewPath(
  nextActions: ChatNextAction[] | undefined
): boolean {
  if (!nextActions?.length) return false;
  return nextActions.some((action) => {
    const path = action.path?.trim();
    return Boolean(path && /\/interview(?:\/|$|\?)/i.test(path));
  });
}

export function hasInterviewHubNextAction(
  nextActions: ChatNextAction[] | undefined
): boolean {
  if (!nextActions?.length) return false;
  if (hasExplicitInterviewPath(nextActions)) return true;
  return nextActions.some((action) =>
    INTERVIEW_HUB_ACTION_TYPE_SET.has(action.type)
  );
}

/**
 * Whether a Clinic assistant turn should navigate to `/interview`.
 * KAZI-321: only `open_interview` or an explicit interview `path` may deep-link.
 */
export function shouldClinicReplyRouteToInterviewHub(
  nextActions?: ChatNextAction[]
): boolean {
  return hasInterviewHubNextAction(nextActions);
}
