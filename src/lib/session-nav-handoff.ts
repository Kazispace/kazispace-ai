const SESSION_NAV_HANDOFF_KEY = 'kazi.sessionNav.handoff';
const HANDOFF_TTL_MS = 60_000;

type SessionNavHandoff = {
  agentId: string;
  sessionId: string;
  at: number;
};

export function primeSessionNavHandoff(agentId: string, sessionId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: SessionNavHandoff = {
      agentId,
      sessionId,
      at: Date.now(),
    };
    sessionStorage.setItem(SESSION_NAV_HANDOFF_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function consumeSessionNavHandoff(agentId: string): string | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(SESSION_NAV_HANDOFF_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SessionNavHandoff;
    if (
      !parsed ||
      parsed.agentId !== agentId ||
      typeof parsed.sessionId !== 'string' ||
      Date.now() - parsed.at > HANDOFF_TTL_MS
    ) {
      return null;
    }
    sessionStorage.removeItem(SESSION_NAV_HANDOFF_KEY);
    return parsed.sessionId;
  } catch {
    sessionStorage.removeItem(SESSION_NAV_HANDOFF_KEY);
    return null;
  }
}
