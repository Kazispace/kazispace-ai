/**
 * KAZI-160 Hub Entry Contract — code-as-contract for chat-first Hub cold-opens.
 *
 * Invariants (every dedicated Hub agent):
 * 1. Cold open → L4 `openHubAgentSession` + session history hydrate
 * 2. ≥1 assistant guidance message (welcome, greeting, or history)
 * 3. Composer visible; disabled only while loading / send in flight / open error
 * 4. Info dashboards live on secondary routes only — never block primary chat flow
 */
import { planNavigation } from '@/lib/agent-transition/navigation';
import { getAgentHubPath, isDedicatedHubAgent } from '@/lib/agent-transition/surfaces';
import { CV_BUILDER_AGENT_ID } from '@/lib/cv-agent-config';
import { ENGLISH_TUTOR_AGENT_ID } from '@/lib/english-tutor-config';
import { MOCK_INTERVIEW_AGENT_ID } from '@/lib/mock-interview-config';

export const HUB_CHAT_FIRST_AGENT_IDS = [
  CV_BUILDER_AGENT_ID,
  MOCK_INTERVIEW_AGENT_ID,
  ENGLISH_TUTOR_AGENT_ID,
] as const;

export type HubChatFirstAgentId = (typeof HUB_CHAT_FIRST_AGENT_IDS)[number];

/** Secondary info routes — must not be Clinic handoff targets. */
export const HUB_SECONDARY_ROUTE_SUFFIXES = [
  '/passport',
  '/onboarding',
  '/profile',
  '/assessment',
  '/training',
  '/growth',
] as const;

export interface HubEntryContract {
  opensSession: true;
  requiresGuidanceMessage: true;
  requiresComposer: true;
  infoPagesSecondary: true;
}

export const HUB_ENTRY_CONTRACT: HubEntryContract = {
  opensSession: true,
  requiresGuidanceMessage: true,
  requiresComposer: true,
  infoPagesSecondary: true,
};

/** Clinic → Hub navigation plan for a target agent. */
export function planClinicHandoff(locale: string, agentId: string) {
  return planNavigation(locale, 'clinic', agentId);
}

/**
 * Returns the chat-first Hub root href when Clinic handoff should land in composer state.
 * In-clinic agents (e.g. job_search) return null.
 */
export function assertChatFirstClinicHandoff(
  locale: string,
  agentId: string
): { href: string; isChatFirstRoot: true } | null {
  if (!isDedicatedHubAgent(agentId)) return null;

  const plan = planClinicHandoff(locale, agentId);
  if (!plan.shouldNavigate || !plan.href) return null;

  const isSecondary = HUB_SECONDARY_ROUTE_SUFFIXES.some((suffix) =>
    plan.href!.endsWith(suffix)
  );
  if (isSecondary) return null;

  const hubPath = getAgentHubPath(locale, agentId);
  if (plan.href !== hubPath) return null;

  return { href: plan.href, isChatFirstRoot: true };
}
