'use client';

import { MessageBubble } from '@/components/clinic/message-bubble';
import { ChatJobTeasers } from '@/components/clinic/chat-job-teasers';
import { ChatNextActions } from '@/components/clinic/chat-next-actions';
import { WorkflowTrack } from '@/components/chat/workflow-track';
import type { AssistantWorkflow, ChatJobCard, ChatNextAction } from '@/types/chat-envelope';

interface AssistantTurnProps {
  role: 'user' | 'assistant';
  content: string;
  locale: string;
  variant?: 'clinic' | 'agent';
  workflow?: AssistantWorkflow;
  nextActions?: ChatNextAction[];
  cards?: ChatJobCard[];
  streamComplete?: boolean;
  isStreaming?: boolean;
  onNextAction?: (action: ChatNextAction) => void;
  onJobCardClick?: (card: ChatJobCard) => void;
  actionsDisabled?: boolean;
  /** §19 render order: bubble → workflow → actions → cards */
  enrichmentLayout?: 'inline' | 'below';
}

export function AssistantTurn({
  role,
  content,
  locale,
  variant = 'agent',
  workflow,
  nextActions,
  cards,
  streamComplete = true,
  isStreaming,
  onNextAction,
  onJobCardClick,
  actionsDisabled,
  enrichmentLayout = 'below',
}: AssistantTurnProps) {
  const isUser = role === 'user';
  const showBelow = !isUser && enrichmentLayout === 'below';
  const jobCards = cards?.filter((c) => c.type === 'job') ?? [];
  const showActions =
    !isUser &&
    streamComplete &&
    !isStreaming &&
    (nextActions?.length ?? 0) > 0 &&
    onNextAction;
  const showCards =
    !isUser && streamComplete && !isStreaming && jobCards.length > 0;

  if (isUser) {
    return (
      <MessageBubble
        role="user"
        content={content}
        variant={variant}
        locale={locale}
        streamComplete={streamComplete}
        isStreaming={isStreaming}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2 self-start max-w-[78%] w-full">
      <MessageBubble
        role={role}
        content={content}
        variant={variant}
        locale={locale}
        streamComplete={streamComplete}
        isStreaming={isStreaming}
        nextActions={showBelow ? undefined : nextActions}
        cards={showBelow ? undefined : cards}
        onNextAction={showBelow ? undefined : onNextAction}
        onJobCardClick={showBelow ? undefined : onJobCardClick}
        actionsDisabled={actionsDisabled}
      />

      {showBelow && workflow ? (
        <WorkflowTrack workflow={workflow} locale={locale} className="self-start" />
      ) : null}

      {showBelow && showActions ? (
        <ChatNextActions
          actions={nextActions!}
          locale={locale}
          onAction={onNextAction!}
          disabled={actionsDisabled}
        />
      ) : null}

      {showBelow && showCards ? (
        <ChatJobTeasers
          cards={jobCards}
          locale={locale}
          onCardClick={onJobCardClick}
        />
      ) : null}
    </div>
  );
}
