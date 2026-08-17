import {
  getAgentHubPath,
  getDedicatedHubAgentFromPathname,
  getSurfacePath,
  resolveSurfaceForAgent,
  resolveSurfaceFromPathname,
} from '@/lib/agent-transition/surfaces';
import { primeSessionNavHandoff } from '@/lib/session-nav-handoff';
import { publishSessionNavSelectHistory } from '@/lib/session-nav-events';
import type { AgentSurfaceId } from '@/lib/agent-transition/types';
import { AGENT_REGISTRY, getAgentLabel, type AgentRegistryEntry } from '@/lib/agents/registry';
import type { SupportedLocale } from '@/lib/constants';
import { resolveSpaceIdFromPathname } from '@/lib/space-nav';

import type { AgentSessionSummary } from '@/types';

export const SESSION_NAV_STORAGE_KEY = 'kazi.sessionNav.panelOpen';

export const SESSION_NAV_PANEL_MODE_KEY = 'kazi.sessionNav.panelMode';

export type SessionNavViewTab = 'agent' | 'session';

export type SessionNavPanelMode = 'agents' | 'files' | 'search';

export type SessionNavRowId = 'clinic' | string;

export type SessionNavBadgeKind =
  | 'comingSoon'
  | 'clinicInline'
  | 'inProgress'
  | 'resumable'
  | 'archived'
  | 'notStarted'
  | 'pipeline'
  | 'completed';

export interface SessionNavRow {
  id: SessionNavRowId;
  agentId: string | null;
  emoji: string;
  /** Localized display label (Panel renders this directly). */
  displayName: string;
  href: string | null;
  surface: AgentSurfaceId;
  disabled: boolean;
  disabledReason?: string;
  badge?: SessionNavBadgeKind;
  /** Dynamic badge detail (e.g. pipeline_state or session title snippet). */
  badgeDetail?: string | null;
  currentSession?: AgentSessionSummary | null;
  /** Space master session — hover/click prefetch of history (KAZI-566). */
  masterSessionId?: string | null;
}

/**
 * Panel rows: Clinic + Registry agents (ADR-005 P0 static).
 *
 * @deprecated ADR-006 — replace with `buildSpaceNavRows()` (Clinic + user spaces).
 * Do not extend Agent rows (P2 history tabs, cross-agent search). Frozen per
 * docs/ADR-006-FE-FREEZE.md.
 */
export function buildSessionNavRows(
  locale: string,
  clinicLabel: string
): SessionNavRow[] {
  const clinicRow: SessionNavRow = {
    id: 'clinic',
    agentId: null,
    emoji: '💬',
    displayName: clinicLabel,
    href: getSurfacePath(locale, 'clinic'),
    surface: 'clinic',
    disabled: false,
  };

  const agentRows: SessionNavRow[] = AGENT_REGISTRY.map((agent) =>
    registryEntryToNavRow(agent, locale)
  );

  return [clinicRow, ...agentRows];
}

function registryEntryToNavRow(
  agent: AgentRegistryEntry,
  locale: string
): SessionNavRow {
  const hubPath = getAgentHubPath(locale, agent.agentId);
  const isComingSoon = agent.status === 'coming_soon';
  const isClinicInline = agent.agentId === 'job_search';

  return {
    id: agent.agentId,
    agentId: agent.agentId,
    emoji: agent.emoji,
    displayName: getAgentLabel(agent, locale as SupportedLocale, 'name'),
    href: hubPath,
    surface: resolveSurfaceForAgent(agent.agentId),
    disabled: isComingSoon || isClinicInline || !hubPath,
    disabledReason: isComingSoon
      ? 'comingSoon'
      : isClinicInline
        ? 'clinicInline'
        : undefined,
    badge: isComingSoon ? 'comingSoon' : isClinicInline ? 'clinicInline' : undefined,
  };
}

/** Static + session badge for registry agents (Clinic cards / switcher). */
export function resolveRegistryAgentBadge(
  agent: AgentRegistryEntry,
  session?: AgentSessionSummary | null
): { kind: SessionNavBadgeKind; detail?: string | null } | null {
  if (agent.status === 'coming_soon') return { kind: 'comingSoon' };
  if (agent.agentId === 'job_search') return { kind: 'clinicInline' };

  const resolved = resolveSessionNavBadge(session ?? null);
  // Available agents without a Current session show no badge (not "Not started").
  if (!resolved || resolved.kind === 'notStarted') return null;
  return resolved;
}

export function resolveSessionNavBadge(
  session: AgentSessionSummary | null | undefined
): { kind: SessionNavBadgeKind; detail?: string | null } | null {
  if (!session) return { kind: 'notStarted' };
  if (session.status === 'archived') return { kind: 'archived' };
  // Prefer pipeline detail when present; parked Current still counts as in-progress.
  if (session.status === 'active' && session.pipeline_state) {
    return { kind: 'pipeline', detail: session.pipeline_state };
  }
  if (session.status === 'active' && session.parked === true) {
    return { kind: 'inProgress', detail: session.title ?? null };
  }
  if (session.status === 'active') return { kind: 'inProgress' };
  if (session.status === 'exited') return { kind: 'resumable' };
  return { kind: 'notStarted' };
}

