'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import { deactivateToClinic } from '@/lib/deactivate-to-clinic';
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
    }) => {
      if (isDeactivating) return { ok: false as const };
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
        router.push(options?.targetHref ?? `/${locale}/chat`);
        return result;
      } finally {
        setIsDeactivating(false);
      }
    },
    [isDeactivating, locale, router, showToast]
  );

  return { deactivateAndGo, isDeactivating };
}
