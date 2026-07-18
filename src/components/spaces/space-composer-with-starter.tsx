'use client';

import { useTranslations } from 'next-intl';

import { VoiceEnabledChatInput } from '@/components/chat/voice-enabled-chat-input';
import {
  StarterCapabilityToolbar,
  StarterExampleStrip,
  useStarterPromptsController,
} from '@/components/spaces/starter-prompts-bar';
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
 * Doubao-style Space footer:
 * - Column width matches chat messages (`max-w-3xl`)
 * - Compact examples above composer
 * - Capability chips inside the composer card
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
  const starter = useStarterPromptsController(
    space.id,
    space.template_id,
    hasUserMessage
  );

  return (
    <div className="bg-gray-bg px-4 pb-3 pt-2">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
        {starter?.hydrated ? (
          <StarterExampleStrip
            cfg={starter.cfg}
            panelId={starter.panelId}
            collapsed={starter.examplesCollapsed}
            disabled={inputDisabled}
            onToggleCollapsed={starter.setExamplesCollapsed}
            onSendExample={(text) => void sendMessage(text)}
          />
        ) : null}

        <VoiceEnabledChatInput
          onSend={(text) => void sendMessage(text)}
          contextModule={`space:${space.id}`}
          composerTarget="space"
          disabled={inputDisabled}
          placeholder={muted ? t('composerMuted') : t('composerPlaceholder')}
          showAttachButton
          variant="card"
          toolbar={
            starter?.hydrated ? (
              <StarterCapabilityToolbar
                cfg={starter.cfg}
                disabled={inputDisabled}
              />
            ) : null
          }
        />
      </div>
    </div>
  );
}
