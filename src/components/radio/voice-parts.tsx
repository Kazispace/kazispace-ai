'use client';

import { useTranslations } from 'next-intl';
import { Loader2, Mic, MicOff } from 'lucide-react';

import type { RadioMicState } from '@/hooks/use-radio-mic';
import type { BlockedHelpPlatform } from '@/lib/radio/voice';
import { cn } from '@/lib/utils';

/** What the microphone button shows (personal-radio.md, Voice · Microphone button). */
export type MicButtonState = 'ready' | 'window' | 'recording' | 'working' | 'unavailable';

export function micButtonState({
  mic,
  inFlight,
  unavailable,
}: {
  mic: RadioMicState;
  inFlight: boolean;
  unavailable: boolean;
}): MicButtonState {
  if (inFlight) return 'working';
  if (mic === 'window') return 'window';
  if (mic === 'recording' || mic === 'starting') return 'recording';
  return unavailable ? 'unavailable' : 'ready';
}

/**
 * The large round microphone control. Recording shows a live level meter with Done and Cancel;
 * Working shows a spinner and, after 10 seconds, `states.slow`; taps while working are ignored.
 */
export function MicButton({
  state,
  level,
  windowMs,
  choiceCount,
  slow,
  onTap,
  onDone,
  onCancel,
  disabled = false,
}: {
  /** KAZI-1242: the AI marker is playing and cannot be cut short; the button waits for it. */
  disabled?: boolean;
  state: MicButtonState;
  level: number;
  windowMs: number | null;
  choiceCount: number;
  slow: boolean;
  onTap: () => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('radio.mic');
  const tStates = useTranslations('states');
  const ring = 'relative inline-flex h-16 w-16 items-center justify-center rounded-full';

  if (state === 'recording') {
    const bars = Math.min(5, Math.round(level * 40));
    return (
      <div className="flex flex-col items-center gap-2" data-testid="radio-mic" data-state="recording">
        <div className="flex h-6 items-end gap-1" aria-hidden data-testid="radio-mic-level">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className={cn('w-1.5 rounded-sm bg-red-500 transition-all', i < bars ? 'h-6' : 'h-1.5 opacity-40')} />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onDone} data-testid="radio-mic-done" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">
            {t('done')}
          </button>
          <button type="button" onClick={onCancel} data-testid="radio-mic-cancel" className="rounded-lg border border-gray-300 px-4 py-2 text-sm">
            {t('cancel')}
          </button>
        </div>
      </div>
    );
  }

  if (state === 'working') {
    return (
      <div className="flex flex-col items-center gap-1" data-testid="radio-mic" data-state="working">
        <span className={cn(ring, 'bg-gray-100')} aria-busy="true">
          <Loader2 className="h-7 w-7 animate-spin text-workspace-muted" aria-hidden />
        </span>
        {slow ? (
          <p className="text-xs text-workspace-muted" data-testid="radio-slow">
            {tStates('slow')}
          </p>
        ) : null}
      </div>
    );
  }

  const unavailable = state === 'unavailable';
  return (
    <div className="flex flex-col items-center gap-1" data-testid="radio-mic" data-state={state}>
      <button
        type="button"
        onClick={onTap}
        disabled={disabled}
        aria-label={t('speak')}
        data-testid="radio-mic-button"
        className={cn(
          ring,
          unavailable ? 'border border-gray-300 bg-white text-workspace-muted' : 'bg-primary text-white hover:bg-primary/90',
          'disabled:opacity-40'
        )}
      >
        {state === 'window' && windowMs ? (
          <svg className="absolute inset-0 h-16 w-16 -rotate-90" viewBox="0 0 36 36" aria-hidden>
            <circle
              cx="18"
              cy="18"
              r="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="100.5"
              className="radio-countdown text-white/70"
              style={{ animation: `radio-countdown ${windowMs}ms linear forwards` }}
            />
            <style>{'@keyframes radio-countdown{from{stroke-dashoffset:0}to{stroke-dashoffset:100.5}}'}</style>
          </svg>
        ) : null}
        {unavailable ? <MicOff className="h-7 w-7" aria-hidden /> : <Mic className="h-7 w-7" aria-hidden />}
      </button>
      {state === 'window' ? (
        <p className="text-xs text-workspace-secondary" data-testid="radio-mic-listening">
          {t('listening', { count: choiceCount })}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Listening indicator (Voice · Listening indicator): fixed, text and a red dot, shown exactly while
 * the microphone is on — the app's own, required even where the system shows one.
 */
export function ListeningIndicator({ on }: { on: boolean }) {
  const t = useTranslations('radio.mic');
  if (!on) return null;
  return (
    <div
      role="status"
      data-testid="radio-listening-indicator"
      className="pointer-events-none fixed left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-gray-900/90 px-3 py-1.5 text-xs text-white shadow"
    >
      <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden />
      {t('recording')}
    </div>
  );
}

/** Explain first, then ask (Microphone access): two buttons of equal weight, neither primary. */
export function ConsentCard({ onAllow, onDeny }: { onAllow: () => void; onDeny: () => void }) {
  const t = useTranslations('radio.consent');
  const btn = 'flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-workspace-text hover:bg-gray-50';
  return (
    <section data-testid="radio-consent" aria-labelledby="radio-consent-title" className="mt-4 rounded-xl border border-gray-200 p-4">
      <h2 id="radio-consent-title" className="text-sm font-semibold text-workspace-text">
        {t('title')}
      </h2>
      <p className="mt-1 text-sm text-workspace-secondary">{t('body')}</p>
      <div className="mt-3 flex gap-2">
        <button type="button" className={btn} onClick={onAllow} data-testid="radio-consent-allow">
          {t('allow')}
        </button>
        <button type="button" className={btn} onClick={onDeny} data-testid="radio-consent-deny">
          {t('deny')}
        </button>
      </div>
    </section>
  );
}

/** The blocked-microphone help: only ever opened by the user's tap, never on its own. */
export function BlockedHelpDialog({ platform, onClose }: { platform: BlockedHelpPlatform; onClose: () => void }) {
  const t = useTranslations('radio.mic.blockedHelp');
  const tNotice = useTranslations('radio.notice');
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="radio-blocked-title"
        data-testid="radio-blocked-help"
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="radio-blocked-title" className="text-base font-semibold text-workspace-text">
          {t('title')}
        </h2>
        <p className="mt-2 text-sm text-workspace-secondary">{t('body')}</p>
        <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-workspace-text" data-testid="radio-blocked-steps">
          {t(platform)}
        </p>
        <button type="button" onClick={onClose} className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
          {tNotice('gotIt')}
        </button>
      </div>
    </div>
  );
}
