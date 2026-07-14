'use client';

import { type ReactNode, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { MessageBubble } from '@/components/clinic/message-bubble';
import { SpaceShell } from '@/components/spaces/space-shell';
import {
  useSpaceTurn,
  type SpaceSendResult,
} from '@/hooks/use-space-turn';
import type { SpaceDetail } from '@/types/spaces';
import { cn } from '@/lib/utils';

type SpaceWelcomeKey = 'blankWelcome' | 'jobSprintWelcome' | 'ieltsWelcome';

export type SpaceComposerRenderProps = {
  sendMessage: (text: string) => Promise<SpaceSendResult>;
  isSending: boolean;
  spaceSessionReady: boolean;
};

interface SpaceChatPaneProps {
  locale: string;
  space: SpaceDetail;
  welcomeKey?: SpaceWelcomeKey;
  composer?:
    | ReactNode
    | ((ctx: SpaceComposerRenderProps) => ReactNode);
}

/** Shared space orchestrator chat column (POST /spaces/{id}/turn). */
export function SpaceChatPane({
  locale,
  space,
  welcomeKey = 'blankWelcome',
  composer,
}: SpaceChatPaneProps) {
  const t = useTranslations('spaces');
  const tChat = useTranslations('chat');
  const {
    messages,
    isHydrating,
    isSending,
    replyNotice,
    sendMessage,
    retryMessage,
  } = useSpaceTurn(space.id, space.master_session_id, locale);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Defensive: BE should always bind master_session_id; empty means provision incomplete.
  const spaceSessionReady = Boolean(space.master_session_id?.trim());

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isSending]);

  const composerNode =
    typeof composer === 'function'
      ? composer({ sendMessage, isSending, spaceSessionReady })
      : composer;

  const handleRetryNotice = () => {
    if (!replyNotice?.retryMessageId) return;
    void retryMessage(replyNotice.retryMessageId);
  };

  return (
    <SpaceShell
      locale={locale}
      space={space}
      footer={composerNode ?? null}
    >
      <div className="mx-auto flex w-full max-w-3xl min-h-0 flex-1 flex-col gap-3">
        {!spaceSessionReady ? (
          <p className="py-8 text-center text-sm text-red-600">{t('spaceNotReady')}</p>
        ) : isHydrating && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin text-kazi-orange" aria-hidden />
            <p className="text-sm">{t('loading')}</p>
          </div>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#86909C]">{t(welcomeKey)}</p>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              role={message.role}
              content={message.content}
              status={message.status}
              locale={locale}
              variant="clinic"
              streamComplete
              onRetry={
                message.role === 'user' && message.status === 'failed'
                  ? () => void retryMessage(message.id)
                  : undefined
              }
            />
          ))
        )}
        {isSending ? (
          <MessageBubble
            role="assistant"
            content=""
            locale={locale}
            variant="clinic"
            isStreaming
            streamComplete={false}
          />
        ) : null}
        {replyNotice ? (
          <div className="flex flex-col items-center gap-1">
            <p
              className={cn(
                'text-center text-xs',
                replyNotice.kind === 'pending' ? 'text-[#86909C]' : 'text-red-600'
              )}
            >
              {replyNotice.message}
            </p>
            {replyNotice.retryable && replyNotice.retryMessageId ? (
              <button
                type="button"
                onClick={handleRetryNotice}
                disabled={isSending}
                className="text-xs text-red-600 underline-offset-2 hover:underline disabled:opacity-50"
              >
                {tChat('retry')}
              </button>
            ) : null}
          </div>
        ) : null}
        <div ref={messagesEndRef} />
      </div>
    </SpaceShell>
  );
}
