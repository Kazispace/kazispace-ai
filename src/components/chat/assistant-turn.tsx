'use client';

import { MessageBubble } from '@/components/clinic/message-bubble';
import { ChatJobTeasers } from '@/components/clinic/chat-job-teasers';
import { ChatNextActions } from '@/components/clinic/chat-next-actions';
import type { ChatJobCard, ChatNextAction } from '@/types/chat-envelope';

interface AssistantTurnProps {
  content: string;
  locale: string;
  variant?: 'clinic' | 'agent';
  nextActions?: ChatNextAction[];
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
  const showActions =
    streamComplete &&
    !isStreaming &&
    (nextActions?.length ?? 0) > 0 &&
    onNextAction;
  const showCards = streamComplete && !isStreaming && jobCards.length > 0;

  return (
    <div className="flex flex-col gap-2 self-start max-w-[78%] w-full">
      <MessageBubble
        role="assistant"
        content={content}
        variant={variant}
        locale={locale}
        streamComplete={streamComplete}
        isStreaming={isStreaming}
      />

      {showActions ? (
        <ChatNextActions
          actions={nextActions!}
          locale={locale}
          onAction={onNextAction!}
          disabled={actionsDisabled}
        />
      ) : null}

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
