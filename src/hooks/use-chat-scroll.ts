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
}: UseChatScrollOptions) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const restoredRef = useRef(false);
  const stickToBottomRef = useRef(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrollTopRef = useRef(0);
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

  // Reset when conversation scope changes
  useEffect(() => {
    restoredRef.current = false;
    stickToBottomRef.current = true;
    lastScrollTopRef.current = 0;
    followBaselineCountRef.current = null;
    followBaselineSendingRef.current = false;
    setShowJumpToLatest(false);
  }, [storageKey]);

  // Restore after history is ready — never mark restored while messageCount is still 0 mid-hydrate.
  useEffect(() => {
    if (!ready || restoredRef.current) return;
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
      if (restoredRef.current || !scrollRef.current) return;
      const node = scrollRef.current;
      // Height may still be settling — re-read after a second frame if needed.
      const saved = readChatScrollTop(storageKey);
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
  }, [ready, storageKey, messageCount, isSending, updateJumpVisibility]);

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
    scrollElementToBottom(el, 'smooth');
    lastScrollTopRef.current = el.scrollTop;
    setShowJumpToLatest(false);
  }, [messageCount, isSending, ready, updateJumpVisibility]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      persistScroll(lastScrollTopRef.current);
    };
  }, [persistScroll]);

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

/** @deprecated Use useChatScroll */
export const useSpaceChatScroll = (
  options: Omit<UseChatScrollOptions, 'storageKey'> & { spaceId: string },
) =>
  useChatScroll({
    storageKey: `kazi:space-chat-scroll:${options.spaceId}`,
    messageCount: options.messageCount,
    isSending: options.isSending,
    ready: options.ready,
  });
