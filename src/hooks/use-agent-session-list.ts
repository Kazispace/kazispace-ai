'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchAgentSessions } from '@/lib/agent-api';
import { normalizeAgentSessions } from '@/lib/agent-sessions';
import type { AgentSessionSummary } from '@/types';

export function useAgentSessionList(agentId: string | null, enabled = true) {
  const [sessions, setSessions] = useState<AgentSessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled || !agentId) {
      setSessions([]);
      return;
    }
    setIsLoading(true);
    const res = await fetchAgentSessions(agentId);
    if (res.success && res.data) {
      setSessions(normalizeAgentSessions(res.data.sessions));
    }
    setIsLoading(false);
  }, [agentId, enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { sessions, isLoading, refresh };
}
