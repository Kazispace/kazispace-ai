import type { AgentSessionSummary } from '@/types';

/** Stable ordering: active first, then most recently updated. */
export function sortAgentSessions(
  sessions: AgentSessionSummary[]
): AgentSessionSummary[] {
  return [...sessions].sort((a, b) => {
    const rank = (s: AgentSessionSummary) => {
      if (s.status === 'active') return 2;
      if (s.status === 'exited') return 1;
      return 0;
    };
    const diff = rank(b) - rank(a);
    if (diff !== 0) return diff;
    const aTime = a.updated_at ? Date.parse(a.updated_at) : 0;
    const bTime = b.updated_at ? Date.parse(b.updated_at) : 0;
    return bTime - aTime;
  });
}

export function dedupeAgentSessions(
  sessions: AgentSessionSummary[]
): AgentSessionSummary[] {
  const seen = new Set<string>();
  return sessions.filter((session) => {
    if (seen.has(session.session_id)) return false;
    seen.add(session.session_id);
    return true;
  });
}

export function normalizeAgentSessions(
  sessions: AgentSessionSummary[]
): AgentSessionSummary[] {
  return sortAgentSessions(dedupeAgentSessions(sessions));
}

/** v1.3 §4 — exited and archived sessions are view-only in the UI. */
export function isAgentSessionReadOnly(status?: string | null): boolean {
  return status === 'exited' || status === 'archived';
}
