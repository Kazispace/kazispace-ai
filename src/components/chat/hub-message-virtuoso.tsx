'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
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

type HubVirtuosoContext = {
  header?: ReactNode;
};

function HubMessageVirtuosoHeader({ context }: { context: HubVirtuosoContext }) {
  return <>{context.header ?? null}</>;
}

const HUB_MESSAGE_VIRTUOSO_COMPONENTS = {
  Header: HubMessageVirtuosoHeader,
};

function hubMessageItemClass(
  index: number,
  lastIndex: number,
  constrainToColumn: boolean
): string | undefined {
  if (!constrainToColumn) {
    return index < lastIndex ? 'pb-3' : undefined;
  }
  const parts = ['px-4 max-w-3xl mx-auto w-full'];
  if (index === 0) parts.push('pt-4');
  parts.push(index < lastIndex ? 'pb-3' : 'pb-4');
  return parts.join(' ');
}

/**
 * Variable-height hub bubbles inside the existing overflow parent (KAZI-576).
 */
export function HubMessageVirtuoso({
  messages,
  locale,
  isStreaming,
  header,
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

  const rowProps = { messages, locale, isStreaming, header };
  const constrainToColumn = header != null;
  const lastIndex = messages.length - 1;

  if (!scrollParent) {
    return <StaticHubMessageRows {...rowProps} />;
  }

  return (
    <Virtuoso
      data={messages}
      context={{ header }}
      components={HUB_MESSAGE_VIRTUOSO_COMPONENTS}
      customScrollParent={scrollParent}
      defaultItemHeight={SPACE_CHAT_VIRTUOSO_DEFAULT_ITEM_HEIGHT}
      increaseViewportBy={{
        top: SPACE_CHAT_VIRTUOSO_VIEWPORT_OVERSCAN,
        bottom: SPACE_CHAT_VIRTUOSO_VIEWPORT_OVERSCAN,
      }}
      computeItemKey={(_, message) => message.id}
      totalListHeightChanged={tryRestore}
      itemContent={(index, message) => (
        <div className={hubMessageItemClass(index, lastIndex, constrainToColumn)}>
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
