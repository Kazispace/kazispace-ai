import type { AgentSessionSummary } from '@/types';

export type CurrentSessionsByAgent = Map<string, AgentSessionSummary>;

function sessionTimestamp(iso?: string | null): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
}

/** One row per agent — keep the session with the latest `updated_at`. */
export function toLatestSessionsByAgent(
  sessions: AgentSessionSummary[]
): CurrentSessionsByAgent {
  const map = new Map<string, AgentSessionSummary>();
  for (const session of sessions) {
    if (!session.agent_id) continue;
    const prev = map.get(session.agent_id);
    if (
      !prev ||
      sessionTimestamp(session.updated_at) > sessionTimestamp(prev.updated_at)
    ) {
      map.set(session.agent_id, session);
    }
  }
  return map;
}
