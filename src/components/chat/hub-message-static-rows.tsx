'use client';

import {
  HubMessageRow,
  type HubListMessage,
} from '@/components/chat/hub-message-row';

export type HubMessageListBodyProps = {
  messages: HubListMessage[];
  locale: string;
  isStreaming: boolean;
};

/** Shared map used by short hub threads and as the Virtuoso loading/failure fallback. */
export function StaticHubMessageRows({
  messages,
  locale,
  isStreaming,
}: HubMessageListBodyProps) {
  return (
    <>
      {messages.map((message) => (
        <HubMessageRow
          key={message.id}
          message={message}
          locale={locale}
          isStreamingEmpty={isStreaming && message.content === ''}
        />
      ))}
    </>
  );
}
