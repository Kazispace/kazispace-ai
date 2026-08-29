'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import {
  pinChatScrollToLatest,
  shouldPinChatScrollToLatest,
} from '@/lib/spaces/chat-scroll';
import { restoreSpaceChatScrollAfterVirtualize } from '@/lib/spaces/space-message-virtualize';

export type ChatVirtuosoTopMostItem = number | { index: number; align: 'end' };

/**
 * Shared scroll-restore/pin-to-latest state machine for the Virtuoso variant
 * of the chat message list. Previously reimplemented identically in
 * ClinicMessageVirtuoso, SpaceMessageVirtuoso, and (a subset of it, always
 * with alignToLatest=false) HubMessageVirtuoso — the exact scroll-jump bugs
 * KAZI-588 needed 4 rounds to fix would have needed the same fix 3x over.
 */
export function useChatVirtuosoScrollRestore({
  scrollParentRef,
  initialScrollTop = 0,
  alignToLatest = false,
  activationKey = 'default',
  messagesLength,
}: {
  scrollParentRef: { readonly current: HTMLElement | null };
  initialScrollTop?: number;
  alignToLatest?: boolean;
  activationKey?: string;
  messagesLength: number;
}): {
  scrollParent: HTMLElement | null;
  initialTopMostItemIndex: ChatVirtuosoTopMostItem;
  tryRestore: () => void;
} {
  const [scrollParent, setScrollParent] = useState<HTMLElement | null>(
    () => scrollParentRef.current
  );
  const restoredRef = useRef(false);
  const initialTopMostRef = useRef<ChatVirtuosoTopMostItem>(0);
  const didFreezeInitialRef = useRef(false);
  if (alignToLatest && messagesLength > 0 && !didFreezeInitialRef.current) {
    didFreezeInitialRef.current = true;
    initialTopMostRef.current = { index: messagesLength - 1, align: 'end' };
  }

  useLayoutEffect(() => {
    const node = scrollParentRef.current;
    setScrollParent((prev) => (prev === node ? prev : node));
  }, [scrollParentRef]);

  useLayoutEffect(() => {
    restoredRef.current = false;
  }, [activationKey]);

  const tryRestore = useCallback(() => {
    if (!scrollParent) return;
    if (alignToLatest) {
      if (
        !shouldPinChatScrollToLatest({
          alignToLatest,
          activationKey,
          alreadyPinned: restoredRef.current,
          hasOverflow: scrollParent.scrollHeight > scrollParent.clientHeight,
        })
      ) {
        return;
      }
      pinChatScrollToLatest(scrollParent);
      restoredRef.current = true;
      return;
    }
    if (restoredRef.current) return;
    if (restoreSpaceChatScrollAfterVirtualize(scrollParent, initialScrollTop)) {
      restoredRef.current = true;
    }
  }, [activationKey, alignToLatest, initialScrollTop, scrollParent]);

  useLayoutEffect(() => {
    tryRestore();
  }, [messagesLength, tryRestore]);

  return {
    scrollParent,
    initialTopMostItemIndex: initialTopMostRef.current,
    tryRestore,
  };
}
