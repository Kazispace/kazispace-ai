import { getAgentHubPath } from '@/lib/agent-transition/surfaces';
import {
  AGENT_REGISTRY,
  getAgentLabel,
  type AgentRegistryEntry,
} from '@/lib/agents/registry';
import type { SupportedLocale } from '@/lib/constants';
import { resolveSessionNavBadge, type SessionNavBadgeKind } from '@/lib/session-nav';
import type { AgentSessionSummary } from '@/types';

const AGENT_BY_ID = new Map(AGENT_REGISTRY.map((agent) => [agent.agentId, agent]));

export type ClinicActiveSessionEntry = {
  agentId: string;
  agent: AgentRegistryEntry;
  session: AgentSessionSummary;
  href: string;
  badge: SessionNavBadgeKind;
  badgeDetail: string | null;
  displayName: string;
  sessionTitle: string | null;
};

function sessionTimestamp(iso?: string | null): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
}

/** Hub sessions worth surfacing on Clinic welcome (in progress / resumable / pipeline). */
export function buildClinicActiveSessionEntries(
  locale: string,
  sessionsByAgent: Map<string, AgentSessionSummary>
): ClinicActiveSessionEntry[] {
  const entries: ClinicActiveSessionEntry[] = [];

  for (const session of Array.from(sessionsByAgent.values())) {
    const href = getAgentHubPath(locale, session.agent_id);
    if (!href) continue;

    const resolved = resolveSessionNavBadge(session);
    if (
      !resolved ||
      resolved.kind === 'notStarted' ||
      resolved.kind === 'archived' ||
      resolved.kind === 'comingSoon' ||
      resolved.kind === 'clinicInline'
    ) {
      continue;
    }

    const agent = AGENT_BY_ID.get(session.agent_id);
    if (!agent || agent.status === 'coming_soon') continue;

    entries.push({
      agentId: agent.agentId,
      agent,
      session,
      href,
      badge: resolved.kind,
      badgeDetail: resolved.detail ?? session.title ?? null,
      displayName: getAgentLabel(agent, locale as SupportedLocale, 'name'),
      sessionTitle: session.title?.trim() || null,
    });
  }

  return entries.sort(
    (a, b) =>
      sessionTimestamp(b.session.updated_at) - sessionTimestamp(a.session.updated_at)
  );
}
