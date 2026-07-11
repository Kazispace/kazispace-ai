'use client';

import { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { useDeactivateToClinic } from '@/hooks/use-deactivate-to-clinic';
import { getDedicatedHubAgentFromPathname } from '@/lib/agent-layer';
import { useUIStore } from '@/lib/store';

/** Navigate to Clinic — deactivates sticky hub agent when leaving dedicated hub pages. */
export function useHubClinicNav(locale: string) {
  const pathname = usePathname();
  const router = useRouter();
  const hubAgentId = getDedicatedHubAgentFromPathname(pathname);
  const { deactivateAndGo, isDeactivating } = useDeactivateToClinic(locale);
  const showToast = useUIStore((s) => s.showToast);
  const tClinic = useTranslations('clinic');

  const goToClinic = useCallback(async () => {
    if (hubAgentId) {
      const result = await deactivateAndGo({ agentId: hubAgentId });
      if (result && !result.ok) {
        showToast(tClinic('deactivateFailed'), 'error');
      }
      return;
    }
    router.push(`/${locale}/chat`);
  }, [deactivateAndGo, hubAgentId, locale, router, showToast, tClinic]);

  return {
    hubAgentId,
    goToClinic,
    isDeactivating,
    isOnHub: Boolean(hubAgentId),
  };
}

export function isClinicNavHref(href: string, locale: string): boolean {
  return href === `/${locale}` || href === `/${locale}/chat`;
}
