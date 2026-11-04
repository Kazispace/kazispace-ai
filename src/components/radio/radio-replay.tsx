'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

import { BackLink } from '@/components/navigation/back-link';
import { PlayerShell } from '@/components/radio/player-parts';
import { useAuthReady } from '@/hooks/use-auth-ready';
import { useRadioEvents } from '@/hooks/use-radio-events';
import { radioAccessOf } from '@/lib/radio/api';
import { trackRadioEvent } from '@/lib/radio/events';
import { getRadioReplay } from '@/lib/radio/player-api';
import { isRadioLocale, radioHomeHref } from '@/lib/radio/routes';
import { buildClinicHubHref } from '@/lib/hub-entry';
import { cn } from '@/lib/utils';
import type { RadioReplay } from '@/types/radio';

type Load = { state: 'loading' } | { state: 'ready'; replay: RadioReplay } | { state: 'missing' } | { state: 'error' };

/**
 * Replay (KAZI-1209 part 5; personal-radio.md, Replay · Data · Replay and deleting).
 *
 * Every step of a story, top to bottom, as the user heard it: the part's captions with a play button per
 * sentence (`radio.replay.play`), and the choice made (`radio.replay.youChose` with the letter heard, `chosen.key`;
 * the label alone when there is none), marked voice or tap. A step
 * taken back with "go back" stays, greyed, labelled `radio.replay.undone`. Replay is free, changes nothing
 * and never opens the microphone. `409 save_not_found` shows "content cannot be found".
 */
export function RadioReplayScreen({ locale, saveId }: { locale: string; saveId: string }) {
  const t = useTranslations('radio');
  const tStudio = useTranslations('studio');
  const tStates = useTranslations('states');
  const router = useRouter();
  const { ready, authenticated } = useAuthReady();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const routerRef = useRef(router);
  routerRef.current = router;
  const studioHref = buildClinicHubHref(locale);
  // The `replay` events this screen reports are sent while here and when it is left.
  useRadioEvents(ready && authenticated);

  useEffect(() => {
    if (!isRadioLocale(locale)) {
      routerRef.current.replace(studioHref);
      return;
    }
    if (!ready || !authenticated) return;
    let live = true;
    setLoad({ state: 'loading' });
    void getRadioReplay(saveId).then((res) => {
      if (!live) return;
      if (res.success && res.data) setLoad({ state: 'ready', replay: res.data });
      else if (radioAccessOf(res) === 'closed') routerRef.current.replace(studioHref);
      else if (res.status === 409) setLoad({ state: 'missing' });
      else setLoad({ state: 'error' });
    });
    return () => {
      live = false;
    };
  }, [locale, saveId, ready, authenticated, studioHref, attempt]);

  // Leaving stops the voice.
  useEffect(() => () => audioRef.current?.pause(), []);

  const play = (key: string, url: string, nodeId: string, seq: number) => {
    if (typeof Audio === 'undefined') return;
    const a = audioRef.current ?? new Audio();
    audioRef.current = a;
    if (playing === key && !a.paused) {
      a.pause();
      setPlaying(null);
      return;
    }
    a.src = url;
    a.onended = () => setPlaying(null);
    a.onerror = () => setPlaying(null);
    setPlaying(key);
    void a.play().catch(() => setPlaying(null));
    trackRadioEvent('replay', { saveId }, { node_id: nodeId, seq });
  };

  const back = <BackLink href={radioHomeHref(locale)} label={tStudio('sections.radio')} />;

  if (load.state === 'loading') {
    return (
      <PlayerShell back={back} title={t('replay.title')}>
        <div aria-busy="true" className="flex flex-col gap-2" data-testid="radio-replay-loading">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      </PlayerShell>
    );
  }
  if (load.state !== 'ready') {
    return (
      <PlayerShell back={back} title={t('replay.title')}>
        <div data-testid="radio-replay-missing" className="flex flex-col items-start gap-3 py-6">
          <p className="text-sm text-workspace-secondary">{load.state === 'missing' ? t('contentMissing') : t('offline')}</p>
          {load.state === 'error' ? (
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
              {tStates('retry')}
            </button>
          ) : (
            <Link href={radioHomeHref(locale)} className="text-sm text-primary underline">
              {t('summary.home')}
            </Link>
          )}
        </div>
      </PlayerShell>
    );
  }

  const { replay } = load;
  return (
    <PlayerShell back={back} title={replay.title ? `${t('replay.title')} · ${replay.title}` : t('replay.title')}>
      <ol className="flex flex-col gap-4" data-testid="radio-replay">
        {replay.steps.map((step) => (
          <li
            key={step.step}
            data-testid="radio-replay-step"
            data-undone={step.undone ? 'true' : undefined}
            className={cn('rounded-xl border border-gray-200 p-3', step.undone && 'opacity-50')}
          >
            {step.undone ? (
              <p className="mb-2 text-xs font-medium text-workspace-muted" data-testid="radio-replay-undone">
                {t('replay.undone')}
              </p>
            ) : null}
            <ul className="flex flex-col gap-1.5">
              {step.segments.map((seg) => {
                const key = `${step.step}:${seg.seq}`;
                return (
                  <li key={key} className="flex items-start gap-2">
                    {seg.audio_url ? (
                      <button
                        type="button"
                        onClick={() => play(key, seg.audio_url as string, step.node_id, seg.seq)}
                        aria-label={t('replay.play')}
                        data-testid="radio-replay-play"
                        className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-200 text-workspace-secondary hover:bg-gray-50"
                      >
                        {playing === key ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
                      </button>
                    ) : (
                      <span className="h-7 w-7 shrink-0" aria-hidden />
                    )}
                    <span className="text-sm leading-relaxed text-workspace-text">{seg.text}</span>
                  </li>
                );
              })}
            </ul>
            {step.chosen?.label ? (
              <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-workspace-secondary" data-testid="radio-replay-chosen">
                <span>
                  {step.chosen.key
                    ? t('replay.youChose', { key: step.chosen.key, label: step.chosen.label })
                    : // no letter (rare: the recorded part's choices could not be read) ⇒ the label alone
                      t('replay.youChose', { key: '', label: step.chosen.label }).replace(/\s+([：:])/, '$1')}
                </span>
                {step.chosen.via ? (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                    {step.chosen.via === 'voice' ? t('replay.viaVoice') : t('replay.viaTap')}
                  </span>
                ) : null}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </PlayerShell>
  );
}
