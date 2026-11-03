'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';

import { BackLink } from '@/components/navigation/back-link';
import { Captions, PlayerControls, PlayerShell } from '@/components/radio/player-parts';
import { useAuthReady } from '@/hooks/use-auth-ready';
import { useSentencePlayer, type PlayableSentence, type PlayerSpeed } from '@/hooks/use-sentence-player';
import { getRadioProgram, radioAccessOf } from '@/lib/radio/api';
import { isRadioLocale, radioHomeHref } from '@/lib/radio/routes';
import { buildClinicHubHref } from '@/lib/hub-entry';
import type { RadioProgramDetail } from '@/types/radio';

type Load = { state: 'loading' } | { state: 'ready'; program: RadioProgramDetail } | { state: 'missing' } | { state: 'error' };

/**
 * A program in the player (KAZI-1209; personal-radio.md, Player · Programs · A program).
 *
 * `GET /programs/{id}` answers the version nearest the listener's level, in the listener's voice
 * (KAZI-1248), with signed sentence audio. No choice cards. A program that does not exist or has no
 * version (409) shows "content cannot be found". Asking a question in a program is a follow-up part.
 */
export function ProgramPlayerScreen({ locale, programId }: { locale: string; programId: string }) {
  const t = useTranslations('radio');
  const tStudio = useTranslations('studio');
  const tStates = useTranslations('states');
  const router = useRouter();
  const { ready, authenticated } = useAuthReady();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [speed, setSpeed] = useState<PlayerSpeed>(1);
  const [attempt, setAttempt] = useState(0);
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    if (!isRadioLocale(locale)) {
      routerRef.current.replace(buildClinicHubHref(locale));
      return;
    }
    if (!ready || !authenticated) return;
    let live = true;
    setLoad({ state: 'loading' });
    void getRadioProgram(programId).then((res) => {
      if (!live) return;
      if (res.success && res.data) setLoad({ state: 'ready', program: res.data });
      else if (radioAccessOf(res) === 'closed') routerRef.current.replace(buildClinicHubHref(locale));
      else if (res.status === 409) setLoad({ state: 'missing' });
      else setLoad({ state: 'error' });
    });
    return () => {
      live = false;
    };
  }, [locale, programId, ready, authenticated, attempt]);

  const sentences: PlayableSentence[] = useMemo(
    () =>
      load.state === 'ready'
        ? load.program.segments.map((s) => ({ seq: s.seq, text: s.text, audioUrl: s.audio_url ?? null }))
        : [],
    [load]
  );
  const player = useSentencePlayer({ sentences, speed, autoplay: true });

  const back = <BackLink href={radioHomeHref(locale)} label={tStudio('sections.radio')} />;

  if (load.state === 'loading') {
    return (
      <PlayerShell back={back} title="">
        <div aria-busy="true" className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      </PlayerShell>
    );
  }
  if (load.state === 'missing' || load.state === 'error') {
    return (
      <PlayerShell back={back} title="">
        <div data-testid="radio-program-missing" className="flex flex-col items-start gap-3 py-6">
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

  const { program } = load;
  return (
    <PlayerShell
      back={back}
      title={program.title ?? ''}
      footer={
        <PlayerControls
          playing={player.playing}
          speed={speed}
          onPlay={player.play}
          onPause={player.pause}
          onRepeat={player.repeat}
          onSpeed={setSpeed}
        />
      }
    >
      {program.series ? <p className="mb-2 text-xs text-workspace-muted">{program.series}</p> : null}
      <Captions sentences={sentences} activeIndex={player.index} playing={player.playing} />
      {player.done ? (
        <div className="mt-6 flex justify-center" data-testid="radio-program-done">
          <Link href={radioHomeHref(locale)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">
            {t('summary.home')}
          </Link>
        </div>
      ) : null}
    </PlayerShell>
  );
}
