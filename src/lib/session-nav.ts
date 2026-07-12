import {
  getAgentHubPath,
  getSurfacePath,
  resolveSurfaceForAgent,
  resolveSurfaceFromPathname,
} from '@/lib/agent-transition/surfaces';
import type { AgentSurfaceId } from '@/lib/agent-transition/types';
import { AGENT_REGISTRY, type AgentRegistryEntry } from '@/lib/agents/registry';

export const SESSION_NAV_STORAGE_KEY = 'kazi.sessionNav.panelOpen';

export type SessionNavRowId = 'clinic' | string;

export interface SessionNavRow {
  id: SessionNavRowId;
  agentId: string | null;
  emoji: string;
  label: string;
  href: string | null;
  surface: AgentSurfaceId;
  disabled: boolean;
  disabledReason?: string;
  badge?: string;
}

/** Panel rows: Clinic + Registry agents (P0 static). */
export function buildSessionNavRows(locale: string): SessionNavRow[] {
  const clinicRow: SessionNavRow = {
    id: 'clinic',
    agentId: null,
    emoji: '💬',
    label: 'clinic',
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
    label: agent.agentId,
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

export function resolveActiveNavRowId(pathname: string): SessionNavRowId {
  const surface = resolveSurfaceFromPathname(pathname);
  if (surface === 'clinic') return 'clinic';
  const segment = pathname.split('/').filter(Boolean)[1];
  const match = AGENT_REGISTRY.find((a) => {
    const path = getAgentHubPath('en', a.agentId);
    return path?.endsWith(`/${segment}`);
  });
  return match?.agentId ?? 'clinic';
}

export function navigateToSessionNavTarget(
  router: { push: (href: string) => void },
  row: SessionNavRow
): void {
  if (row.disabled || !row.href) return;
  router.push(row.href);
}
