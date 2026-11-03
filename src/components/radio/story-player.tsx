'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { BackLink } from '@/components/navigation/back-link';
import { Captions, PlayerControls, PlayerShell } from '@/components/radio/player-parts';
import {
  BlockedHelpDialog,
  ConsentCard,
  ListeningIndicator,
  MicButton,
  micButtonState,
} from '@/components/radio/voice-parts';
import { useAuthReady } from '@/hooks/use-auth-ready';
import { useRadioHome } from '@/hooks/use-radio-home';
import { useRadioMic, type RadioMicOpen } from '@/hooks/use-radio-mic';
import { useSentencePlayer, type PlayableSentence, type PlayerSpeed } from '@/hooks/use-sentence-player';
import {
  getRadioRender,
  getRadioSave,
  newRadioRequestId,
  patchRadioPrefs,
  postRadioTurn,
  postRadioTurnAudio,
  radioAccessOf,
} from '@/lib/radio/api';
import { isRadioLocale, radioHomeHref } from '@/lib/radio/routes';
import {
  DEFAULT_LISTEN_WINDOW_MS,
  SLOW_AFTER_MS,
  VOICE_LINE_MS,
  appCommandOf,
  blockedHelpPlatform,
  recordingFileName,
} from '@/lib/radio/voice';
import { buildClinicHubHref } from '@/lib/hub-entry';
import { useUIStore } from '@/lib/store';
import { isTelegramWebApp } from '@/lib/telegram';
import { cn } from '@/lib/utils';
import type { ApiResponse } from '@/types';
import type {
  RadioAnswerSegment,
  RadioChoice,
  RadioNotice,
  RadioPlayerResponse,
  RadioPosition,
  RadioSegment,
  RadioTurnInput,
} from '@/types/radio';

/** personal-radio.md, The audio of a part: at most 10 render requests, one a second. */
export const RENDER_POLL_LIMIT = 10;
export const RENDER_POLL_INTERVAL_MS = 1000;
/** Data · Busy: after 5 busy answers in a row the turn shows as failed. */
export const TURN_BUSY_LIMIT = 5;
/** Data · Saving settings: after 5 busy answers in a row the setting goes back. */
const PREFS_BUSY_LIMIT = 5;

