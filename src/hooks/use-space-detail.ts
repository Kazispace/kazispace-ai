'use client';

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getSpace } from '@/lib/spaces-api';
import { CLINIC_SPACE_ID, isSpacesEnabled } from '@/lib/spaces/constants';
import { useAuthStore } from '@/lib/store';
import type { SpaceDetail } from '@/types/spaces';

/** Shared key so Header + Workspace share one detail request (KAZI-562). */
export const spaceDetailQueryKey = (spaceId: string) =>
  ['space-detail', spaceId] as const;

async function fetchSpaceDetail(spaceId: string): Promise<SpaceDetail> {
  const res = await getSpace(spaceId);
  if (!res.success || !res.data) {
    throw new Error(res.error ?? 'Failed to load space');
  }
  return res.data;
}

export function useSpaceDetail(spaceId: string | null) {
  const enabled = isSpacesEnabled();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const queryClient = useQueryClient();
  /** Clinic chrome falls back to local titles — skip GET /spaces/__clinic__. */
  const isClinicChrome = spaceId === CLINIC_SPACE_ID;
  const queryEnabled =
    enabled && isLoggedIn && Boolean(spaceId) && !isClinicChrome;

  const query = useQuery({
    queryKey: spaceDetailQueryKey(spaceId ?? ''),
    queryFn: () => fetchSpaceDetail(spaceId!),
    enabled: queryEnabled,
    staleTime: 30_000,
    retry: 1,
  });

  const refresh = useCallback(async () => {
    if (!queryEnabled || !spaceId) return;
    await queryClient.invalidateQueries({
      queryKey: spaceDetailQueryKey(spaceId),
    });
  }, [queryClient, queryEnabled, spaceId]);

  return {
    space: query.data ?? null,
    isLoading: queryEnabled && query.isLoading,
    error: query.error
      ? query.error instanceof Error
        ? query.error.message
        : 'Failed to load space'
      : null,
    refresh,
    enabled,
  };
}
