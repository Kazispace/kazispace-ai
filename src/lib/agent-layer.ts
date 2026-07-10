import { CV_BUILDER_AGENT_ID } from '@/lib/cv-agent-config';
import { ENGLISH_TUTOR_AGENT_ID } from '@/lib/english-tutor-config';
import { MOCK_INTERVIEW_AGENT_ID } from '@/lib/mock-interview-config';
import type { ActiveAgentState } from '@/types';

/** Agents with a dedicated hub page (not rendered inside Clinic shell). */
const DEDICATED_HUB_AGENTS: Record<string, (locale: string) => string> = {
  [CV_BUILDER_AGENT_ID]: (locale) => `/${locale}/cv`,
  [MOCK_INTERVIEW_AGENT_ID]: (locale) => `/${locale}/interview`,
  [ENGLISH_TUTOR_AGENT_ID]: (locale) => `/${locale}/english`,
};

export function isDedicatedHubAgent(agentId: string): boolean {
  return agentId in DEDICATED_HUB_AGENTS;
}

export function getAgentHubPath(locale: string, agentId: string): string | null {
  const build = DEDICATED_HUB_AGENTS[agentId];
  return build ? build(locale) : null;
}

export function hasStickyActiveAgent(
  state: ActiveAgentState | null | undefined
): state is ActiveAgentState & { active_agent: string; session_id: string } {
  return Boolean(state?.active_agent && state?.session_id);
}
