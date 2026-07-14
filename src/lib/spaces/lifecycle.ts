import { CLINIC_SPACE_ID } from '@/lib/spaces/constants';
import type { SpaceDetail, SpaceStatus } from '@/types/spaces';

export type SpaceLifecycleAction = 'complete' | 'archive' | 'restore' | 'delete';

/**
 * Mute composer for archived / soft-deleted only.
 * `completed` stays writable so users can continue the thread or archive later.
 */
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
