'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { BackLink } from '@/components/navigation/back-link';
import { Captions, PlayerControls, PlayerShell } from '@/components/radio/player-parts';
import { useAuthReady } from '@/hooks/use-auth-ready';
import { useSentencePlayer, type PlayableSentence, type PlayerSpeed } from '@/hooks/use-sentence-player';
import { getRadioRender, getRadioSave, newRadioRequestId, postRadioTurn, radioAccessOf } from '@/lib/radio/api';
import { isRadioLocale, radioHomeHref } from '@/lib/radio/routes';
import { buildClinicHubHref } from '@/lib/hub-entry';
import { useUIStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import type { RadioNotice, RadioPlayerResponse, RadioSegment, RadioTurnInput } from '@/types/radio';

/** personal-radio.md, The audio of a part: at most 10 render requests, one a second. */
export const RENDER_POLL_LIMIT = 10;
export const RENDER_POLL_INTERVAL_MS = 1000;
/** Data · Busy: after 5 busy answers in a row the turn shows as failed. */
export const TURN_BUSY_LIMIT = 5;

type Load = { state: 'loading' } | { state: 'ready' } | { state: 'missing' } | { state: 'error' };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * A story in the player (KAZI-1209; personal-radio.md, Player · The audio of a part · Data).
 *
 * This part: captions with sentence-by-sentence audio (polling `GET renders/{id}` for sentences still
 * being made), choices by tap, a continuation part moving on by itself (`advance`), the ending,
 * notices, busy turns resent with the same `turn_id`, and a story that moved on elsewhere (409
 * `save_conflict`) reloaded with `radio.notice.synced`. Voice, questions, replay and settings are
 * KAZI-1209 follow-ups.
 *
 * Leaving the player (back, another destination, closing the tab) unmounts it, which stops the audio;
 * the story's place is the server's last answered part.
 */
export function StoryPlayerScreen({ locale, saveId, from }: { locale: string; saveId: string; from: 'studio' | 'home' }) {
  const t = useTranslations('radio');
  const tNav = useTranslations('nav');
  const tStudio = useTranslations('studio');
  const tStates = useTranslations('states');
  const router = useRouter();
  const showToast = useUIStore((s) => s.showToast);
  const { ready, authenticated } = useAuthReady();
  const studioHref = buildClinicHubHref(locale);

  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [resp, setResp] = useState<RadioPlayerResponse | null>(null);
  const [segments, setSegments] = useState<RadioSegment[]>([]);
  const [answerCount, setAnswerCount] = useState(0);
  const [notice, setNotice] = useState<RadioNotice | null>(null);
  const [speed, setSpeed] = useState<PlayerSpeed>(1);
  const [inFlight, setInFlight] = useState(false);
  const [failedTurn, setFailedTurn] = useState<{ turnId: string; version: number; input: RadioTurnInput } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const respRef = useRef<RadioPlayerResponse | null>(null);
  respRef.current = resp;
  // Router, translations and toast are read through refs so the load / turn callbacks stay stable
  // (a callback that changes on every render would re-run the load effect).
  const routerRef = useRef(router);
  routerRef.current = router;
  const tRef = useRef(t);
  tRef.current = t;
  const toastRef = useRef(showToast);
  toastRef.current = showToast;

  const accept = useCallback((next: RadioPlayerResponse) => {
    setResp(next);
    setSegments(next.node?.segments ?? []);
    setAnswerCount((n) => n + 1);
    setNotice(next.notice ?? null);
  }, []);

  const closedOrMissing = useCallback(
    (status: number | undefined, errorCode: string | undefined, access: ReturnType<typeof radioAccessOf>) => {
      if (access === 'closed') {
        routerRef.current.replace(studioHref);
        return true;
      }
      if (status === 409 && (errorCode === 'save_not_found' || errorCode === 'story_not_found')) {
        setLoad({ state: 'missing' });
        return true;
      }
      return false;
    },
    [studioHref]
  );

  const reload = useCallback(async () => {
    const res = await getRadioSave(saveId);
    if (res.success && res.data) {
      accept(res.data);
      setLoad({ state: 'ready' });
      return;
    }
    if (!closedOrMissing(res.status, res.errorCode, radioAccessOf(res))) setLoad({ state: 'error' });
  }, [saveId, accept, closedOrMissing]);

  useEffect(() => {
    if (!isRadioLocale(locale)) {
      routerRef.current.replace(studioHref);
      return;
    }
    if (!ready || !authenticated) return;
    setLoad({ state: 'loading' });
    void reload();
  }, [locale, ready, authenticated, studioHref, reload, attempt]);

  // The audio of a part: ask GET renders/{id} while a sentence is pending (≤ 10 requests, ≥ 1 s apart).
  const node = resp?.node ?? null;
  const renderId = node?.render_id ?? null;
  const voiceId = resp?.profile.voice_id ?? null;
  const hasPending = segments.some((s) => s.pending && !s.audio_url);
  useEffect(() => {
    if (!renderId || !voiceId || !hasPending) return;
    let live = true;
    void (async () => {
      for (let i = 0; i < RENDER_POLL_LIMIT && live; i += 1) {
        if (i > 0) await sleep(RENDER_POLL_INTERVAL_MS);
        if (!live) return;
        const res = await getRadioRender(renderId, voiceId);
        if (!live) return;
        if (!res.success || !res.data) {
          if (radioAccessOf(res) === 'closed') routerRef.current.replace(studioHref);
          break; // any other failure: not retried; what is still pending has no voice
        }
        const bySeq = new Map(res.data.segments.map((s) => [s.seq, s]));
        setSegments((prev) =>
          prev.map((s) => {
            const a = bySeq.get(s.seq);
            if (!a) return s;
            return { ...s, audio_url: a.audio_url ?? s.audio_url, duration_ms: a.duration_ms ?? s.duration_ms, pending: a.pending };
          })
        );
        if (!res.data.segments.some((s) => s.pending && !s.audio_url)) return;
      }
      if (live) setSegments((prev) => prev.map((s) => (s.pending ? { ...s, pending: false } : s)));
    })();
    return () => {
      live = false;
    };
    // Only a new part (render) restarts polling, not each merged answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderId, voiceId]);

  const sendTurn = useCallback(
    async (input: RadioTurnInput, retry?: { turnId: string; version: number }) => {
      const current = respRef.current;
      if (!current?.save_version && current?.save_version !== 0) return;
      const turnId = retry?.turnId ?? newRadioRequestId('turn');
      const version = retry?.version ?? current.save_version;
      setInFlight(true);
      setFailedTurn(null);
      for (let busy = 0; busy <= TURN_BUSY_LIMIT; busy += 1) {
        const res = await postRadioTurn(saveId, turnId, version, input);
        if (res.success && res.data) {
          setInFlight(false);
          accept(res.data);
          return;
        }
        if (res.status === 503 && res.errorCode === 'busy' && busy < TURN_BUSY_LIMIT) {
          await sleep(Math.max(1, res.retryAfter ?? 1) * 1000);
          continue;
        }
        setInFlight(false);
        if (closedOrMissing(res.status, res.errorCode, radioAccessOf(res))) return;
        if (res.status === 409 && (res.errorCode === 'save_conflict' || res.errorCode === 'save_inactive')) {
          // The story moved on elsewhere: the server's version wins; what was tapped is dropped.
          toastRef.current(tRef.current('notice.synced'));
          await reload();
          return;
        }
        setFailedTurn({ turnId, version, input });
        return;
      }
    },
    [saveId, accept, closedOrMissing, reload]
  );

  const sentences: PlayableSentence[] = useMemo(
    () =>
      segments.map((s) => ({ seq: s.seq, text: s.text, audioUrl: s.audio_url ?? null, durationMs: s.duration_ms ?? null, pending: s.pending })),
    [segments]
  );

  const onDone = useCallback(() => {
    const n = respRef.current?.node;
    if (n?.node_type === 'narration') void sendTurn({ kind: 'command', command: 'advance' });
  }, [sendTurn]);

  const player = useSentencePlayer({ sentences, speed, autoplay: true, onDone, partKey: answerCount });

  const back =
    from === 'studio' ? (
      <BackLink href={studioHref} label={tNav('studio')} />
    ) : (
      <BackLink href={radioHomeHref(locale)} label={tStudio('sections.radio')} />
    );

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
  if (load.state === 'missing' || load.state === 'error' || !node) {
    return (
      <PlayerShell back={back} title="">
        <div data-testid="radio-story-missing" className="flex flex-col items-start gap-3 py-6">
          <p className="text-sm text-workspace-secondary">{load.state === 'error' ? t('offline') : t('contentMissing')}</p>
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

  const allSilent = sentences.length > 0 && sentences.every((s) => !s.audioUrl && !s.pending);
  const choices = node.node_type === 'choice' ? node.choices ?? [] : [];
  const ended = node.node_type === 'ending';

  return (
    <PlayerShell
      back={back}
      title={t('player.title')}
      footer={
        <PlayerControls
          playing={player.playing}
          disabled={inFlight}
          speed={speed}
          onPlay={player.play}
          onPause={player.pause}
          onRepeat={player.repeat}
          onSpeed={setSpeed}
        />
      }
    >
      {allSilent ? <p className="mb-3 text-xs text-workspace-secondary" data-testid="radio-tts-failed">{t('tts.failed')}</p> : null}
      <Captions sentences={sentences} activeIndex={player.index} playing={player.playing} />

      {notice?.text ? (
        <div role="status" data-testid="radio-notice" className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p>{notice.text}</p>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 text-xs underline">
            {t('notice.close')}
          </button>
        </div>
      ) : null}

      {choices.length > 0 ? (
        <div className="mt-4 flex flex-col gap-2" data-testid="radio-choices">
          {choices.map((c) => (
            <button
              key={c.choice_id}
              type="button"
              disabled={inFlight}
              onClick={() => {
                player.pause();
                void sendTurn({ kind: 'choice', choice_id: c.choice_id });
              }}
              aria-label={t('player.choice', { key: c.key, label: c.label ?? '' })}
              data-testid="radio-choice"
              className={cn(
                'flex min-h-14 items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left hover:border-primary disabled:opacity-60'
              )}
            >
              <span className="text-2xl font-bold text-primary">{c.key}</span>
              <span className="text-sm text-workspace-text">{c.label}</span>
            </button>
          ))}
        </div>
      ) : null}

      {inFlight ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-workspace-muted" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        </p>
      ) : null}

      {failedTurn ? (
        <div className="mt-3 flex items-center gap-3 text-sm" data-testid="radio-turn-failed">
          <span className="text-red-700">{tStates('notSent')}</span>
          <button
            type="button"
            onClick={() => void sendTurn(failedTurn.input, { turnId: failedTurn.turnId, version: failedTurn.version })}
            className="rounded-lg border border-gray-300 px-3 py-1.5"
          >
            {tStates('retry')}
          </button>
        </div>
      ) : null}

      {ended ? (
        <div className="mt-6 rounded-xl border border-gray-200 p-4" data-testid="radio-ending">
          <Link href={radioHomeHref(locale)} className="mt-3 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">
            {t('summary.home')}
          </Link>
        </div>
      ) : null}
    </PlayerShell>
  );
}
