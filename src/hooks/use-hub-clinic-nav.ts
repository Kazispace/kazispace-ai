'use client';

import { useCallback, type MouseEvent } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { useDeactivateToClinic } from '@/hooks/use-deactivate-to-clinic';
import { getDedicatedHubAgentFromPathname } from '@/lib/agent-layer';
import { useUIStore } from '@/lib/store';

/** Top-level nav targets when leaving a dedicated hub (/cv, /interview, /english). */
export function isHubExitDestination(href: string, locale: string): boolean {
  return href === `/${locale}` || href === `/${locale}/chat`;
}

/**
 * Leaving dedicated hub pages — deactivates sticky agent before navigating away.
 * `isOnHub` is pathname-based (optimistic); deactivateAndGo tolerates stale sessions.
 */
export function useHubClinicNav(locale: string) {
  const pathname = usePathname();
  const router = useRouter();
  const hubAgentId = getDedicatedHubAgentFromPathname(pathname);
  const { deactivateAndGo, isDeactivating } = useDeactivateToClinic(locale);
  const showToast = useUIStore((s) => s.showToast);
  const tClinic = useTranslations('clinic');

  const navigateFromHub = useCallback(
    async (targetHref: string) => {
      if (hubAgentId) {
        const result = await deactivateAndGo({
          agentId: hubAgentId,
          targetHref,
        });
        if (result && !result.ok) {
          showToast(tClinic('deactivateFailed'), 'error');
        }
        return;
      }
      router.push(targetHref);
    },
    [deactivateAndGo, hubAgentId, router, showToast, tClinic]
  );

  const handleHubExitClick = useCallback(
    (event: MouseEvent, targetHref: string) => {
      if (!hubAgentId || !isHubExitDestination(targetHref, locale)) return;
      event.preventDefault();
      void navigateFromHub(targetHref);
    },
    [hubAgentId, locale, navigateFromHub]
  );

  return {
    hubAgentId,
    navigateFromHub,
    handleHubExitClick,
    isDeactivating,
    /** Pathname indicates a dedicated hub surface — not server active-agent state. */
    isOnHub: Boolean(hubAgentId),
  };
}
