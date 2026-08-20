import type { QueryClient } from '@tanstack/react-query';

import {
  fetchSpaceDetail,
  spaceDetailQueryKey,
} from '@/hooks/use-space-detail';
import { CLINIC_SPACE_ID } from '@/lib/spaces/constants';
import {
  SPACE_DETAIL_STALE_MS,
  SPACE_HISTORY_STALE_MS,
  SPACE_WORKSPACE_KEEPALIVE_LIMIT,
} from '@/lib/spaces/perf-policy';
import {
  fetchSpaceHistoryMessages,
  spaceHistoryQueryKey,
} from '@/lib/spaces/space-history-query';
import type { SpaceSummary } from '@/types/spaces';

export function isPrefetchableSpaceNavId(spaceId: string): boolean {
  return Boolean(spaceId) && spaceId !== 'clinic' && spaceId !== CLINIC_SPACE_ID;
}

/**
 * Start detail + history before `router.push` so Space switch is not
 * GET /spaces/{id} → then history (KAZI-566).
 */
export function prefetchSpaceSwitch(
  queryClient: QueryClient,
  opts: {
    spaceId: string;
    masterSessionId?: string | null;
    locale: string;
  }
): void {
  if (!isPrefetchableSpaceNavId(opts.spaceId)) return;

  void queryClient.prefetchQuery({
    queryKey: spaceDetailQueryKey(opts.spaceId),
    queryFn: ({ signal }) => fetchSpaceDetail(opts.spaceId, signal),
    staleTime: SPACE_DETAIL_STALE_MS,
  });

  const masterSessionId = opts.masterSessionId?.trim();
  if (!masterSessionId) return;

  void queryClient.prefetchQuery({
    queryKey: spaceHistoryQueryKey(masterSessionId, opts.locale),
    queryFn: ({ signal }) =>
      fetchSpaceHistoryMessages(masterSessionId, opts.locale, signal),
    staleTime: SPACE_HISTORY_STALE_MS,
  });
}

/** Most-recent user Spaces, capped to the keep-alive window. */
export function selectRecentPrefetchSpaces(
  spaces: SpaceSummary[],
  limit: number = SPACE_WORKSPACE_KEEPALIVE_LIMIT
): SpaceSummary[] {
  return spaces
    .filter((space) => isPrefetchableSpaceNavId(space.id))
    .slice()
    .sort((a, b) =>
      (b.last_active_at ?? '').localeCompare(a.last_active_at ?? '')
    )
    .slice(0, limit);
}

/**
 * Warm the keep-alive window (KAZI-588) so the next Space click is not a
 * cold history GET. Most-recent `last_active_at` first.
 */
export function prefetchRecentSpaceSwitches(
  queryClient: QueryClient,
  spaces: SpaceSummary[],
  locale: string,
  limit: number = SPACE_WORKSPACE_KEEPALIVE_LIMIT
): void {
  for (const space of selectRecentPrefetchSpaces(spaces, limit)) {
    prefetchSpaceSwitch(queryClient, {
      spaceId: space.id,
      masterSessionId: space.master_session_id,
      locale,
    });
  }
}
