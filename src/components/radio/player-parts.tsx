'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';

import type { PlayableSentence, PlayerSpeed } from '@/hooks/use-sentence-player';
import { cn } from '@/lib/utils';

/**
 * Captions (personal-radio.md, Player · Layout): every sentence of the part, the one being spoken
 * highlighted, the ones already played kept above it. The view follows the voice but stops following
 * for 5 s after the user scrolls it.
 */
export function Captions({
  sentences,
  activeIndex,
  playing,
}: {
  sentences: PlayableSentence[];
  activeIndex: number;
  playing: boolean;
}) {
  const t = useTranslations('radio.player');
  const listRef = useRef<HTMLOListElement | null>(null);
  const userScrolledAt = useRef(0);

  useEffect(() => {
    if (Date.now() - userScrolledAt.current < 5000) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [activeIndex]);

  return (
    <ol
      ref={listRef}
      aria-label={t('captions')}
      aria-live="polite"
      onWheel={() => (userScrolledAt.current = Date.now())}
      onTouchMove={() => (userScrolledAt.current = Date.now())}
      data-testid="radio-captions"
      className="flex flex-col gap-2"
    >
      {sentences.map((s, i) => (
        <li
          key={`${s.seq}-${i}`}
          data-index={i}
          aria-current={i === activeIndex && playing ? 'true' : undefined}
          className={cn(
            'rounded-lg px-3 py-2 text-base leading-relaxed transition-colors',
            i === activeIndex ? 'bg-primary/10 text-workspace-text' : i < activeIndex ? 'text-workspace-secondary' : 'text-workspace-muted'
          )}
        >
          {s.text}
          {s.pending && !s.audioUrl ? <span className="ml-1 text-workspace-muted">…</span> : null}
        </li>
      ))}
    </ol>
  );
}

/** Controls: play / pause, repeat the current sentence, speed 1× ⇄ 0.75× (pitch kept). */
export function PlayerControls({
  playing,
  disabled,
  speed,
  onPlay,
  onPause,
  onRepeat,
  onSpeed,
}: {
  playing: boolean;
  disabled?: boolean;
  speed: PlayerSpeed;
  onPlay: () => void;
  onPause: () => void;
  onRepeat: () => void;
  onSpeed: (s: PlayerSpeed) => void;
}) {
  const t = useTranslations('radio.player');
  const btn =
    'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-gray-200 bg-white px-3 text-sm hover:bg-gray-50 disabled:opacity-50';
  return (
    <div className="flex items-center justify-center gap-3" data-testid="radio-controls">
      <button type="button" className={btn} onClick={onRepeat} disabled={disabled} aria-label={t('repeat')}>
        <RotateCcw className="h-5 w-5" aria-hidden />
      </button>
      <button
        type="button"
        className={cn(btn, 'h-14 w-14 bg-primary text-white hover:bg-primary/90')}
        onClick={playing ? onPause : onPlay}
        disabled={disabled}
        aria-label={playing ? t('pause') : t('play')}
        data-testid="radio-play-pause"
      >
        {playing ? <Pause className="h-6 w-6" aria-hidden /> : <Play className="h-6 w-6" aria-hidden />}
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => onSpeed(speed === 1 ? 0.75 : 1)}
        disabled={disabled}
        data-testid="radio-speed"
      >
        {t('speed', { rate: speed === 1 ? '1×' : '0.75×' })}
      </button>
    </div>
  );
}

export function PlayerShell({
  back,
  title,
  children,
  footer,
}: {
  back: React.ReactNode;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col bg-white" data-testid="radio-player">
      <div className="mx-auto w-full max-w-2xl px-4 pt-2">{back}</div>
      <h1 className="mx-auto w-full max-w-2xl px-4 pb-2 text-lg font-semibold text-kazi-navy">{title}</h1>
      <main className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 pb-4">{children}</main>
      {footer ? <div className="mx-auto w-full max-w-2xl border-t border-gray-100 px-4 py-3">{footer}</div> : null}
    </div>
  );
}
