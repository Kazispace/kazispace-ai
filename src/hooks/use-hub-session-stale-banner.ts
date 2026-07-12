'use client';

import { useCallback, useState } from 'react';

import { useActiveAgentSync } from '@/hooks/use-active-agent-sync';
import { fetchCurrentAgentSessions } from '@/lib/agent-api';

/**
 * Detects when another tab changed the agent's Current session (ADR-005 Q4).
 */
export function useHubSessionStaleBanner(
  agentId: string,
  localSessionId: string | null,
  enabled: boolean,
  onRefresh: () => void | Promise<void>
) {
  const [stale, setStale] = useState(false);

  useActiveAgentSync(enabled && Boolean(localSessionId), async () => {
    if (!localSessionId) return;
    const res = await fetchCurrentAgentSessions();
    if (!res.success || !res.data?.sessions) return;
    const current = res.data.sessions.find((s) => s.agent_id === agentId);
    if (current?.session_id && current.session_id !== localSessionId) {
      setStale(true);
    }
  });

  const dismiss = useCallback(() => setStale(false), []);

  const refresh = useCallback(() => {
    setStale(false);
    void onRefresh();
  }, [onRefresh]);

  return { stale, dismiss, refresh };
}
