'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  SPACE_HISTORY_QUERY_DEFAULTS,
  fetchSpaceHistoryMessages,
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
