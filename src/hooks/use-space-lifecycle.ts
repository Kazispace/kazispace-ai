'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import {
  archiveSpace,
  completeSpace,
  deleteSpace,
  restoreSpace,
} from '@/lib/spaces-api';
import { CLINIC_SPACE_ID } from '@/lib/spaces/constants';
import { publishSpacesListInvalidate } from '@/lib/spaces-list-invalidate';
import { useSpaceStore, useUIStore } from '@/lib/store';
import type { SpaceDetail, SpaceStatus } from '@/types/spaces';

export type SpaceLifecycleAction = 'complete' | 'archive' | 'restore' | 'delete';

/** Archived / soft-deleted spaces cannot send turns (BE lifecycle 联调). */
export function isSpaceComposerMuted(status: SpaceStatus): boolean {
  return status === 'archived' || status === 'deleted';
}

export function canRunSpaceLifecycle(
  space: Pick<SpaceDetail, 'id' | 'status' | 'is_system' | 'is_entry_point'>,
  action: SpaceLifecycleAction
): boolean {
  if (space.id === CLINIC_SPACE_ID || space.is_system || space.is_entry_point) {
    return false;
  }
  const status: SpaceStatus = space.status;
  switch (action) {
    case 'complete':
      return status === 'active';
    case 'archive':
      return status === 'active' || status === 'completed';
    case 'restore':
      return status === 'archived' || status === 'deleted';
    case 'delete':
      return status !== 'deleted';
    default:
      return false;
  }
}

/** Mutations for BE lifecycle 联调 (KAZI-176 endpoints). */
export function useSpaceLifecycle(locale: string) {
  const router = useRouter();
  const t = useTranslations('spaces');
  const showToast = useUIStore((s) => s.showToast);
  const clearSpaceSlice = useSpaceStore((s) => s.clearSpaceSlice);
  const [pendingAction, setPendingAction] = useState<SpaceLifecycleAction | null>(
    null
  );

  const run = useCallback(
    async (spaceId: string, action: SpaceLifecycleAction) => {
      setPendingAction(action);
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
        showToast(t(`lifecycle${capitalize(action)}Ok` as 'lifecycleArchiveOk'), 'info');

        if (action === 'delete') {
          clearSpaceSlice(spaceId);
          router.push(`/${locale}/chat`);
        }

        return { ok: true as const, space: res.data };
      } finally {
        setPendingAction(null);
      }
    },
    [clearSpaceSlice, locale, router, showToast, t]
  );

  return { run, pendingAction };
}

function capitalize(action: SpaceLifecycleAction): string {
  return action.charAt(0).toUpperCase() + action.slice(1);
}
