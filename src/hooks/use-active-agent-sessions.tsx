'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useActiveAgentSync } from '@/hooks/use-active-agent-sync';
import {
  toLatestSessionsByAgent,
  type CurrentSessionsByAgent,
} from '@/lib/current-agent-sessions';
import { fetchCurrentAgentSessions } from '@/lib/agent-api';
import { useAuthStore } from '@/lib/store';
import { SESSION_NAV_INVALIDATE_EVENT } from '@/lib/session-nav-invalidate';

const STALE_TIME_MS = 10_000;

type ActiveAgentSessionsValue = {
  sessionsByAgent: CurrentSessionsByAgent;
  isLoading: boolean;
  error: string | null;
  refresh: (force?: boolean) => Promise<void>;
};

const ActiveAgentSessionsContext = createContext<ActiveAgentSessionsValue | null>(
  null
);

function useActiveAgentSessionsState(options?: {
  panelOpen?: boolean;
  enabled?: boolean;
}): ActiveAgentSessionsValue {
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
        setSessionsByAgent(toLatestSessionsByAgent(res.data.sessions));
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

type ActiveAgentSessionsProviderProps = {
  children: ReactNode;
  panelOpen?: boolean;
  enabled?: boolean;
};

/** Single fetch for Session Nav + Clinic + Hub (ADR-005 / KAZI-148). */
export function ActiveAgentSessionsProvider({
  children,
  panelOpen,
  enabled: enabledProp,
}: ActiveAgentSessionsProviderProps) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const enabled = enabledProp ?? isLoggedIn;
  const value = useActiveAgentSessionsState({ panelOpen, enabled });
  return (
    <ActiveAgentSessionsContext.Provider value={value}>
      {children}
    </ActiveAgentSessionsContext.Provider>
  );
}

export function useActiveAgentSessions(options?: {
  panelOpen?: boolean;
  enabled?: boolean;
}): ActiveAgentSessionsValue {
  const context = useContext(ActiveAgentSessionsContext);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  // Always call the hook (rules-of-hooks) but disable its side effects when a
  // provider already supplies the value, so we never fetch/subscribe twice.
  const standalone = useActiveAgentSessionsState({
    ...options,
    enabled: !context && (options?.enabled ?? isLoggedIn),
  });
  return context ?? standalone;
}