type Load = { state: 'loading' } | { state: 'ready' } | { state: 'missing' } | { state: 'error' };
type PostTurn = (turnId: string, version: number) => Promise<ApiResponse<RadioPlayerResponse>>;
type FailedTurn = { turnId: string; version: number; post: PostTurn; spoken: boolean };
type VoiceLine = { text: string | null; sticky: boolean; key: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Choice readings sit after the part's sentences in the play queue, with their own seq range. */
const CHOICE_SEQ_BASE = 10_000;

/**
 * A story in the player (KAZI-1209; personal-radio.md, Player · Voice · Notices · Data).
 *
 * Part 1: captions with sentence-by-sentence audio (polling `GET renders/{id}` for sentences still
 * being made), choices by tap, a continuation part moving on by itself (`advance`), the ending,
 * notices, busy turns resent with the same `turn_id`, and a story that moved on elsewhere (409
 * `save_conflict`) reloaded with `radio.notice.synced`.
 *
 * Part 2 (voice): the host reads the choices after the part; then the **listen window** opens when
 * the user agreed to voice, voice works in the region, the microphone is not blocked, the screen can
 * be seen and the user has tapped on this screen. The first choice point asks first (the consent
 * card). Silence or "not understood" twice ⇒ the story pauses (two-strike rule). A tap on the
 * microphone records at once. Recordings go to `POST saves/{id}/turn/audio`; the app carries out the
 * commands the server leaves to it (repeat, slower / faster, pause / continue, save, exit) and plays
 * the host's answer before carrying on. Tapping always works.
 *
 * Leaving the player (back, another destination, closing the tab) unmounts it, which stops the audio
 * and releases the microphone; the story's place is the server's last answered part.
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
  const backHref = from === 'studio' ? studioHref : radioHomeHref(locale);
  const { home } = useRadioHome({ enabled: ready && authenticated && isRadioLocale(locale) });

  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [resp, setResp] = useState<RadioPlayerResponse | null>(null);
  const [segments, setSegments] = useState<RadioSegment[]>([]);
  const [choices, setChoices] = useState<RadioChoice[]>([]);
  const [answerCount, setAnswerCount] = useState(0);
  const [notice, setNotice] = useState<RadioNotice | null>(null);
  const [speed, setSpeed] = useState<PlayerSpeed>(1);
  const [inFlight, setInFlight] = useState(false);
  const [slow, setSlow] = useState(false);
  const [failedTurn, setFailedTurn] = useState<FailedTurn | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Voice
  const [listenOn, setListenOn] = useState<boolean | null | undefined>(undefined);
  const [asrOff, setAsrOff] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [noDevice, setNoDevice] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [voiceLine, setVoiceLine] = useState<VoiceLine | null>(null);
  const [paused, setPaused] = useState(false);
  const [care, setCare] = useState<RadioNotice | null>(null);
  const [answer, setAnswer] = useState<{ segments: RadioAnswerSegment[]; key: number } | null>(null);

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
  const tappedHere = useRef(false);
  const strikes = useRef(0);
  const tapOnlyHere = useRef(false);
  const wasPlaying = useRef(false);
  const spokenAt = useRef<RadioPosition | null>(null);
  const consentAsked = useRef(false);

  useEffect(() => {
    if (home && listenOn === undefined) setListenOn(home.prefs?.listen_window_on ?? null);
  }, [home, listenOn]);

  // A microphone the system has already blocked (where the browser can tell without asking).
  useEffect(() => {
    const perms = typeof navigator !== 'undefined' ? navigator.permissions : undefined;
    if (!perms?.query) return;
    perms
      .query({ name: 'microphone' as PermissionName })
      .then((st) => {
        setBlocked(st.state === 'denied');
        st.onchange = () => setBlocked(st.state === 'denied');
      })
      .catch(() => undefined);
  }, []);

  /** Takes an answer in; true when it moved the story to a new part (which then plays by itself). */
  const accept = useCallback((next: RadioPlayerResponse, { restart = false }: { restart?: boolean } = {}): boolean => {
    const prev = respRef.current;
    const sameNode =
      !restart &&
      !!next.node &&
      !!prev?.node &&
      next.node.node_id === prev.node.node_id &&
      (next.node.render_id ?? null) === (prev.node.render_id ?? null);
    // An answer with no part (a command, a question, a "not understood") leaves the part as it is.
    const merged: RadioPlayerResponse = next.node
      ? next
      : { ...next, node: prev?.node ?? null, save_version: next.save_version ?? prev?.save_version ?? null };
    respRef.current = merged;
    setResp(merged);
    if (next.node && !sameNode) {
      setSegments(next.node.segments ?? []);
      setChoices(next.node.node_type === 'choice' ? next.node.choices ?? [] : []);
      setAnswerCount((n) => n + 1);
      // The story moved on: voice works again at the new point.
      strikes.current = 0;
      tapOnlyHere.current = false;
      setVoiceLine(null);
    }
    const n = next.notice ?? null;
    const special = !!n && (n.kind === 'retry' || n.kind === 'paused' || n.code === 'input_self_harm');
    setNotice(special ? null : n);
    return !!next.node && !sameNode;
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
      accept(res.data, { restart: true });
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
        const byChoice = new Map((res.data.choices ?? []).map((c) => [c.choice_id, c.audio_url]));
        setChoices((prev) => prev.map((c) => (byChoice.get(c.choice_id) ? { ...c, audio_url: byChoice.get(c.choice_id) } : c)));
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

  // The play queue: the part's sentences, then the host reading the choices.
  const segLen = segments.length;
  const sentences: PlayableSentence[] = useMemo(
    () => [
      ...segments.map((s) => ({ seq: s.seq, text: s.text, audioUrl: s.audio_url ?? null, durationMs: s.duration_ms ?? null, pending: s.pending })),
      ...choices.map((c, i) => ({ seq: CHOICE_SEQ_BASE + i, text: `${c.key}. ${c.label ?? ''}`, audioUrl: c.audio_url ?? null })),
    ],
    [segments, choices]
  );
  const captions = useMemo(() => sentences.slice(0, segLen), [sentences, segLen]);

  // ── voice: what may happen right now ──────────────────────────────────────────────────────────
  const regionOff = asrOff || (home ? home.availability?.asr === false : false);
  const micUnavailable: 'region' | 'blocked' | 'no_device' | 'tap_only' | null = regionOff
    ? 'region'
    : blocked
      ? 'blocked'
      : noDevice
        ? 'no_device'
        : listenOn === false
          ? 'tap_only'
          : null;
  const voiceRef = useRef({ listenOn, micUnavailable, inFlight, paused, care });
  voiceRef.current = { listenOn, micUnavailable, inFlight, paused, care };

  const onRecordedRef = useRef<(audio: Blob, durationMs: number, mime: string) => void>(() => undefined);
  const onSilenceRef = useRef<() => void>(() => undefined);
  const mic = useRadioMic({
    onRecorded: (a, d, m) => onRecordedRef.current(a, d, m),
    onSilence: () => onSilenceRef.current(),
  });
  const micRef = useRef(mic);
  micRef.current = mic;

  const noteOpen = useCallback((r: RadioMicOpen, fromTap: boolean) => {
    if (r === 'blocked') {
      setBlocked(true);
      if (fromTap) setHelpOpen(true); // the help only ever opens on the user's tap
    } else if (r === 'no_device') {
      setNoDevice(true);
      if (fromTap) toastRef.current(tRef.current('mic.noDevice'));
    } else {
      setBlocked(false);
    }
  }, []);

  /** The listen window opens only when every condition in Voice · The listen window holds. */
  const openWindow = useCallback(async () => {
    const v = voiceRef.current;
    const r = respRef.current;
    if (v.listenOn !== true || v.micUnavailable || v.inFlight || v.paused || v.care) return;
    if (!tappedHere.current || tapOnlyHere.current) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (!r?.listen_window_ms) return; // "Listen at choices" off on the server, or no window offered
    spokenAt.current = null;
    noteOpen(await micRef.current.open({ windowMs: r.listen_window_ms }), false);
  }, [noteOpen]);

  const onNodeDone = useCallback(() => {
    const n = respRef.current?.node;
    if (n?.node_type === 'narration') {
      void sendTurnRef.current({ kind: 'command', command: 'advance' });
      return;
    }
    if (n?.node_type !== 'choice') return;
    const v = voiceRef.current;
    // Explain first, then ask: the first choice point, when the user has never chosen.
    if (v.listenOn === null && !v.micUnavailable && !consentAsked.current) {
      consentAsked.current = true;
      setConsentOpen(true);
      return;
    }
    void openWindow();
  }, [openWindow]);

  const player = useSentencePlayer({ sentences, speed, autoplay: true, onDone: onNodeDone, partKey: answerCount });
  const playerRef = useRef(player);
  playerRef.current = player;

  const atChoicePoint = () => respRef.current?.node?.node_type === 'choice' && playerRef.current.done;
  const readChoicesAgain = useCallback(() => playerRef.current.playFrom(segLen), [segLen]);

  // The host's answer to a question (or "who are you"), then the story carries on.
  const onAnswerDone = useCallback(() => {
    setAnswer(null);
    if (respRef.current?.node?.node_type === 'choice' && playerRef.current.done) void openWindow();
    else playerRef.current.play();
  }, [openWindow]);
  const answerSentences: PlayableSentence[] = useMemo(
    () => // The contract's answer sentences carry no audio yet: each is a reading pause.
      (answer?.segments ?? []).map((s) => ({ seq: s.seq, text: s.text, audioUrl: null })),
    [answer]
  );
  const answerPlayer = useSentencePlayer({ sentences: answerSentences, speed, autoplay: true, onDone: onAnswerDone, partKey: answer?.key });

  /** Back to where the user was before they spoke. */
  const carryOn = useCallback(() => {
    if (atChoicePoint()) void openWindow();
    else if (wasPlaying.current) playerRef.current.play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openWindow]);

  const pauseForNoResponseRef = useRef<() => void>(() => undefined);
  const showLine = (text: string | null | undefined, sticky = false) =>
    setVoiceLine({ text: text ?? null, sticky, key: Date.now() });

  /** What an answer asks the player to do (Notices; Voice · What the user can say). */
  const afterAnswer = useCallback(
    (next: RadioPlayerResponse, spoken: boolean, movedOn: boolean) => {
      const n = next.notice ?? null;
      if (n?.code === 'input_self_harm') {
        setCare(n);
        setPaused(true);
        playerRef.current.pause();
        return;
      }
      if (n?.kind === 'paused') {
        setPaused(true);
        playerRef.current.pause();
        return;
      }
      if (movedOn) return; // the new part plays from its first sentence
      if (n?.kind === 'retry') {
        if (n.code === 'input_blocked') {
          // Can't take that: no strike; at a choice point the window reopens without reading again.
          showLine(n.text);
          if (atChoicePoint()) void openWindow();
          else if (wasPlaying.current) playerRef.current.play();
        } else if (n.code === 'voice_unrecognized') {
          // Tap instead: stays until the user taps or the story moves on; no listen window here.
          showLine(n.text, true);
          tapOnlyHere.current = true;
        } else {
          // Not understood: at a choice point it is a strike; during narration the player waits.
          showLine(n.text);
          if (atChoicePoint()) {
            strikes.current += 1;
            if (strikes.current >= 2) pauseForNoResponseRef.current();
            else readChoicesAgain();
          }
        }
        return;
      }
      switch (appCommandOf(next.parsed)) {
        case 'repeat':
          if (atChoicePoint()) readChoicesAgain();
          else playerRef.current.repeat();
          return;
        case 'slower':
          setSpeed(0.75);
          carryOn();
          return;
        case 'faster':
          setSpeed(1);
          carryOn();
          return;
        case 'pause':
          playerRef.current.pause();
          return;
        case 'resume':
          if (atChoicePoint()) readChoicesAgain();
          else playerRef.current.play();
          return;
        case 'save':
          toastRef.current(tRef.current('player.saved'));
          carryOn();
          return;
        case 'exit':
          routerRef.current.push(backHref);
          return;
        default:
          break;
      }
      if (next.answer?.segments?.length) {
        setAnswer({ segments: next.answer.segments, key: Date.now() });
        return;
      }
      if (spoken && !next.node) carryOn();
    },
    [openWindow, readChoicesAgain, carryOn, backHref]
  );

  /** One turn: busy answers resend the same turn (same `turn_id` and version), at most 5 times. */
  const runTurn = useCallback(
    async (post: PostTurn, spoken: boolean, retry?: { turnId: string; version: number }) => {
      const current = respRef.current;
      if (!current?.save_version && current?.save_version !== 0) return;
      const turnId = retry?.turnId ?? newRadioRequestId('turn');
      const version = retry?.version ?? current.save_version;
      setInFlight(true);
      setFailedTurn(null);
      for (let busy = 0; busy <= TURN_BUSY_LIMIT; busy += 1) {
        const res = await post(turnId, version);
        if (res.success && res.data) {
          setInFlight(false);
          afterAnswer(res.data, spoken, accept(res.data));
          return;
        }
        if (res.status === 503 && res.errorCode === 'busy' && busy < TURN_BUSY_LIMIT) {
          await sleep(Math.max(1, res.retryAfter ?? 1) * 1000);
          continue;
        }
        setInFlight(false);
        if (closedOrMissing(res.status, res.errorCode, radioAccessOf(res))) return;
        if (res.status === 409 && (res.errorCode === 'save_conflict' || res.errorCode === 'save_inactive')) {
          // The story moved on elsewhere: the server's version wins; what was said or tapped is dropped.
          toastRef.current(tRef.current('notice.synced'));
          await reload();
          return;
        }
        if (spoken && res.status === 503 && res.errorCode === 'feature_disabled_in_region') {
          // No voice input in the region: for the rest of the session, choices are tapped.
          setAsrOff(true);
          voiceRef.current = { ...voiceRef.current, micUnavailable: 'region' };
          toastRef.current(tRef.current('mic.regionDisabled'));
          carryOn();
          return;
        }
        setFailedTurn({ turnId, version, post, spoken });
        return;
      }
    },
    [accept, afterAnswer, closedOrMissing, reload, carryOn]
  );

  const sendTurn = useCallback(
    (input: RadioTurnInput) => runTurn((turnId, version) => postRadioTurn(saveId, turnId, version, input), false),
    [runTurn, saveId]
  );
  const sendTurnRef = useRef(sendTurn);
  sendTurnRef.current = sendTurn;

  pauseForNoResponseRef.current = () => {
    strikes.current = 0;
    void sendTurn({ kind: 'command', command: 'pause', reason: 'no_response' });
  };

  onSilenceRef.current = () => {
    // Two-strike rule: the first silence reads the choices again; the second pauses the story.
    strikes.current += 1;
    if (strikes.current >= 2) pauseForNoResponseRef.current();
    else readChoicesAgain();
  };

  onRecordedRef.current = (audio, durationMs, mime) => {
    const position = spokenAt.current;
    const fileName = recordingFileName(mime);
    void runTurn(
      (turnId, version) => postRadioTurnAudio(saveId, { turnId, saveVersion: version, position }, audio, durationMs, fileName),
      true
    );
  };

  // While a request is in flight: after 10 seconds `states.slow` appears.
  useEffect(() => {
    if (!inFlight) {
      setSlow(false);
      return;
    }
    const id = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(id);
  }, [inFlight]);

  // "Not understood" and "Can't take that" go after 3 seconds; "Tap instead" stays.
  useEffect(() => {
    if (!voiceLine || voiceLine.sticky) return;
    const id = setTimeout(() => setVoiceLine(null), VOICE_LINE_MS);
    return () => clearTimeout(id);
  }, [voiceLine]);

  // The microphone never stays open while the screen cannot be seen.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') micRef.current.cancel();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  /** Saves "Listen at choices" (`PATCH prefs`); busy is resent, at most 5 times. */
  const saveListen = useCallback(async (on: boolean, previous: boolean | null | undefined) => {
    for (let busy = 0; busy <= PREFS_BUSY_LIMIT; busy += 1) {
      const res = await patchRadioPrefs({ listen_window_on: on });
      if (res.success) return;
      if (res.status === 503 && res.errorCode === 'busy' && busy < PREFS_BUSY_LIMIT) {
        await sleep(Math.max(1, res.retryAfter ?? 1) * 1000);
        continue;
      }
      break;
    }
    toastRef.current(tRef.current('settings.saveFailed'));
    setListenOn(previous ?? null);
  }, []);

  const onConsentAllow = async () => {
    tappedHere.current = true;
    setConsentOpen(false);
    const previous = listenOn;
    setListenOn(true);
    voiceRef.current = { ...voiceRef.current, listenOn: true };
    void saveListen(true, previous);
    // Only now is the system asked, in the same tap, so the listen window can hear.
    const windowMs = respRef.current?.listen_window_ms ?? DEFAULT_LISTEN_WINDOW_MS;
    spokenAt.current = null;
    noteOpen(await mic.open({ windowMs }), false);
  };

  const onConsentDeny = () => {
    setConsentOpen(false);
    const previous = listenOn;
    setListenOn(false);
    void saveListen(false, previous);
    showLine(t('mic.denied'));
  };

  const onMicTap = async () => {
    tappedHere.current = true;
    if (inFlight) return; // taps while working are ignored, never queued
    if (mic.state === 'window') {
      mic.record();
      return;
    }
    if (mic.state !== 'idle') return;
    if (micUnavailable === 'region') {
      showToast(t('mic.regionDisabled'));
      return;
    }
    if (micUnavailable === 'no_device') {
      showToast(t('mic.noDevice'));
      return;
    }
    // Ready, tap-only (asks: the user's own action) or blocked (tries again; the help if still blocked).
    wasPlaying.current = player.playing || answerPlayer.playing;
    const idx = player.index;
    spokenAt.current = !player.done && idx < segLen && segments[idx] ? { seq: segments[idx].seq } : null;
    player.pause();
    answerPlayer.pause();
    const r = await mic.open();
    noteOpen(r, true);
    if (r !== 'ok' && wasPlaying.current) player.play();
  };

  const onMicCancel = () => {
    mic.cancel();
    carryOn();
  };

  const onChoice = (choiceId: string) => {
    tappedHere.current = true;
    mic.cancel(); // tapping a choice while recording discards the recording and sends the tap
    setVoiceLine(null);
    setPaused(false);
    player.pause();
    void sendTurn({ kind: 'choice', choice_id: choiceId });
  };

  const onContinue = () => {
    tappedHere.current = true;
    setPaused(false);
    setCare(null);
    strikes.current = 0;
    voiceRef.current = { ...voiceRef.current, paused: false, care: null };
    if (atChoicePoint()) readChoicesAgain();
    else player.play();
  };

  const onPlay = () => {
    tappedHere.current = true;
    mic.cancel();
    if (paused) onContinue();
    else player.play();
  };

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

  const allSilent = captions.length > 0 && captions.every((s) => !s.audioUrl && !s.pending);
  const ended = node.node_type === 'ending';
  const readingChoice = player.playing && player.index >= segLen ? player.index - segLen : -1;
  const micOn = mic.state === 'window' || mic.state === 'recording';
  const platform =
    typeof navigator !== 'undefined'
      ? blockedHelpPlatform(navigator.userAgent, { telegram: isTelegramWebApp(), maxTouchPoints: navigator.maxTouchPoints })
      : 'desktop';

  return (
    <div
      className="h-full"
      onPointerDownCapture={() => (tappedHere.current = true)}
      onKeyDownCapture={() => (tappedHere.current = true)}
    >
      <ListeningIndicator on={micOn} />
      <PlayerShell
        back={back}
        title={t('player.title')}
        footer={
          <div className="flex flex-col items-center gap-3">
            {!ended ? (
              <MicButton
                state={micButtonState({ mic: mic.state, inFlight, unavailable: micUnavailable !== null })}
                level={mic.level}
                windowMs={resp?.listen_window_ms ?? null}
                choiceCount={choices.length}
                slow={slow}
                onTap={() => void onMicTap()}
                onDone={mic.done}
                onCancel={onMicCancel}
              />
            ) : null}
            <PlayerControls
              playing={player.playing || answerPlayer.playing}
              disabled={inFlight}
              speed={speed}
              onPlay={onPlay}
              onPause={() => {
                player.pause();
                answerPlayer.pause();
              }}
              onRepeat={player.repeat}
              onSpeed={setSpeed}
            />
          </div>
        }
      >
        {allSilent ? <p className="mb-3 text-xs text-workspace-secondary" data-testid="radio-tts-failed">{t('tts.failed')}</p> : null}
        {paused ? (
          <div role="status" data-testid="radio-paused" className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-gray-100 p-3 text-sm">
            <span>{t('notice.paused')}</span>
            {!care ? (
              <button type="button" onClick={onContinue} className="rounded-lg bg-primary px-3 py-1.5 text-white" data-testid="radio-continue">
                {t('player.continue')}
              </button>
            ) : null}
          </div>
        ) : null}
        <Captions sentences={captions} activeIndex={Math.min(player.index, Math.max(0, segLen - 1))} playing={player.playing && player.index < segLen} />

        {answer ? (
          <ol className="mt-3 flex flex-col gap-2" data-testid="radio-answer">
            {answerSentences.map((s, i) => (
              <li
                key={`${s.seq}-${i}`}
                className={cn(
                  'rounded-lg border-l-4 border-primary/40 px-3 py-2 text-base leading-relaxed',
                  i === answerPlayer.index ? 'bg-primary/10 text-workspace-text' : 'text-workspace-secondary'
                )}
              >
                {s.text}
              </li>
            ))}
          </ol>
        ) : null}

        {care ? (
          <div role="alertdialog" aria-live="assertive" data-testid="radio-care" className="mt-4 rounded-xl border border-gray-300 bg-white p-4 text-sm text-workspace-text shadow-sm">
            <p className="whitespace-pre-line">{care.text}</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={onContinue} className="flex-1 rounded-lg border border-gray-300 px-3 py-2">
                {t('notice.keepListening')}
              </button>
              <button type="button" onClick={() => setCare(null)} className="flex-1 rounded-lg border border-gray-300 px-3 py-2">
                {t('notice.close')}
              </button>
            </div>
          </div>
        ) : null}

        {notice?.text ? (
          <div role="status" data-testid="radio-notice" className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p>{notice.text}</p>
            <button type="button" onClick={() => setNotice(null)} className="shrink-0 text-xs underline">
              {t('notice.close')}
            </button>
          </div>
        ) : null}

        {voiceLine?.text ? (
          <p role="status" data-testid="radio-voice-line" className="mt-4 text-sm text-workspace-secondary">
            {voiceLine.text}
          </p>
        ) : null}

        {consentOpen ? <ConsentCard onAllow={() => void onConsentAllow()} onDeny={onConsentDeny} /> : null}

        {choices.length > 0 ? (
          <div className="mt-4 flex flex-col gap-2" data-testid="radio-choices">
            {choices.map((c, i) => (
              <button
                key={c.choice_id}
                type="button"
                disabled={inFlight}
                onClick={() => onChoice(c.choice_id)}
                aria-label={t('player.choice', { key: c.key, label: c.label ?? '' })}
                data-testid="radio-choice"
                data-reading={i === readingChoice ? 'true' : undefined}
                className={cn(
                  'flex min-h-14 items-center gap-3 rounded-xl border bg-white px-4 py-3 text-left hover:border-primary disabled:opacity-60',
                  i === readingChoice ? 'border-primary bg-primary/5' : 'border-gray-200'
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
              onClick={() => void runTurn(failedTurn.post, failedTurn.spoken, { turnId: failedTurn.turnId, version: failedTurn.version })}
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
      {helpOpen ? <BlockedHelpDialog platform={platform} onClose={() => setHelpOpen(false)} /> : null}
    </div>
  );
}
