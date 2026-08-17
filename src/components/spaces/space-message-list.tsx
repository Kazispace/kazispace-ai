'use client';

import dynamic from 'next/dynamic';

import {
  SpaceMessageRow,
  type SpaceMessageRowProps,
} from '@/components/spaces/space-message-row';
import { shouldVirtualizeSpaceMessages } from '@/lib/spaces/space-message-virtualize';
import type { SpaceChatMessage } from '@/lib/spaces/turn';
import type { StrategySelectTurnContext } from '@/lib/strategy-select';

/** Load virtuoso only after the thread crosses the threshold. */
const SpaceMessageVirtuoso = dynamic(
  () =>
    import('@/components/spaces/space-message-virtuoso').then(
      (m) => m.SpaceMessageVirtuoso
    ),
  { ssr: false }
);

export type SpaceMessageListProps = {
  messages: SpaceChatMessage[];
  strategyContexts: StrategySelectTurnContext[];
  scrollParentRef: { readonly current: HTMLElement | null };
} & Omit<SpaceMessageRowProps, 'message' | 'strategy'>;

export function SpaceMessageList({
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
}: SpaceMessageListProps) {
  if (!shouldVirtualizeSpaceMessages(messages.length)) {
    return (
      <>
        {messages.map((message, messageIndex) => (
          <SpaceMessageRow
            key={message.id}
            message={message}
            strategy={strategyContexts[messageIndex] ?? {}}
            locale={locale}
            actionsDisabled={actionsDisabled}
            onRetryById={onRetryById}
            onNextAction={onNextAction}
            onFocusComposer={onFocusComposer}
            onExamSelect={onExamSelect}
            onJobCardClick={onJobCardClick}
          />
        ))}
      </>
    );
  }

  return (
    <SpaceMessageVirtuoso
      messages={messages}
      strategyContexts={strategyContexts}
      scrollParentRef={scrollParentRef}
      locale={locale}
      actionsDisabled={actionsDisabled}
      onRetryById={onRetryById}
      onNextAction={onNextAction}
      onFocusComposer={onFocusComposer}
      onExamSelect={onExamSelect}
      onJobCardClick={onJobCardClick}
    />
  );
}
