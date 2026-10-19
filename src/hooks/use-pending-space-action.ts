'use client';

import { useEffect } from 'react';

import { useSpaceStore } from '@/lib/store';
import type { ChatNextAction } from '@/types/chat-envelope';

/**
 * KAZI-1083 — consume a `next_action` raised outside the chat column (the ability panel's
 * 「练这个」) for this space and run it through the chat's own `handle` — the same send as a
 * button on a graded turn (ET SSOT v1.98 ①). Cleared on sight; a click while a turn is in
 * flight is dropped, like every other chat button.
 */
export function usePendingSpaceAction(
  spaceId: string,
  isSending: boolean,
  handle: (action: ChatNextAction) => void
): void {
  const pending = useSpaceStore((s) => s.pendingSpaceAction);
  const clear = useSpaceStore((s) => s.clearSpaceAction);
  useEffect(() => {
    if (!pending || pending.spaceId !== spaceId) return;
    clear(pending.nonce);
    if (isSending) return;
    handle(pending.action);
  }, [clear, handle, isSending, pending, spaceId]);
}
