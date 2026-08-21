'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  SPACE_HISTORY_QUERY_DEFAULTS,
  fetchSpaceHistoryMessages,
  hydrateSpaceHistoryMessages,
  mergeHydratedSpaceHistoryRows,
  spaceHistoryQueryKey,
} from '@/lib/spaces/space-history-query';
import type { SpaceChatMessage } from '@/lib/spaces/turn';

/**
 * Shared Space history authority (KAZI-562).
 * Consumers (chat pane today; Header/side later) must use this key — not ad-hoc effects.
 */
export function useSpaceHistoryQuery(
  masterSessionId: string | null,
  locale: string,
  options?: { enabled?: boolean }
) {
  const enabled =
    Boolean(masterSessionId?.trim()) && (options?.enabled ?? true);

  return useQuery({
    queryKey: spaceHistoryQueryKey(masterSessionId?.trim() ?? '', locale),
    queryFn: ({ signal }) =>
      fetchSpaceHistoryMessages(masterSessionId!.trim(), locale, signal),
    enabled,
    ...SPACE_HISTORY_QUERY_DEFAULTS,
    retry: 1,
    retryDelay: 0,
    /** Warm remount must not refetch; a failed fetch must (KAZI-588 R2). */
    refetchOnMount: (query) => query.state.status === 'error',
  });
}

/** Force a fresh history read (placeholder recovery / missing server id). */
export function useFetchSpaceHistory() {
  const queryClient = useQueryClient();

  return useCallback(
    async (
      masterSessionId: string,
      locale: string
    ): Promise<SpaceChatMessage[]> => {
      return queryClient.fetchQuery({
        queryKey: spaceHistoryQueryKey(masterSessionId, locale),
        queryFn: ({ signal }) =>
          fetchSpaceHistoryMessages(masterSessionId, locale, signal),
        staleTime: 0,
      });
    },
    [queryClient]
  );
}

/** Hydrate stub ids into the shared history query (KAZI-580). */
export function useHydrateSpaceHistory() {
  const queryClient = useQueryClient();

  return useCallback(
    async (
      masterSessionId: string,
      locale: string,
      ids: string[]
    ): Promise<SpaceChatMessage[]> => {
      const hydrated = await hydrateSpaceHistoryMessages(
        masterSessionId,
        locale,
        ids
      );
      if (hydrated.length === 0) return hydrated;
      queryClient.setQueryData(
        spaceHistoryQueryKey(masterSessionId, locale),
        (previous: SpaceChatMessage[] | undefined) =>
          mergeHydratedSpaceHistoryRows(previous ?? [], hydrated)
      );
      return hydrated;
    },
    [queryClient]
  );
}
