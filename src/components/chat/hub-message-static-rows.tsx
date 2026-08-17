'use client';

import type { ReactNode } from 'react';

import {
  HubMessageRow,
  type HubListMessage,
} from '@/components/chat/hub-message-row';

/** Interview/English message column. Workflow strip stays full-bleed above this box. */
export const HUB_CHAT_COLUMN_CLASS =
  'flex-1 p-4 flex flex-col gap-3 max-w-3xl mx-auto w-full';

/** Feedback / error chrome after the list — same width, not a second flex-1 region. */
export const HUB_CHAT_TRAILING_COLUMN_CLASS =
  'px-4 pb-4 flex flex-col gap-3 max-w-3xl mx-auto w-full';

export type HubMessageListBodyProps = {
  messages: HubListMessage[];
  locale: string;
  isStreaming: boolean;
  /**
   * Full-bleed content above the rows (Interview workflow strip).
   * Static fallback paints it first; Virtuoso measures it as `components.Header`.
   */
  header?: ReactNode;
};

/** Shared map used by short hub threads and as the Virtuoso loading/failure fallback. */
export function StaticHubMessageRows({
  messages,
  locale,
  isStreaming,
  header,
}: HubMessageListBodyProps) {
  const rows = messages.map((message) => (
    <HubMessageRow
      key={message.id}
      message={message}
      locale={locale}
      isStreamingEmpty={isStreaming && message.content === ''}
    />
  ));

  if (!header) {
    return <>{rows}</>;
  }

  return (
    <>
      {header}
      <div className={HUB_CHAT_COLUMN_CLASS}>{rows}</div>
    </>
  );
}
