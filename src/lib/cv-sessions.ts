import type { AgentSessionSummary } from "@/types";

/** Stable ordering: active first, then most recently updated. */
export function sortCvSessions(sessions: AgentSessionSummary[]): AgentSessionSummary[] {
  return [...sessions].sort((a, b) => {
    const aActive = a.status === "active" ? 1 : 0;
    const bActive = b.status === "active" ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;
    const aTime = a.updated_at ? Date.parse(a.updated_at) : 0;
    const bTime = b.updated_at ? Date.parse(b.updated_at) : 0;
    return bTime - aTime;
  });
}

export function dedupeCvSessions(sessions: AgentSessionSummary[]): AgentSessionSummary[] {
  const seen = new Set<string>();
  return sessions.filter((session) => {
    if (seen.has(session.session_id)) return false;
    seen.add(session.session_id);
    return true;
  });
}

export function normalizeCvSessions(sessions: AgentSessionSummary[]): AgentSessionSummary[] {
  return sortCvSessions(dedupeCvSessions(sessions));
}
