'use client';

import { useLocale, useTranslations } from 'next-intl';

import { ChatInput } from '@/components/chat/chat-input';
import { SpaceChatPane } from '@/components/spaces/space-chat-pane';
import type { SpaceDetail } from '@/types/spaces';

interface BlankConversationWorkspaceProps {
  space: SpaceDetail;
}

/** ADR-006 Phase B — 空白对话: chat composer only (no side panels). */
export function BlankConversationWorkspace({ space }: BlankConversationWorkspaceProps) {
  const locale = useLocale();
  const t = useTranslations('spaces');

  return (
    <SpaceChatPane
      locale={locale}
      space={space}
      welcomeKey="blankWelcome"
      composer={({ sendMessage, isSending }) => (
        <ChatInput
          onSend={(text) => void sendMessage(text)}
          disabled={isSending}
          placeholder={t('composerPlaceholder')}
        />
      )}
    />
  );
}
