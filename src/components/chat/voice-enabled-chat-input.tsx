'use client';

import { ChatInput } from '@/components/chat/chat-input';
import { useVoiceToChat } from '@/hooks/use-voice-to-chat';

interface VoiceEnabledChatInputProps {
  onSend: (message: string, attachment?: File) => void;
  disabled?: boolean;
  placeholder?: string;
  onOpenAgents?: () => void;
  showAgentButton?: boolean;
  showAttachButton?: boolean;
  isUploading?: boolean;
  /** Optional gate before ASR (e.g. login redirect). */
  beforeTranscribe?: () => boolean | Promise<boolean>;
}

/**
 * ChatInput with mic → /inputs ASR → text chat (KAZI-215 方案 B).
 * Mock-interview long-form audio must not use this path.
 */
export function VoiceEnabledChatInput({
  onSend,
  beforeTranscribe,
  ...rest
}: VoiceEnabledChatInputProps) {
  const { handleSendAudio, isTranscribing } = useVoiceToChat({
    onSendText: (text) => onSend(text),
    beforeTranscribe,
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
