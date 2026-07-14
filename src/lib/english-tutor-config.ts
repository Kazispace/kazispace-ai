import type { ChatNextAction } from '@/types';

export const ENGLISH_TUTOR_AGENT_ID = 'english_tutor';

export function isEnglishTutorAgent(agentId: string | null | undefined): boolean {
  return agentId === ENGLISH_TUTOR_AGENT_ID;
}

/** Gateway §4.6 PAGE_REFERRAL — route to /english EPP, not Agent Hub chat. */
export function shouldRouteToEnglishEpp(payload: {
  intent?: string;
  nextActions?: ChatNextAction[];
  routedAgentId?: string | null;
}): boolean {
  if (isEnglishTutorAgent(payload.routedAgentId)) return true;
  if (payload.intent === ENGLISH_TUTOR_AGENT_ID) return true;
  return (payload.nextActions ?? []).some((a) => a.type === ENGLISH_TUTOR_AGENT_ID);
}
