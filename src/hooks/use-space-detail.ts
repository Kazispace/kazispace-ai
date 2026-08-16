'use client';

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getSpace } from '@/lib/spaces-api';
import { CLINIC_SPACE_ID, isSpacesEnabled } from '@/lib/spaces/constants';
import { SPACE_DETAIL_STALE_MS } from '@/lib/spaces/perf-policy';
import { useAuthStore } from '@/lib/store';
import type { SpaceDetail } from '@/types/spaces';

/** Shared key so Header + Workspace share one detail request (KAZI-562). */
export const spaceDetailQueryKey = (spaceId: string) =>
  ['space-detail', spaceId] as const;

export async function fetchSpaceDetail(
  spaceId: string,
  signal?: AbortSignal
): Promise<SpaceDetail> {
  const res = await getSpace(spaceId, { signal });
  if (signal?.aborted) {
    const err = new Error('Aborted');
    err.name = 'AbortError';
    throw err;
  }
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
    queryFn: ({ signal }) => fetchSpaceDetail(spaceId!, signal),
    enabled: queryEnabled,
    staleTime: SPACE_DETAIL_STALE_MS,
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
