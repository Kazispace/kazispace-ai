'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { newRadioRequestId, startRadioStory } from '@/lib/radio/api';
import { trackRadioEvent } from '@/lib/radio/events';
import { getRadioSaves } from '@/lib/radio/player-api';
import { radioHomeHref, radioReplayHref, radioStoryHref } from '@/lib/radio/routes';
import type { RadioGlossaryItem, RadioHome, RadioStorySummary } from '@/types/radio';

/** Ending summary · Phrases: up to 8. */
export const SUMMARY_PHRASES_MAX = 8;

/** A story at the listener's level that they have not heard (no save of it, in progress or listened). */
export function nextStory(home: RadioHome | null, heard: Set<string>): RadioStorySummary | null {
  if (!home) return null;
  return (home.stories ?? []).find((s) => s.base_cefr === home.profile?.band && !heard.has(s.story_id)) ?? null;
}

/**
 * The ending summary card (KAZI-1209 part 5; personal-radio.md, Ending summary).
 *
 * - Phrases: up to 8 key phrases heard in this story, each opening its meaning.
 * - Next: a story at the same level the user has not heard; starting it is a new start (a new request id).
 * - Buttons: `radio.summary.replay` · `radio.summary.next` · `radio.summary.home`.
 * - No quiz, no score, no stars: the radio cannot measure understanding, so it does not report it.
 * - Reports `radio_summary_shown` once (`glossary_count`, `recommended_story_id`).
 *
 * The ending's name and the user's own questions are not in the contract yet, so those two parts are
 * not shown (KAZI-1209 PR notes).
 */
export function EndingSummary({
  locale,
  saveId,
  glossary,
  home,
}: {
  locale: string;
  saveId: string;
  glossary: RadioGlossaryItem[];
  home: RadioHome | null;
}) {
  const t = useTranslations('radio.summary');
  const router = useRouter();
  const [heard, setHeard] = useState<Set<string> | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const reported = useRef(false);
  const phrases = glossary.slice(0, SUMMARY_PHRASES_MAX);

  useEffect(() => {
    let live = true;
    void getRadioSaves().then((res) => {
      if (!live) return;
      const ids = new Set<string>();
      for (const s of (res.success && res.data ? res.data.saves : []) ?? []) if (s.story_id) ids.add(s.story_id);
      for (const s of home?.continue_listening ?? []) if (s.story_id) ids.add(s.story_id);
      setHeard(ids);
    });
    return () => {
      live = false;
    };
  }, [home]);

  const next = heard ? nextStory(home, heard) : null;

  useEffect(() => {
    if (heard === null || reported.current) return;
    reported.current = true;
    trackRadioEvent('radio_summary_shown', { saveId }, {
      glossary_count: phrases.length,
      recommended_story_id: next?.story_id ?? null,
    });
  }, [heard, next, phrases.length, saveId]);

  const startNext = async () => {
    if (!next || starting) return;
    setStarting(true);
    const res = await startRadioStory(next.story_id, newRadioRequestId('start'));
    setStarting(false);
    // Started ⇒ the player; anything else (save limit, a notice, a failure) ⇒ the radio home, which says why.
    router.push(res.success && res.data?.save_id ? radioStoryHref(locale, res.data.save_id) : radioHomeHref(locale));
  };

  const btn = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm';
  return (
    <section className="mt-6 rounded-xl border border-gray-200 p-4" data-testid="radio-ending">
      {phrases.length ? (
        <div>
          <h2 className="text-sm font-semibold text-workspace-text">{t('phrases')}</h2>
          <ul className="mt-2 flex flex-wrap gap-2" data-testid="radio-summary-phrases">
            {phrases.map((g) => (
              <li key={g.term}>
                <button
                  type="button"
                  onClick={() => setOpen(open === g.term ? null : g.term)}
                  aria-expanded={open === g.term}
                  className="rounded-full border border-gray-200 px-3 py-1 text-sm hover:border-primary"
                >
                  {g.term}
                </button>
              </li>
            ))}
          </ul>
          {open ? (
            <p className="mt-2 text-sm text-workspace-secondary" data-testid="radio-summary-meaning">
              {phrases.find((g) => g.term === open)?.gloss ?? ''}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={radioReplayHref(locale, saveId)} className={btn} data-testid="radio-summary-replay">
          {t('replay')}
        </Link>
        {next ? (
          <button type="button" onClick={() => void startNext()} disabled={starting} className={btn} data-testid="radio-summary-next">
            {starting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {t('next')}
          </button>
        ) : null}
        <Link href={radioHomeHref(locale)} className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white" data-testid="radio-summary-home">
          {t('home')}
        </Link>
      </div>
    </section>
  );
}
