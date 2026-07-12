'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import { deactivateToClinic } from '@/lib/deactivate-to-clinic';
import { leaveDedicatedHubForClinic } from '@/lib/leave-dedicated-hub';
import { useUIStore } from '@/lib/store';

export function useDeactivateToClinic(locale: string) {
  const router = useRouter();
  const showToast = useUIStore((s) => s.showToast);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const deactivateAndGo = useCallback(
    async (options?: {
      agentId?: string;
      showReturnMessage?: boolean;
      targetHref?: string;
      bestEffort?: boolean;
    }) => {
      if (isDeactivating) return { ok: false as const };
      const targetHref = options?.targetHref ?? `/${locale}/chat`;

      if (options?.bestEffort && options.agentId) {
        setIsDeactivating(true);
        leaveDedicatedHubForClinic(locale, options.agentId);
        router.push(targetHref);
        window.setTimeout(() => setIsDeactivating(false), 400);
        return { ok: true as const, agentId: options.agentId };
      }

      setIsDeactivating(true);
      try {
        const result = await deactivateToClinic(locale, {
          agentId: options?.agentId,
        });
        if (!result.ok) {
          return result;
        }
        if (options?.showReturnMessage && result.returnMessage) {
          showToast(result.returnMessage, 'info');
        }
        router.push(targetHref);
        return result;
      } finally {
        setIsDeactivating(false);
      }
    },
    [isDeactivating, locale, router, showToast]
  );

  return { deactivateAndGo, isDeactivating };
}
