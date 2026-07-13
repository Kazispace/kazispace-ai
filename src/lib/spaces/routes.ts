import { CLINIC_SPACE_ID } from '@/lib/spaces/constants';
import type { SpaceSummary } from '@/types/spaces';

/** `/spaces` with no spaceId — not a workspace route; needs index resolver. */
export function isSpacesIndexPath(path: string): boolean {
  return path === '/spaces';
}

/** Latest non-Clinic user space for `/spaces` → `/spaces/{id}` routing. */
export function pickLatestUserSpace(spaces: SpaceSummary[]): SpaceSummary | null {
  const userSpaces = spaces.filter(
    (space) => !space.is_entry_point && space.id !== CLINIC_SPACE_ID
  );
  if (userSpaces.length === 0) {
    return null;
  }

  return [...userSpaces].sort((a, b) => {
    const aTime = a.last_active_at ?? '';
    const bTime = b.last_active_at ?? '';
    return bTime.localeCompare(aTime);
  })[0] ?? null;
}
