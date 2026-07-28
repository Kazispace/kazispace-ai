import { consumeSessionNavHandoff } from '@/lib/session-nav-handoff';
import { useAgentStore } from '@/lib/store';
import { publishActiveAgentSync } from '@/lib/active-agent-sync';

/** Resume a hub L4 session opened from session nav / workspace asset rail. */
export function takeHubSessionHandoff(agentId: string): string | null {
  const sessionId = consumeSessionNavHandoff(agentId);
  if (!sessionId) return null;

  useAgentStore.getState().setAgentSession(agentId, sessionId);
  publishActiveAgentSync({
    type: 'activated',
    agentId,
    sessionId,
  });
  return sessionId;
}
