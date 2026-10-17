'use client';

import { memo } from 'react';

import { AssistantTurn } from '@/components/chat/assistant-turn';
import { MessageBubble } from '@/components/clinic/message-bubble';

export type HubListMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** User messages only: "failed" renders "Not sent" + "Try again" (D13). */
  status?: 'sending' | 'sent' | 'failed';
};

export type HubMessageRowProps = {
  message: HubListMessage;
  locale: string;
  isStreamingEmpty: boolean;
  onRetryById?: (messageId: string) => void;
};

function hubMessageRowEqual(
  prev: HubMessageRowProps,
  next: HubMessageRowProps
): boolean {
  return (
    prev.message === next.message &&
    prev.locale === next.locale &&
    prev.isStreamingEmpty === next.isStreamingEmpty &&
    prev.onRetryById === next.onRetryById
  );
}

function HubMessageRowImpl({
  message,
  locale,
  isStreamingEmpty,
  onRetryById,
}: HubMessageRowProps) {
  if (message.role === 'user') {
    return (
      <MessageBubble
        role="user"
        content={message.content}
        variant="agent"
        locale={locale}
        status={message.status}
        onRetry={
          message.status === 'failed' && onRetryById
            ? () => onRetryById(message.id)
            : undefined
        }
      />
    );
  }

  return (
    <AssistantTurn
      content={message.content}
      variant="agent"
      locale={locale}
      isStreaming={isStreamingEmpty}
    />
  );
}

export const HubMessageRow = memo(HubMessageRowImpl, hubMessageRowEqual);
