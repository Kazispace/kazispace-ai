'use client';

import { useTranslations } from 'next-intl';

import { VoiceEnabledChatInput } from '@/components/chat/voice-enabled-chat-input';
import { StarterPromptsBar } from '@/components/spaces/starter-prompts-bar';
import type { SpaceSendResult } from '@/hooks/use-space-turn';
import type { SpaceDetail } from '@/types/spaces';

export interface SpaceComposerWithStarterProps {
  space: SpaceDetail;
  muted: boolean;
  sendMessage: (text: string) => Promise<SpaceSendResult>;
  isSending: boolean;
  spaceSessionReady: boolean;
  hasUserMessage: boolean;
}

/**
 * Shared Space footer: StarterPromptsBar + VoiceEnabledChatInput.
 * Used by blank + panels workspaces (PR #130 review P2).
 */
export function SpaceComposerWithStarter({
  space,
  muted,
  sendMessage,
  isSending,
  spaceSessionReady,
  hasUserMessage,
}: SpaceComposerWithStarterProps) {
  const t = useTranslations('spaces');
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
}
