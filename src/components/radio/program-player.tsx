'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BackLink } from '@/components/navigation/back-link';
import { AnswerCaptions, CareCard, NoticeCard, VoiceLine, explainQuestion } from '@/components/radio/ask-parts';
import { Captions, PlayerControls, PlayerShell } from '@/components/radio/player-parts';
import { RadioRating } from '@/components/radio/radio-rating';
import { BlockedHelpDialog, ListeningIndicator, MicButton, micButtonState } from '@/components/radio/voice-parts';
import { useAuthReady } from '@/hooks/use-auth-ready';
import { useRadioEvents } from '@/hooks/use-radio-events';
import { useRadioHome } from '@/hooks/use-radio-home';
import { useRadioMic, type RadioMicOpen } from '@/hooks/use-radio-mic';
import { AIGC_MORSE_URL } from '@/lib/radio/aigc-morse';
import { useSentencePlayer, type PlayableSentence, type PlayerSpeed } from '@/hooks/use-sentence-player';
import { getRadioProgram, newRadioRequestId, radioAccessOf } from '@/lib/radio/api';
import { sendPlayerLeft, trackRadioEvent } from '@/lib/radio/events';
import { askRadioProgram, askRadioProgramAudio } from '@/lib/radio/player-api';
import { isRadioLocale, radioHomeHref } from '@/lib/radio/routes';
import { SLOW_AFTER_MS, VOICE_LINE_MS, blockedHelpPlatform, recordingFileName } from '@/lib/radio/voice';
import { buildClinicHubHref } from '@/lib/hub-entry';
import { useUIStore } from '@/lib/store';
import { isTelegramWebApp } from '@/lib/telegram';
import type { ApiResponse } from '@/types';
import type { RadioAnswerSegment, RadioNotice, RadioProgramAskResponse, RadioProgramDetail } from '@/types/radio';

type Load = { state: 'loading' } | { state: 'ready'; program: RadioProgramDetail } | { state: 'missing' } | { state: 'error' };
type PostAsk = (requestId: string) => Promise<ApiResponse<RadioProgramAskResponse>>;
type FailedAsk = { requestId: string; post: PostAsk; spoken: boolean };

/** Data · A program: a busy answer is resent with the same `request_id`, at most 5 times. */
export const ASK_BUSY_LIMIT = 5;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * A program in the player (KAZI-1209; personal-radio.md, Player · Programs · Data · A program).
 *
 * `GET /programs/{id}` answers the version nearest the listener's level, in the listener's voice
 * (KAZI-1248), with signed sentence audio. No choice cards. A program that does not exist or has no
 * version (409) shows "content cannot be found".
 *
 * Questions (part 3): by a long press on a sentence ("explain this sentence", `POST /ask` with the
 * sentence as the text) or by the microphone (`POST /ask/audio`). The voice pauses; the host's answer
 * shows as captions; then the program carries on from where it stopped. `request_id` is made when
 * the user asks and reused for every resend. No microphone where the region has no voice input.
 */
