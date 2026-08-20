'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  clampScrollTop,
  isNearBottom,
  readChatScrollTop,
  scrollElementToBottom,
  writeChatScrollTop,
} from '@/lib/spaces/chat-scroll';

export type UseChatScrollOptions = {
  /** sessionStorage key — must be stable per conversation surface. */
  storageKey: string;
  messageCount: number;
  isSending: boolean;
  /**
   * True when history is settled enough to restore (e.g. !isHydrating && session ready).
   * Must stay false while a fetch may still replace the message list.
   */
  ready: boolean;
  /**
   * Space switch (KAZI-588): pin to the latest message instead of the last
   * sessionStorage scrollTop. Pixel restore + Virtuoso left users on stubs.
   */
  alignToLatest?: boolean;
  /** Rising edge retriggers align (keep-alive show). */
  activationKey?: string;
};

/**
 * Chat scroll memory + jump-to-latest FAB.
 * - Restore last scrollTop only after `ready` (full history painted).
 * - Auto-follow bottom only on *new* messages / send while near bottom — never on the restore frame.
 */
export function useChatScroll({
  storageKey,
  messageCount,
  isSending,
  ready,
  alignToLatest = false,
  activationKey = 'default',
}: UseChatScrollOptions) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const restoredRef = useRef(false);
  const stickToBottomRef = useRef(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrollTopRef = useRef(0);
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const activationKeyRef = useRef(activationKey);
  activationKeyRef.current = activationKey;
  /** null until first follow-effect sync after restore — prevents restore→follow overwrite. */
  const followBaselineCountRef = useRef<number | null>(null);
  const followBaselineSendingRef = useRef(false);

  const updateJumpVisibility = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    lastScrollTopRef.current = el.scrollTop;
    const near = isNearBottom(el);
    stickToBottomRef.current = near;
    setShowJumpToLatest(!near && el.scrollHeight > el.clientHeight + 8);
  }, []);

  const persistScroll = useCallback(
    (scrollTop?: number) => {
      if (!ready) return;
      const top =
        scrollTop ??
        scrollRef.current?.scrollTop ??
        lastScrollTopRef.current;
      writeChatScrollTop(storageKey, top);
    },
    [ready, storageKey],
  );

  const handleScroll = useCallback(() => {
    updateJumpVisibility();
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => persistScroll(), 120);
  }, [persistScroll, updateJumpVisibility]);

  const jumpToLatest = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = true;
    scrollElementToBottom(el, 'smooth');
    setShowJumpToLatest(false);
    window.setTimeout(() => {
      if (scrollRef.current) {
        lastScrollTopRef.current = scrollRef.current.scrollTop;
      }
      persistScroll();
    }, 350);
  }, [persistScroll]);

  // Reset when conversation scope changes, or keep-alive shows this surface.
  useEffect(() => {
    restoredRef.current = false;
    stickToBottomRef.current = true;
    lastScrollTopRef.current = 0;
    followBaselineCountRef.current = null;
    followBaselineSendingRef.current = false;
    setShowJumpToLatest(false);
  }, [storageKey, activationKey]);

  // History re-fetch / layer unload: allow a fresh restore; do not wipe sessionStorage
  // (ready flickering used to flush lastScrollTop=0 and destroy the saved position).
  useEffect(() => {
    if (ready) return;
    restoredRef.current = false;
    followBaselineCountRef.current = null;
    followBaselineSendingRef.current = false;
  }, [ready]);

  // Restore after history is ready — never mark restored while messageCount is still 0 mid-hydrate.
  // activationKey must be a dep: keep-alive show does not change storageKey/ready, but must re-pin.
  useEffect(() => {
    if (!ready || restoredRef.current) return;
    // Hidden keep-alive instances have 0 height; pinning now would lock a false restore.
    if (alignToLatest && activationKey === 'idle') return;
    const el = scrollRef.current;
    if (!el) return;

    // Empty thread after settle: nothing to restore.
    if (messageCount === 0) {
      restoredRef.current = true;
      followBaselineCountRef.current = 0;
      followBaselineSendingRef.current = isSending;
      setShowJumpToLatest(false);
      return;
    }

    const apply = () => {
      // ready may have flipped false between schedule and rAF (re-hydrate).
      if (!readyRef.current || restoredRef.current || !scrollRef.current) return;
      if (alignToLatest && activationKeyRef.current === 'idle') return;
      const node = scrollRef.current;
      // Height may still be settling — re-read after a second frame if needed.
      const saved = alignToLatest ? null : readChatScrollTop(storageKey);
      if (saved != null) {
        node.scrollTop = clampScrollTop(node, saved);
        stickToBottomRef.current = isNearBottom(node);
      } else {
        scrollElementToBottom(node, 'auto');
        stickToBottomRef.current = true;
      }
      lastScrollTopRef.current = node.scrollTop;
      restoredRef.current = true;
      followBaselineCountRef.current = messageCount;
      followBaselineSendingRef.current = isSending;
      updateJumpVisibility();

      // Re-clamp once layout grows (markdown/tables) so we don't stick to a false "bottom".
      if (saved != null) {
        requestAnimationFrame(() => {
          const n = scrollRef.current;
          if (!n || !restoredRef.current) return;
          if (stickToBottomRef.current) return;
          n.scrollTop = clampScrollTop(n, saved);
          lastScrollTopRef.current = n.scrollTop;
          updateJumpVisibility();
        });
      }
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(apply);
    });
  }, [
    ready,
    storageKey,
    messageCount,
    isSending,
    updateJumpVisibility,
    alignToLatest,
    activationKey,
  ]);

  // Follow only when count/sending advances *after* restore baseline is set.
  useEffect(() => {
    if (!ready || !restoredRef.current) return;
    if (followBaselineCountRef.current === null) return;

    const prevCount = followBaselineCountRef.current;
    const prevSending = followBaselineSendingRef.current;
    followBaselineCountRef.current = messageCount;
    followBaselineSendingRef.current = isSending;

    const grew = messageCount > prevCount;
    const sendStarted = isSending && !prevSending;
    if (!grew && !sendStarted) {
      updateJumpVisibility();
      return;
    }
    if (!stickToBottomRef.current) {
      updateJumpVisibility();
      return;
    }
    const el = scrollRef.current;
    if (!el) return;
    // Instant follow — smooth + growing markdown height jittered the viewport (KAZI-566).
    scrollElementToBottom(el, 'auto');
    lastScrollTopRef.current = el.scrollTop;
    setShowJumpToLatest(false);
  }, [messageCount, isSending, ready, updateJumpVisibility]);

  // Flush only when leaving a conversation scope (key change / unmount).
  // Skip if we never restored — avoids wiping a prior saved position with 0 on quick leave.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (!restoredRef.current) return;
      writeChatScrollTop(storageKey, lastScrollTopRef.current);
    };
  }, [storageKey]);

  return {
    scrollRef,
    showJumpToLatest,
    handleScroll,
    jumpToLatest,
    pinToLatestOnSend: () => {
      stickToBottomRef.current = true;
    },
  };
}
