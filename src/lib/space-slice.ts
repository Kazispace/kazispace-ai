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
}

export function emptySpaceSlice(
  masterSessionId: string | null = null
): SpaceSlice {
  return {
    masterSessionId,
    messages: [],
    isHydrating: false,
    isSending: false,
    replyNotice: null,
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
