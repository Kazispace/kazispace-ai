'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  CHAT_NEAR_BOTTOM_PX,
  isNearBottom,
  readSpaceChatScrollTop,
  scrollElementToBottom,
  writeSpaceChatScrollTop,
} from '@/lib/spaces/chat-scroll';

type UseSpaceChatScrollOptions = {
  spaceId: string;
  /** Message count / sending flag — triggers stick-to-bottom when near bottom. */
  messageCount: number;
  isSending: boolean;
  /** Skip until first hydrate finishes (avoid saving/restoring empty). */
  ready: boolean;
};

/**
 * Per-space scroll memory + "jump to latest" affordance for SpaceChatPane.
 * - Restore last scrollTop on enter (sessionStorage).
 * - Auto-follow bottom only when already near bottom or after send.
 * - Expose showJumpToLatest when latest is off-screen.
 */
export function useSpaceChatScroll({
  spaceId,
  messageCount,
  isSending,
  ready,
}: UseSpaceChatScrollOptions) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const restoredRef = useRef(false);
  const stickToBottomRef = useRef(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateJumpVisibility = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const near = isNearBottom(el);
    stickToBottomRef.current = near;
    setShowJumpToLatest(!near && el.scrollHeight > el.clientHeight + 8);
  }, []);

  const persistScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !ready) return;
    writeSpaceChatScrollTop(spaceId, el.scrollTop);
  }, [ready, spaceId]);

  const handleScroll = useCallback(() => {
    updateJumpVisibility();
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(persistScroll, 120);
  }, [persistScroll, updateJumpVisibility]);

  const jumpToLatest = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = true;
    scrollElementToBottom(el, 'smooth');
    setShowJumpToLatest(false);
    // Persist after smooth scroll settles
    window.setTimeout(() => {
      persistScroll();
    }, 350);
  }, [persistScroll]);

  // Reset restore flag when switching spaces
  useEffect(() => {
    restoredRef.current = false;
    stickToBottomRef.current = true;
    setShowJumpToLatest(false);
  }, [spaceId]);

  // Restore saved position once content is ready; default to bottom if none.
  useEffect(() => {
    if (!ready || restoredRef.current) return;
    const el = scrollRef.current;
    if (!el) return;

    const apply = () => {
      if (restoredRef.current || !scrollRef.current) return;
      const node = scrollRef.current;
      const saved = readSpaceChatScrollTop(spaceId);
      if (saved != null && messageCount > 0) {
        node.scrollTop = Math.min(saved, Math.max(0, node.scrollHeight - node.clientHeight));
        stickToBottomRef.current = isNearBottom(node);
      } else if (messageCount > 0) {
        scrollElementToBottom(node, 'auto');
        stickToBottomRef.current = true;
      }
      restoredRef.current = true;
      updateJumpVisibility();
    };

    // Layout may not have final height on first paint (images/fonts).
    requestAnimationFrame(() => {
      requestAnimationFrame(apply);
    });
  }, [ready, spaceId, messageCount, updateJumpVisibility]);

  // Follow new messages / sending indicator only when stick-to-bottom.
  useEffect(() => {
    if (!ready || !restoredRef.current) return;
    if (!stickToBottomRef.current) {
      updateJumpVisibility();
      return;
    }
    const el = scrollRef.current;
    if (!el) return;
    scrollElementToBottom(el, 'smooth');
    setShowJumpToLatest(false);
  }, [messageCount, isSending, ready, updateJumpVisibility]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      persistScroll();
    };
  }, [persistScroll]);

  return {
    scrollRef,
    showJumpToLatest,
    handleScroll,
    jumpToLatest,
    /** Call after user sends so we pin to latest even if they were scrolled up. */
    pinToLatestOnSend: () => {
      stickToBottomRef.current = true;
    },
  };
}

export { CHAT_NEAR_BOTTOM_PX };
