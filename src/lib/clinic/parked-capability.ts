/**
 * Capability Lifecycle · Park (KAZI-269 / KAZI-265 M3)
 * SSOT: kazispace-design Lifecycle-Park §3.1.2 / §3.2.1 / §6
 */

import type { AgentSessionSummary } from '@/types';

/** Interactive capabilities that participate in INV-P1 Park mutex (MVP). */
export const PARK_INTERACTIVE_AGENT_IDS = [
  'job_search',
  'cv_builder',
  'mock_interview',
  'english_tutor',
] as const;

export type ParkInteractiveAgentId = (typeof PARK_INTERACTIVE_AGENT_IDS)[number];

export function isParkInteractiveAgentId(
  agentId: string | null | undefined
): agentId is ParkInteractiveAgentId {
  return (
    typeof agentId === 'string' &&
    (PARK_INTERACTIVE_AGENT_IDS as readonly string[]).includes(agentId)
  );
}

/**
 * Parked = Current (`active`) + `parked: true`.
 * Delivery kind never shows as Park badge even if flag is stale.
 */
export function isParkedInteractiveSession(
  session: AgentSessionSummary | null | undefined
): boolean {
  if (!session) return false;
  if (session.status !== 'active') return false;
  if (session.parked !== true) return false;
  if (session.lifecycle_kind === 'delivery') return false;
  return true;
}

/** INV-P1: at most one parked interactive per Space — pick latest updated. */
export function selectParkedInteractiveSession(
  sessions: Iterable<AgentSessionSummary>
): AgentSessionSummary | null {
  let best: AgentSessionSummary | null = null;
  let bestTs = -1;
  for (const session of Array.from(sessions)) {
    if (!isParkedInteractiveSession(session)) continue;
    const ts = session.updated_at ? Date.parse(session.updated_at) : 0;
    const score = Number.isFinite(ts) ? ts : 0;
    // INV-P1 expects ≤1; if ties, prefer the later list entry (stable for Map.values).
    if (!best || score >= bestTs) {
      best = session;
      bestTs = score;
    }
  }
  return best;
}

export function selectParkedInteractiveFromMap(
  sessionsByAgent: Map<string, AgentSessionSummary>
): AgentSessionSummary | null {
  return selectParkedInteractiveSession(sessionsByAgent.values());
}

/**
 * Current interactive for ConfirmAbandon copy (Parked or still focused Current).
 *
 * Prefer parked: after Hub→Clinic cold-open the conflicting interactive is usually
 * Parked (Current + parked), which is what the Park badge and INV-P2 conflict share.
 * Fall back to any active interactive-kind / known interactive agent id.
 */
export function isCurrentInteractiveSession(
  session: AgentSessionSummary | null | undefined
): boolean {
  if (!session) return false;
  if (session.status !== 'active') return false;
  if (session.lifecycle_kind === 'delivery') return false;
  if (session.lifecycle_kind === 'interactive') return true;
  if (session.parked === true) return true;
  return isParkInteractiveAgentId(session.agent_id);
}

export function selectCurrentInteractiveSession(
  sessions: Iterable<AgentSessionSummary>
): AgentSessionSummary | null {
  // Product: Parked wins for dialog copy — same session the Park badge shows.
  const parked = selectParkedInteractiveSession(sessions);
  if (parked) return parked;
  let best: AgentSessionSummary | null = null;
  let bestTs = -1;
  for (const session of Array.from(sessions)) {
    if (!isCurrentInteractiveSession(session)) continue;
    const ts = session.updated_at ? Date.parse(session.updated_at) : 0;
    const score = Number.isFinite(ts) ? ts : 0;
    if (!best || score >= bestTs) {
      best = session;
      bestTs = score;
    }
  }
  return best;
}

export function selectCurrentInteractiveFromMap(
  sessionsByAgent: Map<string, AgentSessionSummary>
): AgentSessionSummary | null {
  return selectCurrentInteractiveSession(sessionsByAgent.values());
}

/**
 * Starting `targetAgentId` would replace a parked interactive (INV-P2).
 * Same agent resume uses `sessions/open` — no confirm.
 */
export function needsParkReplaceConfirm(
  parked: AgentSessionSummary | null | undefined,
  targetAgentId: string
): boolean {
  if (!isParkedInteractiveSession(parked)) return false;
  if (!isParkInteractiveAgentId(targetAgentId)) return false;
  return parked!.agent_id !== targetAgentId;
}
