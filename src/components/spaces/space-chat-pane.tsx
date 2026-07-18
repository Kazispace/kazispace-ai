'use client';

import { type ReactNode, useCallback } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { MessageBubble } from '@/components/clinic/message-bubble';
import { SpaceShell } from '@/components/spaces/space-shell';
import { useChatScroll } from '@/hooks/use-chat-scroll';
import {
  useSpaceTurn,
  type SpaceSendResult,
} from '@/hooks/use-space-turn';
import { spaceChatScrollStorageKey } from '@/lib/spaces/chat-scroll';
import type { SpaceDetail } from '@/types/spaces';
import { cn } from '@/lib/utils';

type SpaceWelcomeKey = 'blankWelcome' | 'jobSprintWelcome' | 'ieltsWelcome';

export type SpaceComposerRenderProps = {
  sendMessage: (text: string) => Promise<SpaceSendResult>;
  isSending: boolean;
  spaceSessionReady: boolean;
  /** True when the space thread has ≥1 user message (Starter collapse scheme A). */
  hasUserMessage: boolean;
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
    historyReady,
    isSending,
    replyNotice,
    sendMessage,
    retryMessage,
  } = useSpaceTurn(space.id, space.master_session_id, locale, space.space_state);

  // Defensive: BE should always bind master_session_id; empty means provision incomplete.
  const spaceSessionReady = Boolean(space.master_session_id?.trim());
  // Use mount-local historyReady — store !isHydrating is stale-false on remount first paint.
  const scrollReady = spaceSessionReady && historyReady;
  const hasUserMessage = messages.some((m) => m.role === 'user');

  const {
    scrollRef,
    showJumpToLatest,
    handleScroll,
    jumpToLatest,
    pinToLatestOnSend,
  } = useChatScroll({
    storageKey: spaceChatScrollStorageKey(space.id),
    messageCount: messages.length,
    isSending,
    ready: scrollReady,
  });

  const sendAndPin = useCallback(
    async (text: string) => {
      pinToLatestOnSend();
      return sendMessage(text);
    },
    [pinToLatestOnSend, sendMessage],
  );

  const composerNode =
    typeof composer === 'function'
      ? composer({
          sendMessage: sendAndPin,
          isSending,
          spaceSessionReady,
          hasUserMessage,
        })
      : composer;

  const handleRetryNotice = () => {
    if (!replyNotice?.retryMessageId) return;
    pinToLatestOnSend();
    void retryMessage(replyNotice.retryMessageId);
  };

  const jumpOverlay = showJumpToLatest ? (
    <button
      type="button"
      onClick={jumpToLatest}
      className={cn(
        'absolute bottom-3 left-1/2 z-20 flex h-10 w-10 -translate-x-1/2',
        'items-center justify-center rounded-full border border-gray-100 bg-white',
        'shadow-[0_2px_8px_rgba(0,0,0,0.12)] transition-opacity hover:bg-gray-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kazi-orange/40',
      )}
      aria-label={t('scrollToLatest')}
    >
      <ChevronDown className="h-5 w-5 text-[#1D2129]" strokeWidth={2} aria-hidden />
    </button>
  ) : null;

  return (
    <SpaceShell
      locale={locale}
      space={space}
      footer={composerNode ?? null}
      scrollRef={scrollRef}
      onScroll={handleScroll}
      scrollOverlay={jumpOverlay}
    >
      <div className="mx-auto flex w-full max-w-3xl min-h-0 flex-col gap-3">
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
              messageId={message.id}
              status={message.status}
              locale={locale}
              variant="clinic"
              surface="workspace"
              composerTarget="space"
              streamComplete
              onRetry={
                message.role === 'user' && message.status === 'failed'
                  ? () => {
                      pinToLatestOnSend();
                      void retryMessage(message.id);
                    }
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
      </div>
    </SpaceShell>
  );
}
