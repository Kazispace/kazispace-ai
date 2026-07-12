'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchAgentSessions } from '@/lib/agent-api';
import { normalizeAgentSessions } from '@/lib/agent-sessions';
import type { AgentSessionSummary } from '@/types';

const HISTORY_CACHE_MS = 30_000;
const historyCache = new Map<
  string,
  { sessions: AgentSessionSummary[]; fetchedAt: number }
>();

export function useAgentSessionList(agentId: string | null, enabled = true) {
  const [sessions, setSessions] = useState<AgentSessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(
    async (force = false) => {
      if (!enabled || !agentId) {
        setSessions([]);
        return;
      }

      const cached = historyCache.get(agentId);
      const now = Date.now();
      if (!force && cached && now - cached.fetchedAt < HISTORY_CACHE_MS) {
        setSessions(cached.sessions);
        return;
      }

      setIsLoading(true);
      const res = await fetchAgentSessions(agentId);
      if (res.success && res.data) {
        const normalized = normalizeAgentSessions(res.data.sessions);
        historyCache.set(agentId, { sessions: normalized, fetchedAt: now });
        setSessions(normalized);
      }
      setIsLoading(false);
    },
    [agentId, enabled]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { sessions, isLoading, refresh };
}
