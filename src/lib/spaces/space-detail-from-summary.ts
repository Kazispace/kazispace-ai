import type { QueryClient } from '@tanstack/react-query';

import { spaceDetailQueryKey } from '@/hooks/use-space-detail';
import { CLINIC_SPACE_ID } from '@/lib/spaces/constants';
import type { SpaceDetail, SpaceSummary } from '@/types/spaces';

/**
 * Sidebar `SpaceSummary` already has id / name / template / master_session_id.
 * Seed the detail query so SpaceWorkspace can mount chat without waiting on
 * GET /spaces/{id} (KAZI-566). Empty snapshots are filled when the real GET lands.
 */
export function spaceDetailFromSummary(space: SpaceSummary): SpaceDetail {
  return {
    ...space,
    config_snapshot: {},
    space_state: {},
    created_at: null,
    updated_at: space.last_active_at,
  };
}

/**
 * Write placeholders only when the cache has no fetched detail.
 * `updatedAt: 0` keeps the row immediately stale so the real GET still runs.
 */
export function seedSpaceDetailPlaceholders(
  queryClient: QueryClient,
  spaces: SpaceSummary[]
): void {
  for (const space of spaces) {
    if (!space.id || space.id === CLINIC_SPACE_ID) continue;
    const key = spaceDetailQueryKey(space.id);
    const state = queryClient.getQueryState<SpaceDetail>(key);
    if (state?.data && state.dataUpdatedAt > 0) continue;
    queryClient.setQueryData(key, spaceDetailFromSummary(space), {
      updatedAt: 0,
    });
  }
}
