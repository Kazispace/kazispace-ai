'use client';

import { useLayoutEffect, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';

import {
  SpaceMessageRow,
  type SpaceMessageRowProps,
} from '@/components/spaces/space-message-row';
import type { SpaceChatMessage } from '@/lib/spaces/turn';
import type { StrategySelectTurnContext } from '@/lib/strategy-select';

export type SpaceMessageVirtuosoProps = {
  messages: SpaceChatMessage[];
  strategyContexts: StrategySelectTurnContext[];
  /** Existing SpaceShell overflow node — do not invent a second scroller. */
  scrollParentRef: { readonly current: HTMLElement | null };
} & Omit<SpaceMessageRowProps, 'message' | 'strategy'>;

/**
 * Variable-height Space bubbles inside the existing useChatScroll parent
 * (KAZI-574). follow / jump-to-latest / restore stay on that element.
 */
export function SpaceMessageVirtuoso({
  messages,
  strategyContexts,
  scrollParentRef,
  locale,
  actionsDisabled,
  onRetryById,
  onNextAction,
  onFocusComposer,
  onExamSelect,
  onJobCardClick,
}: SpaceMessageVirtuosoProps) {
  const [scrollParent, setScrollParent] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const node = scrollParentRef.current;
    setScrollParent((prev) => (prev === node ? prev : node));
  }, [scrollParentRef]);

  if (!scrollParent) {
    return null;
  }

  return (
    <Virtuoso
      data={messages}
      customScrollParent={scrollParent}
      defaultItemHeight={160}
      increaseViewportBy={{ top: 800, bottom: 800 }}
      computeItemKey={(_, message) => message.id}
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
