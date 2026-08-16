'use client';

import { memo, useCallback } from 'react';

import { MessageBubble } from '@/components/clinic/message-bubble';
import type { StrategySelectTurnContext } from '@/lib/strategy-select';
import type { SpaceChatMessage } from '@/lib/spaces/turn';
import type { ChatJobCard, ChatNextAction } from '@/types/chat-envelope';
import type { ExamPickerOption } from '@/types/english-tutor-envelope';

export type SpaceMessageRowProps = {
  message: SpaceChatMessage;
  strategy: StrategySelectTurnContext;
  locale: string;
  actionsDisabled: boolean;
  onRetryById: (messageId: string) => void;
  onNextAction: (action: ChatNextAction) => void;
  onFocusComposer: () => void;
  onExamSelect: (option: ExamPickerOption) => void;
  onJobCardClick: (card: ChatJobCard) => void;
};

function spaceMessageRowEqual(
  prev: SpaceMessageRowProps,
  next: SpaceMessageRowProps
): boolean {
  return (
    prev.message === next.message &&
    prev.strategy.activeNextActions === next.strategy.activeNextActions &&
    prev.strategy.selectedStrategyPayload ===
      next.strategy.selectedStrategyPayload &&
    prev.locale === next.locale &&
    prev.actionsDisabled === next.actionsDisabled &&
    prev.onRetryById === next.onRetryById &&
    prev.onNextAction === next.onNextAction &&
    prev.onFocusComposer === next.onFocusComposer &&
    prev.onExamSelect === next.onExamSelect &&
    prev.onJobCardClick === next.onJobCardClick
  );
}

function SpaceMessageRowImpl({
  message,
  strategy,
  locale,
  actionsDisabled,
  onRetryById,
  onNextAction,
  onFocusComposer,
  onExamSelect,
  onJobCardClick,
}: SpaceMessageRowProps) {
  const handleRetry = useCallback(() => {
    onRetryById(message.id);
  }, [message.id, onRetryById]);

  return (
    <MessageBubble
      role={message.role}
      content={message.content}
      messageId={message.id}
      serverMessageId={message.serverMessageId}
      status={message.status}
      cards={message.cards}
      nextActions={message.nextActions}
      selectedStrategyPayload={strategy.selectedStrategyPayload}
      assistantMeta={message.assistantMeta}
      customComponents={message.customComponents}
      locale={locale}
      variant="clinic"
      composerTarget="space"
      streamComplete
      onJobCardClick={onJobCardClick}
      onNextAction={
        strategy.activeNextActions ? onNextAction : undefined
      }
      onFocusComposer={onFocusComposer}
      onExamSelect={onExamSelect}
      actionsDisabled={actionsDisabled}
      onRetry={
        message.role === 'user' && message.status === 'failed'
          ? handleRetry
          : undefined
      }
    />
  );
}

/** Memoized Space thread row — neighbor updates must not rerender this bubble. */
export const SpaceMessageRow = memo(SpaceMessageRowImpl, spaceMessageRowEqual);

export { spaceMessageRowEqual };