export function enrichSessionNavRows(
  rows: SessionNavRow[],
  sessionsByAgent: Map<string, AgentSessionSummary>
): SessionNavRow[] {
  return rows.map((row) => {
    // job_search has no Hub URL or independent Current slot — keep static clinicInline hint.
    if (row.badge === 'comingSoon' || row.disabledReason === 'clinicInline') {
      return row;
    }
    if (!row.agentId) return row;

    const currentSession = sessionsByAgent.get(row.agentId) ?? null;
    const resolved = resolveSessionNavBadge(currentSession);
    if (!resolved) return { ...row, currentSession };

    return {
      ...row,
      currentSession,
      badge: resolved.kind,
      badgeDetail: resolved.detail ?? currentSession?.title ?? null,
    };
  });
}

export function resolveContextHeaderSession(
  pathname: string,
  sessionsByAgent: Map<string, AgentSessionSummary>
): AgentSessionSummary | null {
  const agentId = getDedicatedHubAgentFromPathname(pathname);
  if (!agentId) return null;
  return sessionsByAgent.get(agentId) ?? null;
}

export function resolveActiveNavRowId(pathname: string): SessionNavRowId {
  const spaceId = resolveSpaceIdFromPathname(pathname);
  if (spaceId) return spaceId;

  const surface = resolveSurfaceFromPathname(pathname);
  if (surface === 'clinic') return 'clinic';
  const agentId = getDedicatedHubAgentFromPathname(pathname);
  return agentId ?? 'clinic';
}

export function navigateToSessionNavTarget(
  router: { push: (href: string) => void },
  row: SessionNavRow
): void {
  if (row.disabled || !row.href) return;
  router.push(row.href);
}

export interface SessionViewRow {
  id: string;
  kind: 'clinic' | 'agent';
  agentId: string | null;
  emoji: string;
  displayName: string;
  sessionTitle?: string | null;
  href: string;
  badge?: SessionNavBadgeKind;
  badgeDetail?: string | null;
  updatedAt?: string | null;
  session?: AgentSessionSummary | null;
}

function sessionTimestamp(iso?: string | null): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
}

/** Session tab: cross-agent flat list + FE Clinic row (SDD §5.3). */
export function buildSessionViewRows(
  locale: string,
  clinicLabel: string,
  sessionsByAgent: Map<string, AgentSessionSummary>
): SessionViewRow[] {
  const clinicRow: SessionViewRow = {
    id: 'clinic',
    kind: 'clinic',
    agentId: null,
    emoji: '💬',
    displayName: clinicLabel,
    href: getSurfacePath(locale, 'clinic'),
    updatedAt: null,
  };

  const agentRows: SessionViewRow[] = [];
  for (const session of Array.from(sessionsByAgent.values())) {
    const agent = AGENT_REGISTRY.find((entry) => entry.agentId === session.agent_id);
    if (!agent) continue;
    const href = getAgentHubPath(locale, agent.agentId);
    if (!href) continue;
    const badge = resolveSessionNavBadge(session);
    agentRows.push({
      id: session.session_id,
      kind: 'agent',
      agentId: agent.agentId,
      emoji: agent.emoji,
      displayName: getAgentLabel(agent, locale as SupportedLocale, 'name'),
      sessionTitle: session.title,
      href,
      updatedAt: session.updated_at,
      badge: badge?.kind,
      badgeDetail: badge?.detail ?? session.title,
      session,
    });
  }

  agentRows.sort(
    (a, b) => sessionTimestamp(b.updatedAt) - sessionTimestamp(a.updatedAt)
  );

  return [clinicRow, ...agentRows];
}

export function filterSessionNavRows(
  rows: SessionNavRow[],
  query: string
): SessionNavRow[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return rows;
  return rows.filter((row) => {
    const haystack = [
      row.displayName,
      row.badgeDetail,
      row.currentSession?.title,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(trimmed);
  });
}

export function filterSessionViewRows(
  rows: SessionViewRow[],
  query: string
): SessionViewRow[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return rows;
  return rows.filter((row) => {
    const haystack = [row.displayName, row.sessionTitle, row.badgeDetail]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(trimmed);
  });
}

/** Open a specific agent session: in-page event when already on hub, sessionStorage handoff when navigating. */
export function openAgentSessionTarget(
  router: { push: (href: string) => void },
  pathname: string,
  locale: string,
  agentId: string,
  sessionId: string
): void {
  const href = getAgentHubPath(locale, agentId);
  if (!href) return;

  const currentAgent = getDedicatedHubAgentFromPathname(pathname);
  if (currentAgent === agentId) {
    publishSessionNavSelectHistory(agentId, sessionId);
    if (pathname !== href) router.push(href);
    return;
  }

  primeSessionNavHandoff(agentId, sessionId);
  router.push(href);
}
