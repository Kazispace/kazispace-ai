'use client';

import { useCallback, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import {
  archiveSpace,
  completeSpace,
  deleteSpace,
  restoreSpace,
} from '@/lib/spaces-api';
import {
  type SpaceLifecycleAction,
} from '@/lib/spaces/lifecycle';
import { resolveSpaceIdFromPathname } from '@/lib/space-nav';
import { publishSpacesListInvalidate } from '@/lib/spaces-list-invalidate';
import { useSpaceStore, useUIStore } from '@/lib/store';

export type { SpaceLifecycleAction };
export {
  canRunSpaceLifecycle,
  isSpaceComposerMuted,
} from '@/lib/spaces/lifecycle';

/** Mutations for BE lifecycle 联调 (KAZI-176 endpoints). */
export function useSpaceLifecycle(locale: string) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('spaces');
  const showToast = useUIStore((s) => s.showToast);
  const clearSpaceSlice = useSpaceStore((s) => s.clearSpaceSlice);
  const [pendingAction, setPendingAction] = useState<SpaceLifecycleAction | null>(
    null
  );
  const [pendingSpaceId, setPendingSpaceId] = useState<string | null>(null);

  const run = useCallback(
    async (spaceId: string, action: SpaceLifecycleAction) => {
      setPendingAction(action);
      setPendingSpaceId(spaceId);
      try {
        const res =
          action === 'complete'
            ? await completeSpace(spaceId)
            : action === 'archive'
              ? await archiveSpace(spaceId)
              : action === 'restore'
                ? await restoreSpace(spaceId)
                : await deleteSpace(spaceId);

        if (!res.success || !res.data) {
          showToast(res.error ?? t('lifecycleFailed'), 'error');
          return { ok: false as const, error: res.error };
        }

        publishSpacesListInvalidate();
        const okMessages: Record<SpaceLifecycleAction, string> = {
          complete: t('lifecycleCompleteOk'),
          archive: t('lifecycleArchiveOk'),
          restore: t('lifecycleRestoreOk'),
          delete: t('lifecycleDeleteOk'),
        };
        showToast(okMessages[action], 'info');

        if (action === 'delete') {
          clearSpaceSlice(spaceId);
          // Only leave the page when the deleted space is the one being viewed.
          if (resolveSpaceIdFromPathname(pathname) === spaceId) {
            router.push(`/${locale}/chat`);
          }
        }

        return { ok: true as const, space: res.data };
      } finally {
        setPendingAction(null);
        setPendingSpaceId(null);
      }
    },
    [clearSpaceSlice, locale, pathname, router, showToast, t]
  );

  return { run, pendingAction, pendingSpaceId };
}
