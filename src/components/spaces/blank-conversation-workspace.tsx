'use client';

import { useLocale, useTranslations } from 'next-intl';

import { VoiceEnabledChatInput } from '@/components/chat/voice-enabled-chat-input';
import { SpaceChatPane } from '@/components/spaces/space-chat-pane';
import { StarterPromptsBar } from '@/components/spaces/starter-prompts-bar';
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
      composer={({ sendMessage, isSending, spaceSessionReady, hasUserMessage }) => {
        const inputDisabled = muted || isSending || !spaceSessionReady;
        return (
          <>
            <StarterPromptsBar
              spaceId={space.id}
              templateId={space.template_id}
              hasUserMessage={hasUserMessage}
              disabled={inputDisabled}
              onSendExample={(text) => void sendMessage(text)}
            />
            <VoiceEnabledChatInput
              onSend={(text) => void sendMessage(text)}
              contextModule={`space:${space.id}`}
              composerTarget="space"
              disabled={inputDisabled}
              placeholder={muted ? t('composerMuted') : t('composerPlaceholder')}
              showAttachButton
            />
          </>
        );
      }}
    />
  );
}
