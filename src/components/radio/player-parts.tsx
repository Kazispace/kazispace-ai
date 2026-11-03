'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';

import type { PlayableSentence, PlayerSpeed } from '@/hooks/use-sentence-player';
import { cn } from '@/lib/utils';

/** How long a press on a sentence must last to open its menu. */
export const LONG_PRESS_MS = 500;

/**
 * Captions (personal-radio.md, Player · Layout): every sentence of the part, the one being spoken
 * highlighted, the ones already played kept above it. The view follows the voice but stops following
 * for 5 s after the user scrolls it.
 *
 * With `onExplain`, a long press on a sentence (right-click on desktop, or the keyboard's menu key)
 * opens a menu with `radio.player.explain`: it asks the host to explain that sentence.
 */
export function Captions({
  sentences,
  activeIndex,
  playing,
  onExplain,
  explainDisabled,
}: {
  sentences: PlayableSentence[];
  activeIndex: number;
  playing: boolean;
  onExplain?: (index: number) => void;
  explainDisabled?: boolean;
}) {
  const t = useTranslations('radio.player');
  const tRadio = useTranslations('radio');
  const listRef = useRef<HTMLOListElement | null>(null);
  const userScrolledAt = useRef(0);
  const [menuAt, setMenuAt] = useState<number | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };
  useEffect(() => cancelPress, []);
  useEffect(() => setMenuAt(null), [sentences]);

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
          data-testid="radio-sentence"
          aria-current={i === activeIndex && playing ? 'true' : undefined}
          onPointerDown={
            onExplain
              ? (e) => {
                  if (e.pointerType === 'mouse' && e.button !== 0) return;
                  cancelPress();
                  pressTimer.current = setTimeout(() => setMenuAt(i), LONG_PRESS_MS);
                }
              : undefined
          }
          onPointerUp={onExplain ? cancelPress : undefined}
          onPointerLeave={onExplain ? cancelPress : undefined}
          onPointerCancel={onExplain ? cancelPress : undefined}
          onContextMenu={
            onExplain
              ? (e) => {
                  e.preventDefault();
                  cancelPress();
                  setMenuAt(i);
                }
              : undefined
          }
          className={cn(
            'select-none rounded-lg px-3 py-2 text-base leading-relaxed transition-colors [-webkit-touch-callout:none]',
            i === activeIndex ? 'bg-primary/10 text-workspace-text' : i < activeIndex ? 'text-workspace-secondary' : 'text-workspace-muted'
          )}
        >
          {s.text}
          {s.pending && !s.audioUrl ? <span className="ml-1 text-workspace-muted">…</span> : null}
          {onExplain && menuAt === i ? (
            <div role="menu" className="mt-2 flex gap-2" data-testid="radio-sentence-menu">
              <button
                type="button"
                role="menuitem"
                autoFocus
                disabled={explainDisabled}
                onClick={() => {
                  setMenuAt(null);
                  onExplain(i);
                }}
                data-testid="radio-explain"
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-workspace-text shadow-sm disabled:opacity-50"
              >
                {t('explain')}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => setMenuAt(null)}
                className="rounded-lg px-2 py-1.5 text-sm text-workspace-muted"
              >
                {tRadio('cancel')}
              </button>
            </div>
          ) : null}
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
