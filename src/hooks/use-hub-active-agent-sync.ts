'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { useActiveAgentSync } from '@/hooks/use-active-agent-sync';
import { getActiveAgent } from '@/lib/agent-api';
import { getAgentHubPath } from '@/lib/agent-layer';
import { useAgentStore } from '@/lib/store';

/**
 * Scheme A (URL-first navigation) — hub-side sync rules:
 *
 * - URL-first: the current hub pathname is treated as user intent. We never redirect
 *   away from a dedicated hub URL just because the server has no active_agent (e.g.
 *   after Clinic deactivated, or cold deep-link to /cv).
 * - Active-agent-first (runtime only): when another tab activates a *different* expert,
 *   follow that switch so all tabs stay on the same agent surface.
 *
 * Clinic (/chat) uses the complementary rule in clinic-shell: dedicated hub stickies
 * are deactivated on the server when the user is on Clinic, instead of auto-resuming.
 * Hub hooks (useCvAgent, useInterview, …) re-activate and resume sessions on hub entry.
 */
export function useHubActiveAgentSync(
  locale: string,
  expectedAgentId: string,
  enabled: boolean
) {
  const router = useRouter();

  const syncFromServer = useCallback(async () => {
    const res = await getActiveAgent();
    const activeAgent = res.data?.active_agent ?? null;

    if (!activeAgent) {
      useAgentStore.getState().setActiveAgent(null, null);
      return;
    }

    if (activeAgent !== expectedAgentId) {
      const hubPath = getAgentHubPath(locale, activeAgent);
      router.replace(hubPath ?? `/${locale}/chat`);
    }
  }, [expectedAgentId, locale, router]);

  useActiveAgentSync(enabled, syncFromServer);
}
