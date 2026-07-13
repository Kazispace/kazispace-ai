'use client';

import { type ReactNode, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { MessageBubble } from '@/components/clinic/message-bubble';
import { SpaceShell, type SpaceShellVariant } from '@/components/spaces/space-shell';
import { useSpaceTurn } from '@/hooks/use-space-turn';
import type { SpaceDetail } from '@/types/spaces';

type SpaceWelcomeKey = 'blankWelcome' | 'jobSprintWelcome' | 'ieltsWelcome';

export type SpaceComposerRenderProps = {
  sendMessage: (text: string) => Promise<{ ok: boolean; error?: string }>;
  isSending: boolean;
};

interface SpaceChatPaneProps {
  locale: string;
  space: SpaceDetail;
  welcomeKey?: SpaceWelcomeKey;
  shellVariant?: SpaceShellVariant;
  composer?:
    | ReactNode
    | ((ctx: SpaceComposerRenderProps) => ReactNode);
}

/** Shared space orchestrator chat column (POST /spaces/{id}/turn). */
export function SpaceChatPane({
  locale,
  space,
  welcomeKey = 'blankWelcome',
  shellVariant = 'page',
  composer,
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

  const composerNode =
    typeof composer === 'function'
      ? composer({ sendMessage, isSending })
      : composer;

  return (
    <SpaceShell
      locale={locale}
      space={space}
      variant={shellVariant}
      footer={composerNode ?? null}
    >
      <div className="mx-auto flex min-h-0 flex-1 flex-col gap-3">
        {isHydrating && messages.length === 0 ? (
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
              locale={locale}
              variant="clinic"
            />
          ))
        )}
        {sendError ? (
          <p className="text-center text-xs text-red-600">{sendError}</p>
        ) : null}
        <div ref={messagesEndRef} />
      </div>
    </SpaceShell>
  );
}
