import { deactivateAgent, getActiveAgent } from '@/lib/agent-api';
import { publishActiveAgentSync } from '@/lib/active-agent-sync';
import { useAgentStore } from '@/lib/store';

export type DeactivateToClinicResult =
  | { ok: true; agentId: string | null; returnMessage?: string }
  | { ok: false; error?: string };

/**
 * Explicit v1.3 exit — POST deactivate, clear local pointer, notify other tabs.
 */
export async function deactivateToClinic(
  locale: string,
  options?: { agentId?: string; skipBroadcast?: boolean }
): Promise<DeactivateToClinicResult> {
  let agentId =
    options?.agentId ?? useAgentStore.getState().activeAgentId ?? null;

  if (!agentId) {
    const activeRes = await getActiveAgent();
    agentId = activeRes.data?.active_agent ?? null;
  }

  if (!agentId) {
    useAgentStore.getState().setActiveAgent(null, null);
    return { ok: true, agentId: null };
  }

  const res = await deactivateAgent(agentId, locale);
  if (!res.success || !res.data) {
    const activeRes = await getActiveAgent();
    const serverAgent = activeRes.data?.active_agent ?? null;
    if (!serverAgent || serverAgent !== agentId) {
      useAgentStore.getState().setActiveAgent(null, null);
      if (!options?.skipBroadcast) {
        publishActiveAgentSync({ type: 'deactivated', agentId });
      }
      // Return the agent we attempted to exit — callers use this for messaging.
      return { ok: true, agentId };
    }
    return { ok: false, error: res.error };
  }

  useAgentStore.getState().setActiveAgent(null, null);

  if (!options?.skipBroadcast) {
    publishActiveAgentSync({ type: 'deactivated', agentId });
  }

  return {
    ok: true,
    agentId,
    returnMessage: res.data.return_message,
  };
}
