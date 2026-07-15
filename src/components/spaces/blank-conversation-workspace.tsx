'use client';

import { useLocale, useTranslations } from 'next-intl';

import { ChatInput } from '@/components/chat/chat-input';
import { SpaceChatPane } from '@/components/spaces/space-chat-pane';
import { uploadFile } from '@/lib/file-api';
import { isSpaceComposerMuted } from '@/lib/spaces/lifecycle';
import type { SpaceDetail } from '@/types/spaces';

interface BlankConversationWorkspaceProps {
  space: SpaceDetail;
}

/** ADR-006 Phase B — 空白对话: chat composer only (no side panels). */
export function BlankConversationWorkspace({ space }: BlankConversationWorkspaceProps) {
  const locale = useLocale();
  const t = useTranslations('spaces');
  const muted = isSpaceComposerMuted(space.status);

  return (
    <SpaceChatPane
      locale={locale}
      space={space}
      welcomeKey="blankWelcome"
      composer={({ sendMessage, isSending, spaceSessionReady }) => (
        <ChatInput
          onSend={(text) => void sendMessage(text)}
          onSendAudio={async (blob) => {
            const file = new File([blob], `voice_${Date.now()}.webm`, { type: blob.type || 'audio/webm' });
            await uploadFile(file, 'documents', { spaceId: space.id });
            void sendMessage('[Voice message]');
          }}
          disabled={muted || isSending || !spaceSessionReady}
          placeholder={muted ? t('composerMuted') : t('composerPlaceholder')}
          showAttachButton
          showMicButton
        />
      )}
    />
  );
}
