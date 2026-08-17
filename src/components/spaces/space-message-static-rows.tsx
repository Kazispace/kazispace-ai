'use client';

import {
  SpaceMessageRow,
  type SpaceMessageRowProps,
} from '@/components/spaces/space-message-row';
import type { SpaceChatMessage } from '@/lib/spaces/turn';
import type { StrategySelectTurnContext } from '@/lib/strategy-select';

export type SpaceMessageListBodyProps = {
  messages: SpaceChatMessage[];
  strategyContexts: StrategySelectTurnContext[];
} & Omit<SpaceMessageRowProps, 'message' | 'strategy'>;

/** Shared map used by short threads and as the Virtuoso loading/failure fallback. */
export function StaticSpaceMessageRows({
  messages,
  strategyContexts,
  locale,
  actionsDisabled,
  onRetryById,
  onNextAction,
  onFocusComposer,
  onExamSelect,
  onJobCardClick,
}: SpaceMessageListBodyProps) {
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
