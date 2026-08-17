import type { SpaceSlice } from '@/lib/space-slice';

export type SpaceHistoryReadyState = {
  key: string;
  ready: boolean;
};

export function spaceHistoryReadyKey(
  spaceId: string | null,
  masterSessionId: string | null
): string {
  return `${spaceId ?? ''}:${masterSessionId ?? ''}`;
}

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

/**
 * In-place A→B (same hook instance, new spaceId) must not inherit A's ready.
 * Key mismatch → derive from B's own slice on this render, not an effect.
 */
export function resolveSpaceHistoryReadyState(
  spaceId: string | null,
  masterSessionId: string | null,
  slice: Pick<SpaceSlice, 'masterSessionId' | 'messages' | 'isHydrating'> | null,
  stored: SpaceHistoryReadyState | null
): SpaceHistoryReadyState {
  const key = spaceHistoryReadyKey(spaceId, masterSessionId);
  const fromSlice = isSpaceHistoryReadyFromSlice(spaceId, masterSessionId, slice);
  if (stored && stored.key === key) {
    return { key, ready: stored.ready || fromSlice };
  }
  return { key, ready: fromSlice };
}

/** SpaceChatPane first paint: loading vs welcome vs rows. */
export function spaceChatFirstPaintKind(opts: {
  historyReady: boolean;
  isHydrating: boolean;
  messageCount: number;
}): 'loading' | 'welcome' | 'messages' {
  if ((!opts.historyReady || opts.isHydrating) && opts.messageCount === 0) {
    return 'loading';
  }
  if (opts.messageCount === 0) return 'welcome';
  return 'messages';
}
