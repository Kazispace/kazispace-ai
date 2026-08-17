'use client';

import { memo } from 'react';

import { AssistantTurn } from '@/components/chat/assistant-turn';
import { MessageBubble } from '@/components/clinic/message-bubble';

export type HubListMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export type HubMessageRowProps = {
  message: HubListMessage;
  locale: string;
  isStreamingEmpty: boolean;
};

function hubMessageRowEqual(
  prev: HubMessageRowProps,
  next: HubMessageRowProps
): boolean {
  return (
    prev.message === next.message &&
    prev.locale === next.locale &&
    prev.isStreamingEmpty === next.isStreamingEmpty
  );
}

function HubMessageRowImpl({
  message,
  locale,
  isStreamingEmpty,
}: HubMessageRowProps) {
  if (message.role === 'user') {
    return (
      <MessageBubble
        role="user"
        content={message.content}
        variant="agent"
        locale={locale}
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
