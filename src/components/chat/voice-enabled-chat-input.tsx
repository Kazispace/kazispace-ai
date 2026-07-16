'use client';

import { ChatInput } from '@/components/chat/chat-input';
import { useVoiceToChat } from '@/hooks/use-voice-to-chat';

/** Mirrors ChatInput `onSend` (single optional File attachment, not File[]). */
type ChatSendHandler = (message: string, attachment?: File) => void;

interface VoiceEnabledChatInputProps {
  onSend: ChatSendHandler;
  disabled?: boolean;
  placeholder?: string;
  onOpenAgents?: () => void;
  showAgentButton?: boolean;
  showAttachButton?: boolean;
  isUploading?: boolean;
  /** Optional gate before ASR (e.g. login redirect). */
  beforeTranscribe?: () => boolean | Promise<boolean>;
  /** POST /inputs `context_module` (e.g. `clinic`, `space:{id}`). */
  contextModule?: string;
}

/**
 * ChatInput with mic → /inputs ASR → text chat (KAZI-215 方案 B).
 * Mock-interview long-form audio must not use this path.
 */
export function VoiceEnabledChatInput({
  onSend,
  beforeTranscribe,
  contextModule,
  ...rest
}: VoiceEnabledChatInputProps) {
  const { handleSendAudio, isTranscribing } = useVoiceToChat({
    onSendText: (text) => onSend(text),
    beforeTranscribe,
    contextModule,
  });

  return (
    <ChatInput
      {...rest}
      onSend={onSend}
      onSendAudio={handleSendAudio}
      isTranscribing={isTranscribing}
      showMicButton
    />
  );
}
