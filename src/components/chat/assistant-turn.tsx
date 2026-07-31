'use client';

import { MessageBubble } from '@/components/clinic/message-bubble';
import { ChatJobTeasers } from '@/components/clinic/chat-job-teasers';
import { ChatNextActions } from '@/components/clinic/chat-next-actions';
import { StrategySelectActions } from '@/components/clinic/strategy-select-actions';
import { isStrategySelectActions } from '@/lib/strategy-select';
import type { ChatJobCard, ChatNextAction } from '@/types/chat-envelope';

interface AssistantTurnProps {
  content: string;
  locale: string;
  variant?: 'clinic' | 'agent';
  nextActions?: ChatNextAction[];
  assistantMeta?: Record<string, unknown>;
  cards?: ChatJobCard[];
  streamComplete?: boolean;
  isStreaming?: boolean;
  onNextAction?: (action: ChatNextAction) => void;
  onJobCardClick?: (card: ChatJobCard) => void;
  actionsDisabled?: boolean;
}

/** §19 render order: bubble → CTAs → cards (workflow pinned separately via HubWorkflowStrip). */
export function AssistantTurn({
  content,
  locale,
  variant = 'agent',
  nextActions,
  cards,
  streamComplete = true,
  isStreaming,
  onNextAction,
  onJobCardClick,
  actionsDisabled,
}: AssistantTurnProps) {
  const jobCards = cards?.filter((c) => c.type === 'job') ?? [];
  const strategySelectActions = isStrategySelectActions(nextActions)
    ? nextActions
    : undefined;
  const genericNextActions =
    nextActions && !strategySelectActions ? nextActions : undefined;
  const showStrategySelect =
    streamComplete &&
    !isStreaming &&
    (strategySelectActions?.length ?? 0) > 0 &&
    onNextAction;
  const showActions =
    streamComplete &&
    !isStreaming &&
    (genericNextActions?.length ?? 0) > 0 &&
    onNextAction;
  const showCards = streamComplete && !isStreaming && jobCards.length > 0;

  return (
    <div className="flex w-full max-w-[92%] flex-col gap-2 self-center">
      <div className="flex w-full max-w-[85%] flex-col gap-2 self-start">
        <MessageBubble
          role="assistant"
          content={content}
          variant={variant}
          locale={locale}
          streamComplete={streamComplete}
          isStreaming={isStreaming}
        />

        {showStrategySelect ? (
          <StrategySelectActions
            actions={strategySelectActions!}
            locale={locale}
            onAction={onNextAction!}
            disabled={actionsDisabled}
          />
        ) : null}

        {showActions ? (
          <ChatNextActions
            actions={genericNextActions!}
            locale={locale}
            onAction={onNextAction!}
            disabled={actionsDisabled}
          />
        ) : null}
      </div>

      {showCards ? (
        <ChatJobTeasers
          cards={jobCards}
          locale={locale}
          onCardClick={onJobCardClick}
        />
      ) : null}
    </div>
  );
}
