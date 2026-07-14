import type { SpaceChatMessage } from '@/lib/spaces/turn';

export type SpaceReplyNotice = {
  kind: 'error' | 'pending';
  message: string;
  retryable?: boolean;
  retryMessageId?: string;
};

/**
 * Per-space client state (ADR-006 / KAZI-178).
 * Supersedes per-agent chat slices for Space orchestrator turns.
 */
export interface SpaceSlice {
  masterSessionId: string | null;
  messages: SpaceChatMessage[];
  isHydrating: boolean;
  isSending: boolean;
  replyNotice: SpaceReplyNotice | null;
  /** Worker foreground for this space only (KAZI-195). */
  activeCapability: string | null;
  /** Turn-driven panel highlight; workspace syncs to `?panel=` then clears (KAZI-182). */
  activePanelHint: string | null;
}

/** Cap cached space slices to avoid unbounded SPA memory. */
export const SPACE_SLICE_LRU_LIMIT = 10;

export function emptySpaceSlice(
  masterSessionId: string | null = null
): SpaceSlice {
  return {
    masterSessionId,
    messages: [],
    isHydrating: false,
    isSending: false,
    replyNotice: null,
    activeCapability: null,
    activePanelHint: null,
  };
}

export function getSpaceSliceFromRecord(
  spaces: Record<string, SpaceSlice>,
  spaceId: string
): SpaceSlice {
  return spaces[spaceId] ?? emptySpaceSlice();
}

export function patchSpaceSlice(
  spaces: Record<string, SpaceSlice>,
  spaceId: string,
  patch: Partial<SpaceSlice>
): Record<string, SpaceSlice> {
  const prev = spaces[spaceId] ?? emptySpaceSlice();
  return { ...spaces, [spaceId]: { ...prev, ...patch } };
}

/** Most-recent-first order; trims to `limit`. */
export function touchSpaceLruOrder(
  order: string[],
  spaceId: string,
  limit: number = SPACE_SLICE_LRU_LIMIT
): string[] {
  return [spaceId, ...order.filter((id) => id !== spaceId)].slice(0, limit);
}

export function pruneSpacesToLru(
  spaces: Record<string, SpaceSlice>,
  order: string[]
): Record<string, SpaceSlice> {
  const keep = new Set(order);
  const next: Record<string, SpaceSlice> = {};
  for (const [id, slice] of Object.entries(spaces)) {
    if (keep.has(id)) next[id] = slice;
  }
  return next;
}

/**
 * Patch a slice and bump its LRU position; drop slices beyond the cap.
 * Prefer retaining `protectSpaceId` (e.g. active) when truncating.
 */
export function patchSpaceSliceWithLru(
  spaces: Record<string, SpaceSlice>,
  lruOrder: string[],
  spaceId: string,
  patch: Partial<SpaceSlice>,
  options?: { limit?: number; protectSpaceId?: string | null }
): { spaces: Record<string, SpaceSlice>; lruOrder: string[] } {
  const limit = options?.limit ?? SPACE_SLICE_LRU_LIMIT;
  const protectSpaceId = options?.protectSpaceId ?? null;
  const patched = patchSpaceSlice(spaces, spaceId, patch);
  let order = touchSpaceLruOrder(lruOrder, spaceId, limit);

  if (
    protectSpaceId &&
    protectSpaceId !== spaceId &&
    patched[protectSpaceId] &&
    !order.includes(protectSpaceId)
  ) {
    order = touchSpaceLruOrder(order, protectSpaceId, limit);
  }

  return {
    spaces: pruneSpacesToLru(patched, order),
    lruOrder: order,
  };
}

/**
 * Touch LRU for an existing slice only — never create empty entries.
 * Used when activating a space before history/messages lands.
 */
export function touchExistingSpaceLru(
  spaces: Record<string, SpaceSlice>,
  lruOrder: string[],
  spaceId: string,
  options?: { limit?: number; protectSpaceId?: string | null }
): { spaces: Record<string, SpaceSlice>; lruOrder: string[] } {
  if (!spaces[spaceId]) {
    return { spaces, lruOrder };
  }
  return patchSpaceSliceWithLru(spaces, lruOrder, spaceId, {}, options);
}

export function removeSpaceFromLru(
  spaces: Record<string, SpaceSlice>,
  lruOrder: string[],
  spaceId: string
): { spaces: Record<string, SpaceSlice>; lruOrder: string[] } {
  const nextSpaces = { ...spaces };
  delete nextSpaces[spaceId];
  return {
    spaces: nextSpaces,
    lruOrder: lruOrder.filter((id) => id !== spaceId),
  };
}
