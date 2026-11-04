'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';

import { putRadioRating } from '@/lib/radio/player-api';
import { useUIStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { RADIO_RATING_REASONS, type RadioMyRating, type RadioRatingReason } from '@/types/radio';

const REASON_KEY: Record<RadioRatingReason, string> = {
  too_hard: 'tooHard',
  too_easy: 'tooEasy',
  boring: 'boring',
  voice: 'voice',
  en_ratio: 'enRatio',
};

type State = { rating: 'up' | 'down' | null; reasons: RadioRatingReason[] };

/**
 * Thumbs-up / thumbs-down on a whole story or program (KAZI-1255; kazispace-ui personal-radio.md 0.15, Rating).
 *
 * - Starts from `my_rating` (the replay for a story, `GET programs/{id}` for a program).
 * - Every tap saves at once, with the whole current state; tapping the selected button takes it back.
 * - After a thumbs-down, optional reason chips; switching to a thumbs-up clears them.
 * - A failed save puts the control back to what was saved and shows `radio.rating.failed`.
 * - Never required, never asks twice.
 */
export function RadioRating({
  kind,
  targetId,
  initial,
}: {
  kind: 'story' | 'program';
  targetId: string;
  initial: RadioMyRating | null | undefined;
}) {
  const t = useTranslations('radio.rating');
  const showToast = useUIStore((s) => s.showToast);
  const [state, setState] = useState<State>({ rating: initial?.rating ?? null, reasons: initial?.reasons ?? [] });
  const [rated, setRated] = useState(false);
  const saved = useRef<State>(state);
  const seq = useRef(0);

  // `initial` arrives after the first render (the replay or the program is still loading).
  useEffect(() => {
    if (seq.current > 0) return; // the user has already acted: keep what they did
    const next = { rating: initial?.rating ?? null, reasons: initial?.reasons ?? [] };
    saved.current = next;
    setState(next);
  }, [initial?.rating, initial?.reasons]);

  const save = async (next: State) => {
    const mine = ++seq.current;
    const ratedBefore = rated;
    setState(next);
    setRated(next.rating !== null);
    const res = await putRadioRating(kind, targetId, next.rating, next.rating === 'down' ? next.reasons : []);
    if (mine !== seq.current) return; // a newer tap has been sent since
    if (res.success && res.data) {
      saved.current = { rating: res.data.rating, reasons: res.data.reasons ?? [] };
      setState(saved.current);
    } else {
      setState(saved.current);
      setRated(ratedBefore);
      showToast(t('failed'));
    }
  };

  const tap = (rating: 'up' | 'down') =>
    void save(state.rating === rating ? { rating: null, reasons: [] } : { rating, reasons: rating === 'down' ? state.reasons : [] });
  const toggleReason = (r: RadioRatingReason) =>
    void save({
      rating: 'down',
      reasons: state.reasons.includes(r)
        ? state.reasons.filter((x) => x !== r)
        : RADIO_RATING_REASONS.filter((x) => x === r || state.reasons.includes(x)),
    });

  const btn = (on: boolean) =>
    cn(
      'inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2 text-sm',
      on ? 'border-primary bg-primary/5 text-workspace-text' : 'border-gray-300 text-workspace-secondary hover:border-gray-400'
    );
  return (
    <section className="mt-4" data-testid="radio-rating" data-kind={kind}>
      <p className="text-sm font-medium text-workspace-text" data-testid="radio-rating-prompt">
        {rated ? t('thanks') : t('question')}
      </p>
      <div className="mt-2 flex gap-2">
        <button type="button" aria-pressed={state.rating === 'up'} onClick={() => tap('up')} className={btn(state.rating === 'up')} data-testid="radio-rating-up">
          <ThumbsUp className="h-4 w-4" aria-hidden />
          {t('up')}
        </button>
        <button type="button" aria-pressed={state.rating === 'down'} onClick={() => tap('down')} className={btn(state.rating === 'down')} data-testid="radio-rating-down">
          <ThumbsDown className="h-4 w-4" aria-hidden />
          {t('down')}
        </button>
      </div>
      {state.rating === 'down' ? (
        <div className="mt-3" data-testid="radio-rating-reasons">
          <p className="text-xs text-workspace-secondary">{t('reasonsTitle')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {RADIO_RATING_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={state.reasons.includes(r)}
                onClick={() => toggleReason(r)}
                data-reason={r}
                className={cn(
                  'min-h-9 rounded-full border px-3 py-1 text-xs',
                  state.reasons.includes(r) ? 'border-primary bg-primary/5 text-workspace-text' : 'border-gray-200 text-workspace-secondary'
                )}
              >
                {t(`reason.${REASON_KEY[r]}`)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
