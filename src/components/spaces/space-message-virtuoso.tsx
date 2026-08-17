'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';

import { SpaceMessageRow } from '@/components/spaces/space-message-row';
import {
  StaticSpaceMessageRows,
  type SpaceMessageListBodyProps,
} from '@/components/spaces/space-message-static-rows';
import {
  SPACE_CHAT_VIRTUOSO_DEFAULT_ITEM_HEIGHT,
  SPACE_CHAT_VIRTUOSO_VIEWPORT_OVERSCAN,
} from '@/lib/spaces/perf-policy';
import { restoreSpaceChatScrollAfterVirtualize } from '@/lib/spaces/space-message-virtualize';

export type SpaceMessageVirtuosoProps = SpaceMessageListBodyProps & {
  /** Existing SpaceShell overflow node — do not invent a second scroller. */
  scrollParentRef: { readonly current: HTMLElement | null };
  /** Parent scrollTop captured before static rows unmount. */
  initialScrollTop?: number;
};

/**
 * Variable-height Space bubbles inside the existing useChatScroll parent
 * (KAZI-574). follow / jump-to-latest / restore stay on that element.
 */
export function SpaceMessageVirtuoso({
  messages,
  strategyContexts,
  scrollParentRef,
  initialScrollTop = 0,
  locale,
  actionsDisabled,
  onRetryById,
  onNextAction,
  onFocusComposer,
  onExamSelect,
  onJobCardClick,
}: SpaceMessageVirtuosoProps) {
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

  const rowProps = {
    messages,
    strategyContexts,
    locale,
    actionsDisabled,
    onRetryById,
    onNextAction,
    onFocusComposer,
    onExamSelect,
    onJobCardClick,
  };

  if (!scrollParent) {
    return <StaticSpaceMessageRows {...rowProps} />;
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
          <SpaceMessageRow
            message={message}
            strategy={strategyContexts[index] ?? {}}
            locale={locale}
            actionsDisabled={actionsDisabled}
            onRetryById={onRetryById}
            onNextAction={onNextAction}
            onFocusComposer={onFocusComposer}
            onExamSelect={onExamSelect}
            onJobCardClick={onJobCardClick}
          />
        </div>
      )}
    />
  );
}
