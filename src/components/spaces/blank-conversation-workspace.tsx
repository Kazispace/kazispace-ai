'use client';

import { useLocale, useTranslations } from 'next-intl';

import { ChatInput } from '@/components/chat/chat-input';
import { SpaceChatPane } from '@/components/spaces/space-chat-pane';
import { transcribeVoice } from '@/lib/voice-input-api';
import { isSpaceComposerMuted } from '@/lib/spaces/lifecycle';
import { useUIStore } from '@/lib/store';
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
            const res = await transcribeVoice(blob);
            if (!res.success || !res.data) {
              const msg = res.errorCode === 'EMPTY_TRANSCRIPTION'
                ? t('voiceEmpty')
                : (res.error ?? t('voiceUploadFailed'));
              useUIStore.getState().showToast(msg, 'error');
              return;
            }
            void sendMessage(res.data.canonical_text);
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
