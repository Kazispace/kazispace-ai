import { getActiveAgent } from '@/lib/agent-api';
import { isDedicatedHubAgent } from '@/lib/agent-transition/surfaces';
import { isCvBuilderAgent } from '@/lib/cv-agent-config';
import { deactivateToClinic } from '@/lib/deactivate-to-clinic';
import { leaveDedicatedHubForClinic } from '@/lib/leave-dedicated-hub';
import { useAgentStore } from '@/lib/store';

/**
 * Studio's Get started tap (KAZI-1155, kazispace-ui Studio "Always the main
 * chat"): make sure the main chat is what opens, leaving a current specialist
 * the way "Back to Clinic" does.
 *
 * - Mock interview, English tutor (dedicated hubs) and the CV builder: Clinic
 *   already opens the main chat while they are current, so this is navigation
 *   only. Their server session stays open and can be resumed (navigation
 *   pattern, "Returning to the main chat"; ADR-005).
 * - Any other specialist would be resumed inline in Clinic, so it is left on
 *   the server first. Best effort: a failed exit still opens Chat.
 */
export async function leaveToMainChat(locale: string): Promise<void> {
  let agentId = useAgentStore.getState().activeAgentId ?? null;
  if (!agentId) {
    const active = await getActiveAgent();
    agentId = active.data?.active_agent ?? null;
  }
  if (!agentId || isDedicatedHubAgent(agentId) || isCvBuilderAgent(agentId)) {
    leaveDedicatedHubForClinic();
    return;
  }
  await deactivateToClinic(locale, { agentId, bestEffort: true });
}
