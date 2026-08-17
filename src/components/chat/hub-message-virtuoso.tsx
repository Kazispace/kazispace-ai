'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';

import { HubMessageRow } from '@/components/chat/hub-message-row';
import {
  StaticHubMessageRows,
  type HubMessageListBodyProps,
} from '@/components/chat/hub-message-static-rows';
import {
  SPACE_CHAT_VIRTUOSO_DEFAULT_ITEM_HEIGHT,
  SPACE_CHAT_VIRTUOSO_VIEWPORT_OVERSCAN,
} from '@/lib/spaces/perf-policy';
import { restoreSpaceChatScrollAfterVirtualize } from '@/lib/spaces/space-message-virtualize';

export type HubMessageVirtuosoProps = HubMessageListBodyProps & {
  /** Existing hub overflow node — do not invent a second scroller. */
  scrollParentRef: { readonly current: HTMLElement | null };
  /** Parent scrollTop captured before static rows unmount. */
  initialScrollTop?: number;
};

/**
 * Variable-height hub bubbles inside the existing overflow parent (KAZI-576).
 */
export function HubMessageVirtuoso({
  messages,
  locale,
  isStreaming,
  scrollParentRef,
  initialScrollTop = 0,
}: HubMessageVirtuosoProps) {
  const [scrollParent, setScrollParent] = useState<HTMLElement | null>(
    () => scrollParentRef.current
  );
  const restoredRef = useRef(false);

  useLayoutEffect(() => {
    const node = scrollParentRef.current;
    setScrollParent((prev) => (prev === node ? prev : node));
  }, [scrollParentRef]);

  const tryRestore = () => {
    if (restoredRef.current || !scrollParent) return;
    if (restoreSpaceChatScrollAfterVirtualize(scrollParent, initialScrollTop)) {
      restoredRef.current = true;
    }
  };

  useLayoutEffect(() => {
    tryRestore();
  });

  const rowProps = { messages, locale, isStreaming };

  if (!scrollParent) {
    return <StaticHubMessageRows {...rowProps} />;
  }

  return (
    <Virtuoso
      data={messages}
      customScrollParent={scrollParent}
      defaultItemHeight={SPACE_CHAT_VIRTUOSO_DEFAULT_ITEM_HEIGHT}
      increaseViewportBy={{
        top: SPACE_CHAT_VIRTUOSO_VIEWPORT_OVERSCAN,
        bottom: SPACE_CHAT_VIRTUOSO_VIEWPORT_OVERSCAN,
      }}
      computeItemKey={(_, message) => message.id}
      totalListHeightChanged={tryRestore}
      itemContent={(index, message) => (
        <div className={index < messages.length - 1 ? 'pb-3' : undefined}>
          <HubMessageRow
            message={message}
            locale={locale}
            isStreamingEmpty={isStreaming && message.content === ''}
          />
        </div>
      )}
    />
  );
}
