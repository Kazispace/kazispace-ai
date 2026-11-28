'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { BackLink } from '@/components/navigation/back-link';
import { PlayerShell } from '@/components/radio/player-parts';
import { useAuthReady } from '@/hooks/use-auth-ready';
import { radioAccessOf } from '@/lib/radio/api';
import { radioMinutes } from '@/lib/radio/format';
import { isRadioLocale, radioEpisodeHref, radioHomeHref } from '@/lib/radio/routes';
import { getRadioStoryline } from '@/lib/radio/serial-api';
import type { RadioStoryline } from '@/types/radio';

type Load = { state: 'loading' } | { state: 'ready'; line: RadioStoryline } | { state: 'missing' } | { state: 'error' };

/**
 * A serial story line (KAZI-1455; personal-radio.md, Serial stories): its synopsis, "continue" (or "start"),
 * and every episode in order, grouped by season, with the one the listener is in marked.
 */
export function SerialStorylineScreen({ locale, storylineId }: { locale: string; storylineId: string }) {
  const t = useTranslations('radio');
  const tStudio = useTranslations('studio');
  const tStates = useTranslations('states');
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const { ready, authenticated } = useAuthReady();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isRadioLocale(locale)) {
      routerRef.current.replace(radioHomeHref(locale));
      return;
    }
    if (!ready || !authenticated) return;
    let live = true;
    setLoad({ state: 'loading' });
    void getRadioStoryline(storylineId).then((res) => {
      if (!live) return;
      if (res.success && res.data) setLoad({ state: 'ready', line: res.data });
      else if (res.status === 404 && res.errorCode === 'serial_not_found') setLoad({ state: 'missing' });
      else if (radioAccessOf(res) === 'closed') routerRef.current.replace(radioHomeHref(locale));
      else setLoad({ state: 'error' });
    });
    return () => {
      live = false;
    };
  }, [locale, storylineId, ready, authenticated, attempt]);

  const back = <BackLink tone="radio" href={radioHomeHref(locale)} label={tStudio('sections.radio')} />;

  if (load.state === 'loading') {
    return (
      <PlayerShell back={back} title="">
        <div aria-busy="true" className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-radio-surface-raised" />
          ))}
        </div>
      </PlayerShell>
    );
  }
  if (load.state !== 'ready') {
    return (
      <PlayerShell back={back} title="">
        <div data-testid="radio-storyline-missing" className="flex flex-col items-start gap-3 py-6">
          <p className="text-sm text-radio-secondary">{load.state === 'missing' ? t('serial.missing') : t('offline')}</p>
          {load.state === 'error' ? (
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className="rounded-lg border border-radio-surface-raised px-3 py-1.5 text-sm">
              {tStates('retry')}
            </button>
          ) : (
            <Link href={radioHomeHref(locale)} className="text-sm text-radio-progress underline">
              {t('summary.home')}
            </Link>
          )}
        </div>
      </PlayerShell>
    );
  }

  const { line } = load;
  const first = line.episode_list[0];
  // "Continue" only to an episode that is still listed; otherwise the story line starts again from its first.
  const here = line.progress && line.episode_list.some((e) => e.program_id === line.progress!.program_id) ? line.progress : null;
  const seasons = Array.from(new Set(line.episode_list.map((e) => e.season)));
  return (
    <PlayerShell back={back} title={line.title}>
      {line.synopsis ? <p className="text-sm text-radio-secondary">{line.synopsis}</p> : null}
      {here ? (
        <Link
          href={radioEpisodeHref(locale, line.storyline_id, here.program_id)}
          data-testid="radio-storyline-continue"
          className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-gradient-to-r from-radio-accent-start to-radio-accent-end ring-2 ring-radio-ring px-4 text-sm text-white"
        >
          {t('serial.continueEpisode', { season: here.season, episode: here.episode })}
        </Link>
      ) : first ? (
        <Link
          href={radioEpisodeHref(locale, line.storyline_id, first.program_id)}
          data-testid="radio-storyline-start"
          className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-gradient-to-r from-radio-accent-start to-radio-accent-end ring-2 ring-radio-ring px-4 text-sm text-white"
        >
          {t('serial.start')}
        </Link>
      ) : (
        <p className="mt-4 text-sm text-radio-secondary">{t('serial.empty')}</p>
      )}
      {seasons.map((season) => (
        <section key={season} className="mt-6" data-testid="radio-season">
          {seasons.length > 1 ? (
            <h2 className="mb-2 text-sm font-semibold text-radio-secondary">{t('serial.season', { season })}</h2>
          ) : null}
          <ol className="flex flex-col gap-2">
            {line.episode_list
              .filter((e) => e.season === season)
              .map((e) => {
                const current = here?.program_id === e.program_id;
                return (
                  <li key={e.program_id}>
                    <Link
                      href={radioEpisodeHref(locale, line.storyline_id, e.program_id)}
                      data-testid="radio-episode"
                      aria-current={current ? 'true' : undefined}
                      className={
                        current
                          ? 'block rounded-xl border border-radio-ring bg-radio-surface-raised p-3'
                          : 'block rounded-xl border border-radio-surface-raised bg-radio-surface p-3 hover:border-radio-ring'
                      }
                    >
                      <p className="text-xs text-radio-muted">
                        {t('serial.episodeNumber', { season: e.season, episode: e.episode })}
                        {current ? <span className="ml-2 font-medium text-radio-progress">{t('serial.current')}</span> : null}
                      </p>
                      <h3 className="text-base font-semibold text-radio-text">{e.title}</h3>
                      <p className="mt-1 flex gap-1 text-xs text-radio-secondary">
                        {e.duration_ms ? <span>{t('home.minutes', { n: radioMinutes(e.duration_ms) })}</span> : null}
                        <span>{e.band}</span>
                      </p>
                    </Link>
                  </li>
                );
              })}
          </ol>
        </section>
      ))}
    </PlayerShell>
  );
}
