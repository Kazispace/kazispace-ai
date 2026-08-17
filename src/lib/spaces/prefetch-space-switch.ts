import type { QueryClient } from '@tanstack/react-query';

import {
  fetchSpaceDetail,
  spaceDetailQueryKey,
} from '@/hooks/use-space-detail';
import { CLINIC_SPACE_ID } from '@/lib/spaces/constants';
import {
  SPACE_DETAIL_STALE_MS,
  SPACE_HISTORY_STALE_MS,
} from '@/lib/spaces/perf-policy';
import {
  fetchSpaceHistoryMessages,
  spaceHistoryQueryKey,
} from '@/lib/spaces/space-history-query';

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
