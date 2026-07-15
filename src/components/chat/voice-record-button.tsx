'use client';

import { useCallback, useRef, useState } from 'react';
import { Mic, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { cn } from '@/lib/utils';

interface VoiceRecordButtonProps {
  onRecordComplete: (audioBlob: Blob) => void;
  disabled?: boolean;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function WaveformBars({ level }: { level: number }) {
  const bars = 20;
  // Derive heights from level only — no Math.random() in render (avoids flicker on duration re-renders)
  return (
    <div className="flex items-center justify-center gap-[2px] h-10">
      {Array.from({ length: bars }).map((_, i) => {
        const center = bars / 2;
        const dist = Math.abs(i - center) / center;
        const wave = Math.sin(i * 0.9 + level * 12) * 0.15 + 0.85;
        const h = Math.max(4, (1 - dist * 0.5) * level * 40 * wave);
        return (
          <div
            key={i}
            className="w-[3px] rounded-full bg-kazi-orange transition-[height] duration-75"
            style={{ height: `${h}px` }}
          />
        );
      })}
    </div>
  );
}

const CANCEL_THRESHOLD_Y = -60;

export function VoiceRecordButton({
  onRecordComplete,
  disabled,
}: VoiceRecordButtonProps) {
  const t = useTranslations('spaces');
  const {
    isRecording,
    duration,
    audioLevel,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useVoiceRecorder();

  const [isCancelling, setIsCancelling] = useState(false);
  const touchStartY = useRef(0);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;
      touchStartY.current = e.touches[0].clientY;
      setIsCancelling(false);
      void startRecording();
    },
    [disabled, startRecording]
  );

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const dy = e.touches[0].clientY - touchStartY.current;
    setIsCancelling(dy < CANCEL_THRESHOLD_Y);
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (!isRecording) return;
    if (isCancelling) {
      cancelRecording();
      setIsCancelling(false);
      return;
    }
    const blob = await stopRecording();
    if (blob) onRecordComplete(blob);
    setIsCancelling(false);
  }, [isRecording, isCancelling, cancelRecording, stopRecording, onRecordComplete]);

  const handleMouseDown = useCallback(() => {
    if (disabled) return;
    setIsCancelling(false);
    void startRecording();
  }, [disabled, startRecording]);

  const handleMouseUp = useCallback(async () => {
    if (!isRecording) return;
    const blob = await stopRecording();
    if (blob) onRecordComplete(blob);
  }, [isRecording, stopRecording, onRecordComplete]);

  if (error === 'microphone_denied') {
    return (
      <button
        type="button"
        disabled
        className="h-10 w-10 shrink-0 rounded-full bg-red-50 text-red-400"
        aria-label="Microphone access denied"
      >
        <Mic className="mx-auto h-5 w-5" />
      </button>
    );
  }

  if (isRecording) {
    return (
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 z-50 flex flex-col items-center gap-3 rounded-t-2xl px-6 pb-6 pt-4 transition-colors',
          isCancelling ? 'bg-red-50' : 'bg-white'
        )}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => void handleTouchEnd()}
        onMouseUp={() => void handleMouseUp()}
      >
        <p
          className={cn(
            'text-xs font-medium',
            isCancelling ? 'text-red-500' : 'text-kazi-orange'
          )}
        >
          {isCancelling ? t('releaseToCancel') : t('releaseToSend')}
        </p>

        <WaveformBars level={audioLevel} />

        <p className="text-lg font-semibold tabular-nums text-[#1D2129]">
          {formatDuration(duration)}
        </p>

        {isCancelling ? (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white">
            <X className="h-6 w-6" />
          </div>
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-kazi-orange text-white animate-pulse">
            <Mic className="h-6 w-6" />
          </div>
        )}

        <p className="text-xs text-[#86909C]">{t('slideToCancelHint')}</p>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onTouchStart={handleTouchStart}
      onMouseDown={handleMouseDown}
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#86909C]',
        'hover:bg-orange-50 hover:text-kazi-orange transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed'
      )}
      aria-label={t('holdToTalk')}
    >
      <Mic className="h-5 w-5" />
    </button>
  );
}
