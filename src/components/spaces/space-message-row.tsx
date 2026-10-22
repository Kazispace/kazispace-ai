'use client';

import { memo, useCallback } from 'react';

import { HistoryStubPlaceholder } from '@/components/chat/history-stub-placeholder';
import { MessageBubble } from '@/components/clinic/message-bubble';
import { isHistoryStub } from '@/lib/chat/history-window';
import type { StrategySelectTurnContext } from '@/lib/strategy-select';
import type { SpaceChatMessage } from '@/lib/spaces/turn';
import type { ChatJobCard, ChatNextAction } from '@/types/chat-envelope';
import type { ReplyFormSubmitHandler } from '@/lib/reply-form';
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
  /** ET and CV `meta.form` answers (KAZI-1041 / KAZI-1145). */
  onEtFormSubmit: ReplyFormSubmitHandler;
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
    prev.onEtFormSubmit === next.onEtFormSubmit &&
    prev.strategy.latestTurn === next.strategy.latestTurn &&
    prev.strategy.etFormPrefill === next.strategy.etFormPrefill &&
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
  onEtFormSubmit,
  onJobCardClick,
}: SpaceMessageRowProps) {
  const handleRetry = useCallback(() => {
    onRetryById(message.id);
  }, [message.id, onRetryById]);

  if (isHistoryStub(message)) {
    return <HistoryStubPlaceholder id={message.id} role={message.role} />;
  }

  return (
    <MessageBubble
      role={message.role}
      content={message.content}
      messageId={message.id}
      serverMessageId={message.serverMessageId}
      status={message.status}
      retryAt={message.retryAt}
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
      onEtFormSubmit={onEtFormSubmit}
      cvUploadEnabled={false}
      etFormActive={strategy.latestTurn === true}
      etFormPrefill={strategy.etFormPrefill}
      actionsDisabled={actionsDisabled}
      onRetry={
        message.role === 'user' &&
        (message.status === 'failed' || message.status === 'queued')
          ? handleRetry
          : undefined
      }
    />
  );
}

/** Memoized Space thread row — neighbor updates must not rerender this bubble. */
export const SpaceMessageRow = memo(SpaceMessageRowImpl, spaceMessageRowEqual);

export { spaceMessageRowEqual };
