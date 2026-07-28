import type { AgentSessionSummary } from '@/types';

const DEFAULT_RECENT_COUNT = 6;

export function sessionSortTime(session: AgentSessionSummary): number {
  const raw = session.updated_at ?? session.created_at;
  if (!raw) return 0;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

export function sortSessionsNewestFirst(
  sessions: AgentSessionSummary[]
): AgentSessionSummary[] {
  return [...sessions].sort((a, b) => sessionSortTime(b) - sessionSortTime(a));
}

export function partitionSessionsByRecency(
  sessions: AgentSessionSummary[],
  recentCount = DEFAULT_RECENT_COUNT
): { recent: AgentSessionSummary[]; older: AgentSessionSummary[] } {
  const sorted = sortSessionsNewestFirst(sessions);
  return {
    recent: sorted.slice(0, recentCount),
    older: sorted.slice(recentCount),
  };
}
