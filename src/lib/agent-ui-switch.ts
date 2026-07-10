import { getActiveAgent } from '@/lib/agent-api';
import { isDedicatedHubAgent } from '@/lib/agent-layer';
import { useAgentStore } from '@/lib/store';

export type PendingAgentSwitch = {
  fromAgentId: string;
  toAgentId: string;
};

/** Server SSOT for who is active before an explicit UI switch (Path B). */
export async function resolveServerActiveAgentId(): Promise<string | null> {
  const res = await getActiveAgent();
  if (res.success && res.data?.active_agent) {
    return res.data.active_agent;
  }
  return useAgentStore.getState().activeAgentId;
}

export function needsExplicitSwitchConfirm(
  currentAgentId: string | null,
  targetAgentId: string
): boolean {
  return Boolean(currentAgentId && currentAgentId !== targetAgentId);
}

export function isHubAgentTarget(agentId: string): boolean {
  return isDedicatedHubAgent(agentId);
}
