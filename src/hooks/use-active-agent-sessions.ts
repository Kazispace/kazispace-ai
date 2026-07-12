'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useActiveAgentSync } from '@/hooks/use-active-agent-sync';
import { fetchCurrentAgentSessions } from '@/lib/agent-api';
import { SESSION_NAV_INVALIDATE_EVENT } from '@/lib/session-nav-invalidate';
import type { AgentSessionSummary } from '@/types';

const STALE_TIME_MS = 10_000;

export type CurrentSessionsByAgent = Map<string, AgentSessionSummary>;

function toSessionsByAgent(sessions: AgentSessionSummary[]): CurrentSessionsByAgent {
  const map = new Map<string, AgentSessionSummary>();
  for (const session of sessions) {
    if (!session.agent_id) continue;
    map.set(session.agent_id, session);
  }
  return map;
}

export function useActiveAgentSessions(options?: {
  panelOpen?: boolean;
  enabled?: boolean;
}) {
  const enabled = options?.enabled ?? true;
  const panelOpen = options?.panelOpen ?? false;
  const [sessionsByAgent, setSessionsByAgent] = useState<CurrentSessionsByAgent>(
    () => new Map()
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchedAt = useRef(0);

  const refresh = useCallback(
    async (force = false) => {
      if (!enabled) return;
      const now = Date.now();
      if (!force && now - lastFetchedAt.current < STALE_TIME_MS) return;

      setIsLoading(true);
      const res = await fetchCurrentAgentSessions();
      if (res.success && res.data) {
        setSessionsByAgent(toSessionsByAgent(res.data.sessions));
        setError(null);
        lastFetchedAt.current = now;
      } else if (res.error) {
        setError(res.error);
      }
      setIsLoading(false);
    },
    [enabled]
  );

  useEffect(() => {
    if (!enabled) return;
    void refresh(true);
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled || !panelOpen) return;
    void refresh(true);
  }, [enabled, panelOpen, refresh]);

  useActiveAgentSync(enabled, () => refresh(true));

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const onInvalidate = () => void refresh(true);
    window.addEventListener(SESSION_NAV_INVALIDATE_EVENT, onInvalidate);
    return () => window.removeEventListener(SESSION_NAV_INVALIDATE_EVENT, onInvalidate);
  }, [enabled, refresh]);

  return { sessionsByAgent, isLoading, error, refresh };
}
