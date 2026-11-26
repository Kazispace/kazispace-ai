'use client';

import { useTranslations } from 'next-intl';

import { VoiceEnabledChatInput } from '@/components/chat/voice-enabled-chat-input';
import {
  StarterCapabilityToolbar,
  StarterExampleStrip,
  useStarterPromptsController,
} from '@/components/spaces/starter-prompts-bar';
import type { SpaceSendResult } from '@/hooks/use-space-turn';
import { ENGLISH_SPACE_TEMPLATE_ID } from '@/lib/spaces/routes';
import type { SpaceDetail } from '@/types/spaces';

export interface SpaceComposerWithStarterProps {
  space: SpaceDetail;
  muted: boolean;
  sendMessage: (text: string) => Promise<SpaceSendResult>;
  isSending: boolean;
  spaceSessionReady: boolean;
  hasUserMessage: boolean;
  /** False when keep-alive hides this Space; a hidden Space never takes Exam's insert. */
  active?: boolean;
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
  active = true,
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
          // The English Space is Exam: it also takes Studio's Get started text (KAZI-1485), but
          // only while it is the Space on screen, so an older English Space kept alive in the
          // background cannot take it off-screen (#313 review).
          alsoAcceptsTarget={
            active && space.template_id === ENGLISH_SPACE_TEMPLATE_ID ? 'exam' : undefined
          }
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