export function ProgramPlayerScreen({ locale, programId }: { locale: string; programId: string }) {
  const t = useTranslations('radio');
  const tStudio = useTranslations('studio');
  const tStates = useTranslations('states');
  const router = useRouter();
  const showToast = useUIStore((s) => s.showToast);
  const { ready, authenticated } = useAuthReady();
  const { home } = useRadioHome({ enabled: ready && authenticated && isRadioLocale(locale) });
  // KAZI-1242 (D20 = E1): the line under the header and, once per programme played, the Morse "AI" rhythm
  // before its first voiced sentence (programmes count too: the user, 2026-11-10, 「节目也播一次」).
  const mustLabel = home?.availability?.aigc_label === true;
  const aigcLabel = mustLabel ? t('player.aigcLabel') : null;
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [speed, setSpeed] = useState<PlayerSpeed>(1);
  const [attempt, setAttempt] = useState(0);
  const [inFlight, setInFlight] = useState(false);
  const [slow, setSlow] = useState(false);
  const [failed, setFailed] = useState<FailedAsk | null>(null);
  const [answer, setAnswer] = useState<{ segments: RadioAnswerSegment[]; key: number } | null>(null);
  const [notice, setNotice] = useState<RadioNotice | null>(null);
  const [care, setCare] = useState<RadioNotice | null>(null);
  const [line, setLine] = useState<{ text: string | null; sticky: boolean; key: number } | null>(null);
  const [asrOff, setAsrOff] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [noDevice, setNoDevice] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const routerRef = useRef(router);
  routerRef.current = router;
  const tRef = useRef(t);
  tRef.current = t;
  const toastRef = useRef(showToast);
  toastRef.current = showToast;
  const askedAt = useRef(0);

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

  const segments = useMemo(() => (load.state === 'ready' ? load.program.segments : []), [load]);
  const sentences: PlayableSentence[] = useMemo(
    () => segments.map((s) => ({ seq: s.seq, text: s.text, audioUrl: s.audio_url ?? null })),
    [segments]
  );
  const variantBand = load.state === 'ready' ? load.program.band : null;
  // The rating appears once the programme has played to its end, and stays (personal-radio.md 0.15, Programs).
  const [finishedOnce, setFinishedOnce] = useState(false);
  const durationMs = load.state === 'ready' ? load.program.duration_ms : null;
  // `player_left.listened_ms` (KAZI-1255): audio that actually played on this visit.
  const listenedMs = useRef(0);
  const addListened = useCallback((ms: number) => {
    listenedMs.current += ms;
  }, []);
  const player = useSentencePlayer({
    sentences,
    speed,
    autoplay: true,
    onPlayed: addListened,
    preroll: mustLabel ? AIGC_MORSE_URL : null,
    // `program_finished`: the programme played to its end.
    onDone: () => {
      setFinishedOnce(true);
      trackRadioEvent('program_finished', { programId }, { variant_band: variantBand, position_ms: durationMs });
    },
  });

  // Playback events: sent while here, and `player_left` with where the programme was as the user leaves.
  useRadioEvents(ready && authenticated);
  const posRef = useRef<number | null>(null);
  const at = segments[Math.min(player.index, Math.max(0, segments.length - 1))];
  if (at) posRef.current = (at.start_ms ?? 0) + player.offsetMs();
  useEffect(() => {
    let sent = false;
    const leave = () => {
      // Only when a programme was loaded: leaving a "content missing" screen played nothing.
      if (sent || posRef.current === null) return;
      sent = true;
      sendPlayerLeft({ programId }, { position_ms: posRef.current, listened_ms: Math.round(listenedMs.current) });
    };
    // Closing the tab never unmounts the player: `pagehide` is the only moment that remains.
    window.addEventListener('pagehide', leave);
    return () => {
      window.removeEventListener('pagehide', leave);
      leave();
    };
  }, [programId]);
  const changeSpeed = (to: PlayerSpeed) => {
    if (to !== speed) trackRadioEvent('speed_changed', { programId }, { from: speed, to });
    setSpeed(to);
  };
  const playerRef = useRef(player);
  playerRef.current = player;

  /** After the answer (or a notice that was only a line), the program carries on from where it stopped. */
  const carryOn = useCallback(() => {
    // A program that had already played to its end stays at its end.
    if (!playerRef.current.done) playerRef.current.play();
  }, []);
  const answerSentences: PlayableSentence[] = useMemo(
    // The contract's answer sentences carry no audio yet: each is a reading pause.
    () => (answer?.segments ?? []).map((s) => ({ seq: s.seq, text: s.text, audioUrl: null })),
    [answer]
  );
  const answerPlayer = useSentencePlayer({
    sentences: answerSentences,
    speed,
    autoplay: true,
    partKey: answer?.key,
    onPlayed: addListened,
    onDone: () => {
      setAnswer(null);
      carryOn();
    },
  });

  const showLine = (text: string | null | undefined, sticky = false) => setLine({ text: text ?? null, sticky, key: Date.now() });

  const afterAsk = useCallback(
    (res: RadioProgramAskResponse) => {
      const n = res.notice ?? null;
      if (n?.code === 'input_self_harm') {
        setCare(n); // paused; nothing resumes by itself
        return;
      }
      if (n?.kind === 'retry') {
        // Ask another way stays; "not understood" and "can't take that" go after 3 s. The program carries on.
        showLine(n.text, n.code === 'voice_unrecognized');
        carryOn();
        return;
      }
      if (res.answer?.segments?.length) {
        // An answered question (typed, "who are you" included) ends "ask another way".
        setLine(null);
        setAnswer({ segments: res.answer.segments, key: Date.now() });
        if (n) setNotice(n);
        return;
      }
      if (n) {
        setNotice(n); // Limit: carries on when the card is closed
        return;
      }
      carryOn();
    },
    [carryOn]
  );

  const runAsk = useCallback(
    async (post: PostAsk, spoken: boolean, requestId = newRadioRequestId('ask')) => {
      setInFlight(true);
      setFailed(null);
      for (let busy = 0; busy <= ASK_BUSY_LIMIT; busy += 1) {
        const res = await post(requestId);
        if (res.success && res.data) {
          setInFlight(false);
          afterAsk(res.data);
          return;
        }
        if (res.status === 503 && res.errorCode === 'busy' && busy < ASK_BUSY_LIMIT) {
          await sleep(Math.max(1, res.retryAfter ?? 1) * 1000);
          continue;
        }
        setInFlight(false);
        if (radioAccessOf(res) === 'closed') {
          routerRef.current.replace(buildClinicHubHref(locale));
          return;
        }
        if (res.status === 409 && res.errorCode === 'request_consumed') {
          // Asked before the radio memory was cleared: back to the radio home, as for a story start.
          toastRef.current(tRef.current('home.refreshed'));
          routerRef.current.push(radioHomeHref(locale));
          return;
        }
        if (res.status === 409) {
          setLoad({ state: 'missing' });
          return;
        }
        if (spoken && res.status === 503 && res.errorCode === 'feature_disabled_in_region') {
          setAsrOff(true);
          toastRef.current(tRef.current('mic.regionDisabled'));
          carryOn();
          return;
        }
        setFailed({ requestId, post, spoken });
        return;
      }
    },
    [afterAsk, carryOn, locale]
  );

  /** Where the program was when the user asked: the start of the sentence playing. */
  const positionNow = () => {
    const s = segments[Math.min(player.index, Math.max(0, segments.length - 1))];
    return s?.start_ms ?? 0;
  };

  const pauseAll = () => {
    player.pause();
    answerPlayer.pause();
  };

  const onExplain = (i: number) => {
    if (inFlight || !segments[i]) return;
    mic.cancel();
    pauseAll();
    const positionMs = segments[i].start_ms ?? positionNow();
    const text = explainQuestion(t('player.explain'), segments[i].text);
    void runAsk((requestId) => askRadioProgram(programId, requestId, text, positionMs), false);
  };

  const mic = useRadioMic({
    onRecorded: (audio, durationMs, mime) => {
      const positionMs = askedAt.current;
      const fileName = recordingFileName(mime);
      void runAsk(
        (requestId) => askRadioProgramAudio(programId, { requestId, positionMs }, audio, durationMs, fileName),
        true
      );
    },
    onSilence: () => carryOn(),
  });

  const noteOpen = (r: RadioMicOpen) => {
    if (r === 'blocked') {
      setBlocked(true);
      setHelpOpen(true);
    } else if (r === 'no_device') {
      setNoDevice(true);
      showToast(t('mic.noDevice'));
    } else setBlocked(false);
  };

  // When the radio home's availability.asr is false, the microphone is not offered in a program.
  const regionOff = asrOff || (home ? home.availability?.asr === false : false);
  const onMicTap = async () => {
    // The AI marker cannot be cut short (「放完才能录音」, user 2026-11-10): the microphone waits for it.
    if (player.prerolling) return;
    if (inFlight || mic.state !== 'idle') return;
    if (noDevice) {
      showToast(t('mic.noDevice'));
      return;
    }
    askedAt.current = positionNow();
    pauseAll();
    const r = await mic.open();
    noteOpen(r);
    if (r !== 'ok') carryOn();
  };

  useEffect(() => {
    if (!inFlight) {
      setSlow(false);
      return;
    }
    const id = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(id);
  }, [inFlight]);

  useEffect(() => {
    if (!line || line.sticky) return;
    const id = setTimeout(() => setLine(null), VOICE_LINE_MS);
    return () => clearTimeout(id);
  }, [line]);

  const micRef = useRef(mic);
  micRef.current = mic;
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') micRef.current.cancel();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const back = <BackLink href={radioHomeHref(locale)} label={tStudio('sections.radio')} />;

  if (load.state === 'loading') {
    return (
      <PlayerShell back={back} title="" aigcLabel={aigcLabel}>
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
      <PlayerShell back={back} title="" aigcLabel={aigcLabel}>
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
  const platform =
    typeof navigator !== 'undefined'
      ? blockedHelpPlatform(navigator.userAgent, { telegram: isTelegramWebApp(), maxTouchPoints: navigator.maxTouchPoints })
      : 'desktop';
  return (
    <div className="h-full">
      <ListeningIndicator on={mic.state === 'recording'} />
      <PlayerShell
        back={back}
        aigcLabel={aigcLabel}
        title={program.title ?? ''}
        footer={
          <div className="flex flex-col items-center gap-3">
            {!regionOff ? (
              <MicButton
                state={micButtonState({ mic: mic.state, inFlight, unavailable: blocked || noDevice })}
                level={mic.level}
                windowMs={null}
                choiceCount={0}
                slow={slow}
                onTap={() => void onMicTap()}
                disabled={player.prerolling}
                onDone={mic.done}
                onCancel={() => {
                  mic.cancel();
                  carryOn();
                }}
              />
            ) : null}
            <PlayerControls
              playing={player.playing || answerPlayer.playing}
              disabled={inFlight}
              speed={speed}
              onPlay={() => {
                setCare(null);
                player.play();
              }}
              onPause={pauseAll}
              onRepeat={() => {
                if (at) trackRadioEvent('replay', { programId }, { seq: at.seq });
                player.repeat();
              }}
              onSpeed={changeSpeed}
            />
          </div>
        }
      >
        {program.series ? <p className="mb-2 text-xs text-workspace-muted">{program.series}</p> : null}
        {care ? (
          <div role="status" data-testid="radio-paused" className="mb-3 rounded-xl bg-gray-100 p-3 text-sm">
            {t('notice.paused')}
          </div>
        ) : null}
        <Captions sentences={sentences} activeIndex={player.index} playing={player.playing} onExplain={onExplain} explainDisabled={inFlight} />
        {answer ? <AnswerCaptions sentences={answerSentences} activeIndex={answerPlayer.index} /> : null}
        {care ? (
          <CareCard
            notice={care}
            onKeepListening={() => {
              setCare(null);
              carryOn();
            }}
            onClose={() => setCare(null)}
          />
        ) : null}
        {notice ? (
          <NoticeCard
            notice={notice}
            onClose={() => {
              setNotice(null);
              if (!answer) carryOn();
            }}
          />
        ) : null}
        <VoiceLine text={line?.text ?? null} />
        {failed ? (
          <div className="mt-3 flex items-center gap-3 text-sm" data-testid="radio-ask-failed">
            <span className="text-red-700">{tStates('notSent')}</span>
            <button
              type="button"
              onClick={() => void runAsk(failed.post, failed.spoken, failed.requestId)}
              className="rounded-lg border border-gray-300 px-3 py-1.5"
            >
              {tStates('retry')}
            </button>
          </div>
        ) : null}
        {finishedOnce && load.state === 'ready' ? (
          <RadioRating kind="program" targetId={programId} initial={load.program.my_rating ?? null} />
        ) : null}
        {player.done && !answer && !inFlight ? (
          <div className="mt-6 flex justify-center" data-testid="radio-program-done">
            <Link href={radioHomeHref(locale)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">
              {t('summary.home')}
            </Link>
          </div>
        ) : null}
      </PlayerShell>
      {helpOpen ? <BlockedHelpDialog platform={platform} onClose={() => setHelpOpen(false)} /> : null}
    </div>
  );
}
