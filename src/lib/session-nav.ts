import {
  getAgentHubPath,
  getDedicatedHubAgentFromPathname,
  getSurfacePath,
  resolveSurfaceForAgent,
  resolveSurfaceFromPathname,
} from '@/lib/agent-transition/surfaces';
import type { AgentSurfaceId } from '@/lib/agent-transition/types';
import { AGENT_REGISTRY, getAgentLabel, type AgentRegistryEntry } from '@/lib/agents/registry';
import type { SupportedLocale } from '@/lib/constants';

import type { AgentSessionSummary } from '@/types';

export const SESSION_NAV_STORAGE_KEY = 'kazi.sessionNav.panelOpen';

export type SessionNavRowId = 'clinic' | string;

export type SessionNavBadgeKind =
  | 'comingSoon'
  | 'clinicInline'
  | 'inProgress'
  | 'resumable'
  | 'notStarted'
  | 'pipeline';

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
}

/** Panel rows: Clinic + Registry agents (P0 static). */
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
    badge: isComingSoon ? 'comingSoon' : undefined,
  };
}

export function resolveSessionNavBadge(
  session: AgentSessionSummary | null | undefined
): { kind: SessionNavBadgeKind; detail?: string | null } | null {
  if (!session) return { kind: 'notStarted' };
  if (session.pipeline_state) {
    return { kind: 'pipeline', detail: session.pipeline_state };
  }
  if (session.status === 'active') return { kind: 'inProgress' };
  if (session.status === 'exited') return { kind: 'resumable' };
  if (session.status === 'archived') return { kind: 'resumable' };
  return { kind: 'notStarted' };
}

export function enrichSessionNavRows(
  rows: SessionNavRow[],
  sessionsByAgent: Map<string, AgentSessionSummary>
): SessionNavRow[] {
  return rows.map((row) => {
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
