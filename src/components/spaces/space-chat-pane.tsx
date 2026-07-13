'use client';

import { type ReactNode, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';

import { ChatMessage } from '@/components/chat/chat-message';
import { useSpaceTurn } from '@/hooks/use-space-turn';
import type { SpaceDetail } from '@/types/spaces';

type SpaceWelcomeKey = 'blankWelcome' | 'jobSprintWelcome' | 'ieltsWelcome';

export type SpaceComposerRenderProps = {
  sendMessage: (text: string) => Promise<{ ok: boolean; error?: string }>;
  isSending: boolean;
};

interface SpaceChatPaneProps {
  space: SpaceDetail;
  welcomeKey?: SpaceWelcomeKey;
  composer?:
    | ReactNode
    | ((ctx: SpaceComposerRenderProps) => ReactNode);
  className?: string;
}

/** Shared space orchestrator chat column (POST /spaces/{id}/turn). */
export function SpaceChatPane({
  space,
  welcomeKey = 'blankWelcome',
  composer,
  className,
}: SpaceChatPaneProps) {
  const t = useTranslations('spaces');
  const { messages, isHydrating, isSending, sendError, sendMessage } = useSpaceTurn(
    space.id,
    space.master_session_id
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isSending]);

  if (isHydrating && messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[#86909C]">
        {t('loading')}
      </div>
    );
  }

  const composerNode =
    typeof composer === 'function'
      ? composer({ sendMessage, isSending })
      : composer;

  return (
    <div className={className ?? 'flex h-full min-h-0 flex-col bg-gray-bg'}>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#86909C]">{t(welcomeKey)}</p>
          ) : (
            messages.map((message) => (
              <ChatMessage
                key={message.id}
                role={message.role}
                content={message.content}
              />
            ))
          )}
          {sendError ? (
            <p className="text-center text-xs text-red-600">{sendError}</p>
          ) : null}
          <div ref={messagesEndRef} />
        </div>
      </div>
      {composerNode ?? null}
    </div>
  );
}
