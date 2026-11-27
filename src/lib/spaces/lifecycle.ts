import { CLINIC_SPACE_ID, isArchivedSpaceTemplate } from '@/lib/spaces/constants';
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
  space: Pick<SpaceDetail, 'id' | 'status' | 'is_system' | 'is_entry_point'> &
    Partial<Pick<SpaceDetail, 'template_id'>>,
  action: SpaceLifecycleAction
): boolean {
  if (space.id === CLINIC_SPACE_ID || space.is_system || space.is_entry_point) {
    return false;
  }
  // An archived template (CV / job search, kazispace-ui D39) counts as archived whatever the
  // server status says, so Complete / Archive / Restore would contradict the list it sits in.
  // Only Delete is offered.
  if (space.template_id && isArchivedSpaceTemplate(space.template_id)) {
    return action === 'delete' && space.status !== 'deleted';
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
