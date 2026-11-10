'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useSentencePlayer, type PlayableSentence } from '@/hooks/use-sentence-player';
import { sendLiveEnd } from '@/lib/radio/live-api';
import { liveAudioElement, takeStartedLiveSession, type StartedLiveSession } from '@/lib/radio/live-session';
import { radioHomeHref } from '@/lib/radio/routes';
import { cn } from '@/lib/utils';
import type { LiveLang } from '@/types/radio-live';

/** A host line on screen: captions keep every line the host has said this session. */
export interface LiveCaption {
  key: string;
  text: string;
  lang?: LiveLang | null;
}

/** `lang` for a caption: Chinese lines in Chinese, English lines in English; a mix is left to the page. */
export function captionLang(lang: LiveLang | null | undefined): string | undefined {
  if (lang === 'en') return 'en';
  if (lang === 'zh') return 'zh';
  return undefined;
}

/**
 * The Live screen (KAZI-1287; kazispace-ui live-room.md, Screens and back · The Live screen).
 *
 * This part: the header (End, the host's name, the AI label), the captions, and the opening played
 * through the element the Start tap unlocked. Recording, answers, the English part and the end card
 * come in the next parts of KAZI-1287.
 *
 * Leaving ends the session: End, back, switching destination or closing the tab stop the voice at
 * once and send `POST end`, never waited for. Nothing asks "are you sure?".
 */
export function LiveScreen({ locale }: { locale: string }) {
  const router = useRouter();
  const homeHref = radioHomeHref(locale);
  // Taken once: a reload or a second screen gets nothing and goes back to the radio home, which ends
  // the session through `open_session_id`.
  const [started] = useState<StartedLiveSession | null>(() => takeStartedLiveSession());

  useEffect(() => {
    if (!started) router.replace(homeHref);
  }, [started, router, homeHref]);

  if (!started) return null;
  return <LiveSessionView started={started} homeHref={homeHref} />;
}

function LiveSessionView({ started, homeHref }: { started: StartedLiveSession; homeHref: string }) {
  const t = useTranslations('radio.live');
  const router = useRouter();
  const { session, host } = started;
  const sessionId = session.session_id;

  // Ending: once, whichever way the user leaves. `pagehide` because closing a tab never unmounts.
  const endedRef = useRef(false);
  useEffect(() => {
    const end = () => {
      if (endedRef.current) return;
      endedRef.current = true;
      sendLiveEnd(sessionId);
    };
    window.addEventListener('pagehide', end);
    return () => {
      window.removeEventListener('pagehide', end);
      end();
    };
  }, [sessionId]);

  const opening = useMemo(() => [...session.opening].sort((a, b) => a.seq - b.seq), [session.opening]);
  const sentences: PlayableSentence[] = useMemo(
    () => opening.map((s) => ({ seq: s.seq, text: s.text, audioUrl: s.audio_url ?? null, pending: s.pending ?? false })),
    [opening]
  );
  const captions: LiveCaption[] = useMemo(
    () => opening.map((s) => ({ key: `opening-${s.seq}`, text: s.text, lang: s.lang })),
    [opening]
  );
  const player = useSentencePlayer({ sentences, speed: 1, autoplay: true, element: liveAudioElement() });
  const playerRef = useRef(player);
  playerRef.current = player;
  // Lines played so far stay on screen; the one being spoken is highlighted.
  const shown = captions.slice(0, Math.min(captions.length, player.index + 1));

  const end = () => {
    // The voice stops in the same moment as the tap; the rest happens on unmount.
    playerRef.current.pause();
    router.replace(homeHref);
  };

  return (
    <div className="flex h-full flex-col bg-gray-50" data-testid="radio-live-screen">
      <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2">
        <button
          type="button"
          onClick={end}
          data-testid="radio-live-end"
          className="min-h-11 rounded-lg px-3 text-sm font-medium text-workspace-text hover:bg-gray-100"
        >
          {t('end')}
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
          <span className="truncate text-base font-semibold text-workspace-text" data-testid="radio-live-host-name">
            {host.name}
          </span>
          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-workspace-secondary" data-testid="radio-live-ai-label">
            {t('aiLabel')}
          </span>
        </div>
        {/* Keeps the host's name centred against End. */}
        <span className="min-w-11" aria-hidden />
      </header>
      {/* Announced once when the screen opens: "Warm host, AI host". */}
      <p className="sr-only" role="status" data-testid="radio-live-announce">
        {`${host.name}, ${t('aiLabel')}`}
      </p>
      <main className="flex-1 overflow-y-auto px-4 py-4">
        <ol className="mx-auto flex max-w-2xl flex-col gap-3" data-testid="radio-live-captions" aria-live="polite">
          {shown.map((c, i) => (
            <li
              key={c.key}
              lang={captionLang(c.lang)}
              data-testid="radio-live-caption"
              aria-current={i === player.index ? 'true' : undefined}
              className={cn(
                'rounded-xl px-3 py-2 text-base leading-relaxed',
                i === player.index ? 'bg-white font-medium text-workspace-text shadow-sm' : 'text-workspace-secondary'
              )}
            >
              {c.text}
            </li>
          ))}
        </ol>
      </main>
      <footer className="flex items-center justify-center gap-3 border-t border-gray-200 bg-white px-4 py-3">
        <button
          type="button"
          onClick={() => playerRef.current.repeat()}
          data-testid="radio-live-replay"
          className="min-h-11 rounded-lg border border-gray-300 px-4 text-sm"
        >
          {t('replay')}
        </button>
      </footer>
    </div>
  );
}
