'use client';

import { useMemo } from 'react';

import type { CurrentSessionsByAgent } from '@/lib/current-agent-sessions';
import { resolveSessionNavBadge } from '@/lib/session-nav';
import {
  formatSessionNavBadgeLabel,
  type SessionNavBadgeTranslator,
} from '@/lib/session-nav-badges';

/** LayerIndicator / HubLayerBar status line from current agent session. */
export function useLayerStatusBadge(
  agentId: string | null | undefined,
  sessionsByAgent: CurrentSessionsByAgent,
  t: SessionNavBadgeTranslator
): string | null {
  return useMemo(() => {
    if (!agentId) return null;
    const session = sessionsByAgent.get(agentId);
    if (!session) return null;
    const badge = resolveSessionNavBadge(session);
    if (!badge) return null;
    const detail =
      badge.kind === 'pipeline'
        ? session.pipeline_state ?? session.title
        : badge.detail ?? session.title;
    return formatSessionNavBadgeLabel(badge.kind, detail, t);
  }, [agentId, sessionsByAgent, t]);
}
