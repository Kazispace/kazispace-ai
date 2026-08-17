import type { SpaceSlice } from '@/lib/space-slice';

/**
 * First-paint scroll/chat settle flag (KAZI-566).
 * Zustand still holds the previous visit's rows after SpaceWorkspace remounts;
 * do not start `historyReady` false and wait an effect tick.
 */
export function isSpaceHistoryReadyFromSlice(
  spaceId: string | null,
  masterSessionId: string | null,
  slice: Pick<SpaceSlice, 'masterSessionId' | 'messages' | 'isHydrating'> | null
): boolean {
  if (!spaceId) return false;
  if (!masterSessionId) return true;
  if (!slice) return false;
  return (
    slice.masterSessionId === masterSessionId &&
    slice.messages.length > 0 &&
    !slice.isHydrating
  );
}
