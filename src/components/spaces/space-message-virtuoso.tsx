'use client';

import { Virtuoso } from 'react-virtuoso';

import { SpaceMessageRow } from '@/components/spaces/space-message-row';
import {
  StaticSpaceMessageRows,
  type SpaceMessageListBodyProps,
} from '@/components/spaces/space-message-static-rows';
import { useChatVirtuosoScrollRestore } from '@/hooks/use-chat-virtuoso-scroll-restore';
import {
  SPACE_CHAT_VIRTUOSO_DEFAULT_ITEM_HEIGHT,
  SPACE_CHAT_VIRTUOSO_VIEWPORT_OVERSCAN,
} from '@/lib/spaces/perf-policy';

export type SpaceMessageVirtuosoProps = SpaceMessageListBodyProps & {
  /** Existing SpaceShell overflow node — do not invent a second scroller. */
  scrollParentRef: { readonly current: HTMLElement | null };
  /** Parent scrollTop captured before static rows unmount. */
  initialScrollTop?: number;
  /** Ignore pixel restore; pin the parent to the last item (KAZI-588). */
  alignToLatest?: boolean;
  /** Keep-alive show retriggers pin; do not pin while `idle` (zero height). */
  activationKey?: string;
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
  alignToLatest = false,
  activationKey = 'default',
}: SpaceMessageVirtuosoProps) {
  const { scrollParent, initialTopMostItemIndex, tryRestore } =
    useChatVirtuosoScrollRestore({
      scrollParentRef,
      initialScrollTop,
      alignToLatest,
      activationKey,
      messagesLength: messages.length,
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
      initialTopMostItemIndex={initialTopMostItemIndex}
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
