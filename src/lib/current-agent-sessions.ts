import { parseSessionTimestamp } from '@/lib/session-timestamp';
import type { AgentSessionSummary } from '@/types';

export type CurrentSessionsByAgent = Map<string, AgentSessionSummary>;

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
      parseSessionTimestamp(session.updated_at) >
        parseSessionTimestamp(prev.updated_at)
    ) {
      map.set(session.agent_id, session);
    }
  }
  return map;
}
