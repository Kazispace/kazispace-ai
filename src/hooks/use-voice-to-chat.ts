'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { useUIStore } from '@/lib/store';
import {
  MAX_VOICE_RECORDING_SECONDS,
  transcribeVoice,
  type VoiceAsrErrorCode,
} from '@/lib/voice-input-api';

export interface UseVoiceToChatOptions {
  /** Send transcribed text via the same path as typed chat (no file_ids). */
  onSendText: (text: string) => void | Promise<void>;
  /**
   * Optional gate before ASR (e.g. login redirect).
   * Return false to abort without calling /inputs.
   */
  beforeTranscribe?: () => boolean | Promise<boolean>;
}

function voiceErrorMessage(
  t: ReturnType<typeof useTranslations<'spaces'>>,
  errorCode: string | undefined,
  fallback?: string,
): string {
  switch (errorCode as VoiceAsrErrorCode | undefined) {
    case 'EMPTY_TRANSCRIPTION':
    case 'ASR_FALLBACK':
      return t('voiceFallback');
    case 'TIMEOUT':
      return t('voiceTimeout');
    case 'TOO_LONG':
      return t('voiceTooLong', { seconds: MAX_VOICE_RECORDING_SECONDS });
    default:
      return fallback?.trim() || t('voiceUploadFailed');
  }
}

/**
 * Shared mic → POST /inputs (voice) → chat text path (KAZI-215 / 方案 B).
 * Does not send chat when ASR falls back or returns empty text.
 */
export function useVoiceToChat({
  onSendText,
  beforeTranscribe,
}: UseVoiceToChatOptions) {
  const t = useTranslations('spaces');
  const showToast = useUIStore((s) => s.showToast);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const inFlightRef = useRef(false);

  const handleSendAudio = useCallback(
    async (audioBlob: Blob) => {
      if (beforeTranscribe && !(await beforeTranscribe())) return;
      if (inFlightRef.current) return;

      inFlightRef.current = true;
      setIsTranscribing(true);
      try {
        const res = await transcribeVoice(audioBlob);
        if (!res.success || !res.data?.canonical_text?.trim()) {
          showToast(
            voiceErrorMessage(t, res.errorCode, res.error),
            'error',
          );
          return;
        }
        await onSendText(res.data.canonical_text.trim());
      } finally {
        inFlightRef.current = false;
        setIsTranscribing(false);
      }
    },
    [beforeTranscribe, onSendText, showToast, t],
  );

  return { handleSendAudio, isTranscribing };
}
