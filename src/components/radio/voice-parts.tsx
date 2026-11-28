'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Loader2, Mic, MicOff } from 'lucide-react';

import type { RadioMicState } from '@/hooks/use-radio-mic';
import type { BlockedHelpPlatform } from '@/lib/radio/voice';
import { RADIO_ACCENT } from '@/lib/radio/theme';
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
  // KAZI-1512 (Personal radio 0.35, Microphone button · Look): round, 72px, with a 2px ring so its edge reaches
  // 3:1 against the page. Tap to talk: there is no press and hold.
  const ring = 'relative inline-flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full ring-2';

  if (state === 'recording') {
    const bars = Math.min(5, Math.round(level * 40));
    return (
      <div className="flex items-center justify-center gap-5" data-testid="radio-mic" data-state="recording">
        <button type="button" onClick={onCancel} data-testid="radio-mic-cancel" className="min-h-11 min-w-16 rounded-lg px-3 text-sm text-radio-secondary hover:bg-radio-surface-raised">
          {t('cancel')}
        </button>
        <span className={cn(ring, 'flex-col gap-1 bg-radio-recording text-radio-on-accent ring-radio-recording-ring')}>
          <Mic className="h-6 w-6" aria-hidden />
          <span className="flex h-3 items-end gap-0.5" aria-hidden data-testid="radio-mic-level">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={cn('w-1 rounded-sm bg-radio-on-accent transition-all', i < bars ? 'h-3' : 'h-1 opacity-50')} />
            ))}
          </span>
        </span>
        <button type="button" onClick={onDone} data-testid="radio-mic-done" className="min-h-11 min-w-16 rounded-lg px-3 text-sm font-medium text-radio-text hover:bg-radio-surface-raised">
          {t('done')}
        </button>
      </div>
    );
  }

  if (state === 'working') {
    // A working control is not a disabled one: full accent, spinner in on-accent (4.6:1 or more).
    return (
      <div className="flex flex-col items-center gap-1" data-testid="radio-mic" data-state="working">
        <span className={cn(ring, RADIO_ACCENT)} aria-busy="true">
          <Loader2 className="h-7 w-7 animate-spin text-radio-on-accent" aria-hidden />
        </span>
        {slow ? (
          <p className="text-xs text-radio-muted" data-testid="radio-slow">
            {tStates('slow')}
          </p>
        ) : null}
      </div>
    );
  }

  const unavailable = state === 'unavailable';
  return (
    <div className="flex flex-col items-center gap-2" data-testid="radio-mic" data-state={state}>
      {state === 'window' ? (
        <p className="text-sm text-radio-secondary" data-testid="radio-mic-listening">
          {t('listening', { count: choiceCount })}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onTap}
        disabled={disabled}
        aria-label={t('speak')}
        data-testid="radio-mic-button"
        className={cn(
          ring,
          unavailable ? 'bg-radio-surface-raised text-radio-muted ring-radio-surface-raised' : cn(RADIO_ACCENT, 'shadow-lg shadow-radio-accent-start/40 hover:opacity-90'),
          'disabled:opacity-40'
        )}
      >
        {state === 'window' && windowMs ? (
          <svg className="pointer-events-none absolute -inset-2 h-[88px] w-[88px] -rotate-90" viewBox="0 0 36 36" aria-hidden>
            <circle
              cx="18"
              cy="18"
              r="17"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeDasharray="106.8"
              className="radio-countdown text-radio-progress"
              style={{ animation: `radio-countdown ${windowMs}ms linear forwards` }}
            />
            <style>{'@keyframes radio-countdown{from{stroke-dashoffset:0}to{stroke-dashoffset:106.8}}'}</style>
          </svg>
        ) : null}
        {unavailable ? <MicOff className="h-7 w-7" aria-hidden /> : <Mic className="h-7 w-7" aria-hidden />}
      </button>
    </div>
  );
}

/** m:ss, for the listening indicator's running time. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Listening indicator (Voice · Listening indicator): text and a red dot, shown exactly while the microphone is
 * on — the app's own, required even where the system shows one. KAZI-1512 (Personal radio 0.35): a pill just
 * above the microphone button, in the recording colour, with the time so far counting up.
 */
export function ListeningIndicator({ on }: { on: boolean }) {
  const t = useTranslations('radio.mic');
  const [since, setSince] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!on) {
      setSince(null);
      return;
    }
    const start = Date.now();
    setSince(start);
    setNow(start);
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [on]);
  if (!on) return null;
  return (
    <div
      role="status"
      data-testid="radio-listening-indicator"
      className="flex items-center gap-2 self-center rounded-full bg-radio-recording px-3.5 py-1.5 text-sm font-medium text-radio-on-accent"
    >
      <span className="h-2 w-2 rounded-full bg-radio-on-accent" aria-hidden />
      {t('recording')}
      <span className="tabular-nums" data-testid="radio-listening-elapsed">
        {formatElapsed(since === null ? 0 : now - since)}
      </span>
    </div>
  );
}

/** Explain first, then ask (Microphone access): two buttons of equal weight, neither primary. */
export function ConsentCard({ onAllow, onDeny }: { onAllow: () => void; onDeny: () => void }) {
  const t = useTranslations('radio.consent');
  const btn = 'flex-1 rounded-lg border border-radio-surface-raised bg-radio-surface px-3 py-2 text-sm font-medium text-radio-text hover:bg-radio-surface-raised';
  return (
    <section data-testid="radio-consent" aria-labelledby="radio-consent-title" className="mt-4 rounded-xl border border-radio-surface-raised p-4">
      <h2 id="radio-consent-title" className="text-sm font-semibold text-radio-text">
        {t('title')}
      </h2>
      <p className="mt-1 text-sm text-radio-secondary">{t('body')}</p>
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
        className="w-full max-w-sm rounded-2xl bg-radio-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="radio-blocked-title" className="text-base font-semibold text-radio-text">
          {t('title')}
        </h2>
        <p className="mt-2 text-sm text-radio-secondary">{t('body')}</p>
        <p className="mt-3 rounded-lg bg-radio-surface-raised p-3 text-sm text-radio-text" data-testid="radio-blocked-steps">
          {t(platform)}
        </p>
        <button type="button" onClick={onClose} className="mt-4 w-full rounded-lg border border-radio-surface-raised px-3 py-2 text-sm">
          {tNotice('gotIt')}
        </button>
      </div>
    </div>
  );
}
