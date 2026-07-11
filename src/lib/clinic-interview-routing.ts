import type { ChatNextAction } from '@/types/chat-envelope';

/** BE referral CTA types that should open the Mock Interview dedicated hub. */
export const CLINIC_INTERVIEW_HUB_ACTION_TYPES = [
  'mock_interview',
  'open_interview',
] as const;

export type ClinicInterviewHubActionType =
  (typeof CLINIC_INTERVIEW_HUB_ACTION_TYPES)[number];

/** User utterances that start mock interview from Clinic L2 (mirrors BE markers). */
const MOCK_INTERVIEW_START_RE =
  /模拟面试|mock interview|practice interview|面试练习|练习面试|帮我.*面试|我想.*面试|potrenir|собесед|потренировать/i;

export function isMockInterviewStartUtterance(text: string): boolean {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return false;
  return MOCK_INTERVIEW_START_RE.test(trimmed);
}

export function hasInterviewHubNextAction(
  nextActions: ChatNextAction[] | undefined
): boolean {
  if (!nextActions?.length) return false;
  return nextActions.some((action) =>
    (CLINIC_INTERVIEW_HUB_ACTION_TYPES as readonly string[]).includes(
      action.type
    )
  );
}

/**
 * Whether a Clinic assistant turn should navigate to `/interview`.
 * - KAZI-138 referral: next_actions mock_interview / open_interview
 * - Interim (pre-KAZI-138): intent mock_interview on a start utterance (not Q&A continuation)
 */
export function shouldClinicReplyRouteToInterviewHub(input: {
  intent?: string;
  nextActions?: ChatNextAction[];
  userText?: string;
}): boolean {
  if (hasInterviewHubNextAction(input.nextActions)) return true;
  if (
    input.intent === 'mock_interview' &&
    input.userText &&
    isMockInterviewStartUtterance(input.userText)
  ) {
    return true;
  }
  return false;
}
