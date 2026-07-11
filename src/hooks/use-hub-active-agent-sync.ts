'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { useActiveAgentSync } from '@/hooks/use-active-agent-sync';
import { getActiveAgent } from '@/lib/agent-api';
import { getAgentHubPath } from '@/lib/agent-layer';
import { useAgentStore } from '@/lib/store';

/** Resync dedicated hub pages when another tab activates/deactivates an expert. */
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
      // Scheme A: hub URL is user intent — do not redirect to Clinic on deactivate/sync.
      return;
    }

    if (activeAgent !== expectedAgentId) {
      const hubPath = getAgentHubPath(locale, activeAgent);
      router.replace(hubPath ?? `/${locale}/chat`);
    }
  }, [expectedAgentId, locale, router]);

  useActiveAgentSync(enabled, syncFromServer);
}
