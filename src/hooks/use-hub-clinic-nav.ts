'use client';

import { useCallback, type MouseEvent } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { useDeactivateToClinic } from '@/hooks/use-deactivate-to-clinic';
import { getDedicatedHubAgentFromPathname } from '@/lib/agent-layer';

/** Top-level nav targets when leaving a dedicated hub (/cv, /interview, /english). */
export function isHubExitDestination(href: string, locale: string): boolean {
  return href === `/${locale}` || href === `/${locale}/chat`;
}

/**
 * Leaving dedicated hub pages — navigate to Clinic immediately (ADR-005 navigate-only).
 */
export function useHubClinicNav(locale: string) {
  const pathname = usePathname();
  const router = useRouter();
  const hubAgentId = getDedicatedHubAgentFromPathname(pathname);
  const { deactivateAndGo, isDeactivating } = useDeactivateToClinic(locale);

  const navigateFromHub = useCallback(
    async (targetHref: string) => {
      if (hubAgentId) {
        await deactivateAndGo({
          agentId: hubAgentId,
          targetHref,
          bestEffort: true,
        });
        return;
      }
      router.push(targetHref);
    },
    [deactivateAndGo, hubAgentId, router]
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
    isOnHub: Boolean(hubAgentId),
  };
}
