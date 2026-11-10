'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Mic, MicOff } from 'lucide-react';

import { BlockedHelpDialog, ListeningIndicator } from '@/components/radio/voice-parts';
import { useLiveMic } from '@/hooks/use-live-mic';
import { useSentencePlayer, type PlayableSentence, type PlayerSpeed } from '@/hooks/use-sentence-player';
import { buildClinicHubHref } from '@/lib/hub-entry';
import { getLiveTurn, getLiveUpgrade, isRadioAudienceCode, postLiveClose, sendLiveEnd } from '@/lib/radio/live-api';
import { LIVE_NOTICE_MS, newLiveTurnId, splitKeyWord } from '@/lib/radio/live-recording';
import { liveAudioElement, takeStartedLiveSession, type StartedLiveSession } from '@/lib/radio/live-session';
import { LiveEventQueue } from '@/lib/radio/live-events';
import { LiveTurnUpload } from '@/lib/radio/live-uploader';
import { radioHomeHref } from '@/lib/radio/routes';
import { SLOW_AFTER_MS, blockedHelpPlatform } from '@/lib/radio/voice';
import { getTelegramWebApp, isTelegramWebApp } from '@/lib/telegram';
import { cn } from '@/lib/utils';
import type { ApiResponse } from '@/types';
import type { LiveCard, LiveLang, LiveNotice, LivePart, LiveTurn, LiveUpgrade } from '@/types/radio-live';

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

/** The English part plays its lines again at this speed (pitch kept), done by the app. */
export const LIVE_SLOW_SPEED: PlayerSpeed = 0.75;
/** `upgrade` answered `pending` with no `retry_after_ms`, or the network failed: ask again after this. */
export const LIVE_UPGRADE_RETRY_MS = 1_500;
/** Network failures on `upgrade` / `close` before the app gives up on that part. */
export const LIVE_FETCH_TRIES = 4;

/**
 * Where a replayed line was, for `live_replay` (live-room.md, Playback events): `reply`, `upgrade` or
 * `closing`. The opening, the ack and the handover are none of these, so their replays are not reported.
 */
export function livePartOf(kind: string): LivePart | null {
  if (kind === 'reply' || kind === 'upgrade' || kind === 'closing') return kind;
  return null;
}

/** `ended` codes after which the closing follows (live-room.md, Answers). */
const CLOSING_AFTER_ENDED = new Set(['asr_failed', 'retry_limit']);

type PartKind = 'opening' | 'ack' | 'reply' | 'handover' | 'upgrade' | 'closing';
interface PartLine {
  seq: number;
  text: string;
  lang?: LiveLang | null;
  audioUrl: string | null;
  pending: boolean;
}
interface Part {
  key: number;
  kind: PartKind;
  lines: PartLine[];
  speed: PlayerSpeed;
  /** Lines added to the captions as they play (the slow replay of the English part adds none). */
  caption: boolean;
  /** For `reply`: the answer's turn, to fetch `pending` audio, and whether the English part follows. */
  turnId?: string;
  final?: boolean;
}

/**
 * Where the session is:
 * - `talk`: the host is speaking or waiting; the microphone may be tapped (the opening, the answers);
 * - `recording`, `waiting` (the last piece is in flight, the ack plays);
 * - `english` (the English part), `closing` (the closing lines), `card` (the end card);
 * - `over`: ended without a closing (`radio.live.done` goes home);
 * - `care`, `unavailable`: a card that covers the screen.
 */
type Phase = 'talk' | 'recording' | 'waiting' | 'english' | 'closing' | 'card' | 'over' | 'care' | 'unavailable';
type MicBlock = null | 'blocked' | 'no_device';

/**
 * The Live screen (KAZI-1287; kazispace-ui live-room.md, Screens and back · The Live screen · Care).
 *
 * Leaving ends the session: End, back, switching destination or closing the tab stop the voice and the
 * microphone at once and send `POST end`, never waited for. Nothing asks "are you sure?".
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
  return <LiveSessionView started={started} homeHref={homeHref} studioHref={buildClinicHubHref(locale)} />;
}

function LiveSessionView({ started, homeHref, studioHref }: { started: StartedLiveSession; homeHref: string; studioHref: string }) {
  const t = useTranslations('radio.live');
  const tMic = useTranslations('radio.mic');
  const tNotice = useTranslations('radio.notice');
  const tStates = useTranslations('states');
  const router = useRouter();
  const { session, host } = started;
  const sessionId = session.session_id;
  const limits = session.limits;

  const [phase, setPhase] = useState<Phase>('talk');
  const [history, setHistory] = useState<LiveCaption[]>([]);
  const [part, setPart] = useState<Part>(() => ({
    key: 1,
    kind: 'opening',
    speed: 1,
    caption: true,
    lines: [...session.opening]
      .sort((a, b) => a.seq - b.seq)
      .map((s) => ({ seq: s.seq, text: s.text, lang: s.lang, audioUrl: s.audio_url ?? null, pending: s.pending ?? false })),
  }));
  const [line, setLine] = useState<string | null>(null);
  const [care, setCare] = useState<LiveNotice | null>(null);
  const [card, setCard] = useState<LiveCard | null>(null);
  const [upgrade, setUpgrade] = useState<LiveUpgrade | null>(null);
  const [waitingEnglish, setWaitingEnglish] = useState(false);
  const [bubble, setBubble] = useState(false);
  const [slow, setSlow] = useState(false);
  const [micBlock, setMicBlock] = useState<MicBlock>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const routerRef = useRef(router);
  routerRef.current = router;
  const partKey = useRef(1);
  const turnId = useRef(newLiveTurnId());
  const upload = useRef<LiveTurnUpload | null>(null);
  const over = useRef(false);
  const afterAck = useRef<(() => void) | null>(null);
  const upgradeRef = useRef<LiveUpgrade | null>(null);
  const englishDone = useRef<(() => void) | null>(null);
  const closeSent = useRef(false);
  const fetchedTurn = useRef<string | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // ---- Ending: once, whichever way the user leaves. `pagehide` because closing a tab never unmounts.
  // Playback events: sent when the session ends and when the app goes to the background.
  const events = useRef<LiveEventQueue | null>(null);
  if (!events.current) events.current = new LiveEventQueue(sessionId);

  const endedRef = useRef(false);
  useEffect(() => {
    const end = () => {
      if (endedRef.current) return;
      endedRef.current = true;
      over.current = true;
      upload.current?.stop();
      events.current?.flush();
      sendLiveEnd(sessionId);
    };
    window.addEventListener('pagehide', end);
    return () => {
      window.removeEventListener('pagehide', end);
      end();
    };
  }, [sessionId]);

  const goHome = useCallback(() => routerRef.current.replace(homeHref), [homeHref]);

  // ---- Playing host lines.
  const sentences: PlayableSentence[] = useMemo(
    () => part.lines.map((l) => ({ seq: l.seq, text: l.text, audioUrl: l.audioUrl, pending: l.pending })),
    [part.lines]
  );
  const onPartDone = useRef<() => void>(() => undefined);
  const player = useSentencePlayer({
    sentences,
    speed: part.speed,
    autoplay: true,
    partKey: part.key,
    element: liveAudioElement(),
    onDone: () => onPartDone.current(),
  });
  const playerRef = useRef(player);
  playerRef.current = player;

  const partRef = useRef(part);
  partRef.current = part;
  const kept = useRef(new Set<number>());

  // A part's lines join the captions when it finishes, or, when a tap cuts it short, the lines it reached.
  const keepCaptions = useCallback((p: Part, count: number) => {
    if (!p.caption || kept.current.has(p.key)) return;
    kept.current.add(p.key);
    const lines = p.lines.slice(0, count);
    if (lines.length) setHistory((h) => [...h, ...lines.map((l) => ({ key: `${p.key}-${l.seq}`, text: l.text, lang: l.lang }))]);
  }, []);

  const play = useCallback(
    (p: Omit<Part, 'key'>) => {
      const prev = partRef.current;
      keepCaptions(prev, playerRef.current.done ? prev.lines.length : Math.min(prev.lines.length, playerRef.current.index + 1));
      partKey.current += 1;
      setPart({ ...p, key: partKey.current });
    },
    [keepCaptions]
  );
  const addCaption = useCallback((text: string) => {
    partKey.current += 1;
    setHistory((h) => [...h, { key: `note-${partKey.current}`, text }]);
  }, []);

  // ---- The closing and the end card.
  const toClosing = useCallback(async () => {
    if (closeSent.current || over.current) return;
    closeSent.current = true;
    setPhase('closing');
    let res = await postLiveClose(sessionId);
    for (let i = 1; i < LIVE_FETCH_TRIES && !res.success && res.errorCode === 'NETWORK_ERROR' && !over.current; i += 1) {
      await new Promise((r) => setTimeout(r, LIVE_UPGRADE_RETRY_MS));
      res = await postLiveClose(sessionId);
    }
    if (over.current) return;
    if (!res.success || !res.data) {
      // `409 live_no_closing`, a closing that cannot be read: the end card with Done only.
      setCard(null);
      setPhase('card');
      return;
    }
    const data = res.data;
    setCard(data.card ?? null);
    const lines = [...data.closing].sort((a, b) => a.seq - b.seq);
    if (!lines.length) {
      setPhase('card');
      return;
    }
    play({
      kind: 'closing',
      speed: 1,
      caption: true,
      lines: lines.map((l) => ({ seq: l.seq, text: l.text, lang: l.lang, audioUrl: l.audio_url ?? null, pending: l.pending ?? false })),
    });
  }, [play, sessionId]);

  // ---- Care: the voice stops, the microphone stays off, a card that stays.
  const toCare = useCallback((n: LiveNotice) => {
    over.current = true;
    upload.current?.stop();
    playerRef.current.pause();
    setCare(n);
    setPhase('care');
  }, []);

  // ---- The English part.
  const upgradeAsked = useRef(false);
  const fetchUpgrade = useCallback(async () => {
    let tries = 0;
    while (!over.current) {
      const res: ApiResponse<LiveUpgrade> = await getLiveUpgrade(sessionId);
      if (over.current) return;
      if (res.success && res.data) {
        if (res.data.status !== 'pending') {
          upgradeRef.current = res.data;
          setUpgrade(res.data);
          englishDone.current?.();
          return;
        }
        await new Promise((r) => setTimeout(r, res.data?.retry_after_ms ?? LIVE_UPGRADE_RETRY_MS));
        continue;
      }
      tries += 1;
      if (res.errorCode !== 'NETWORK_ERROR' || tries >= LIVE_FETCH_TRIES) {
        // Any other answer: no English part this time; straight to the closing.
        upgradeRef.current = { status: 'skipped' };
        setUpgrade(upgradeRef.current);
        englishDone.current?.();
        return;
      }
      await new Promise((r) => setTimeout(r, LIVE_UPGRADE_RETRY_MS));
    }
  }, [sessionId]);

  /** The last turn's answer: the English part is asked for at once, so it is usually ready when the host stops. */
  const askUpgrade = useCallback(() => {
    if (upgradeAsked.current) return;
    upgradeAsked.current = true;
    void fetchUpgrade();
  }, [fetchUpgrade]);

  const playEnglish = useCallback(
    (u: LiveUpgrade) => {
      setWaitingEnglish(false);
      if (u.status === 'skipped') {
        // With a notice, the session ended for the user's safety. Nothing says a part was skipped.
        if (u.notice) toCare(u.notice);
        else void toClosing();
        return;
      }
      setPhase('english');
      const lines = [...(u.lines ?? [])].sort((a, b) => a.seq - b.seq);
      const english = lines.map((l) => ({ seq: l.seq, text: l.text, lang: 'en' as const, audioUrl: l.audio_url ?? null, pending: false }));
      const playLines = () => play({ kind: 'upgrade', speed: 1, caption: true, lines: english });
      if (u.handover?.text) {
        play({
          kind: 'handover',
          speed: 1,
          caption: true,
          lines: [{ seq: 1, text: u.handover.text, lang: 'en', audioUrl: u.handover.audio_url ?? null, pending: false }],
        });
        englishNext.current = playLines;
      } else {
        playLines();
      }
    },
    [play, toCare, toClosing]
  );
  const englishNext = useRef<(() => void) | null>(null);

  const startEnglish = useCallback(() => {
    const u = upgradeRef.current;
    if (u) {
      playEnglish(u);
      return;
    }
    // Not ready yet: "…" on screen, never a blank one; it plays as soon as it is.
    setWaitingEnglish(true);
    setPhase('english');
    englishDone.current = () => {
      englishDone.current = null;
      if (upgradeRef.current) playEnglish(upgradeRef.current);
    };
  }, [playEnglish]);

  const slower = useCallback(() => {
    const u = upgradeRef.current;
    if (!u?.lines?.length || phaseRef.current !== 'english') return;
    const english = [...u.lines]
      .sort((a, b) => a.seq - b.seq)
      .map((l) => ({ seq: l.seq, text: l.text, lang: 'en' as const, audioUrl: l.audio_url ?? null, pending: false }));
    play({ kind: 'upgrade', speed: LIVE_SLOW_SPEED, caption: false, lines: english });
  }, [play]);

  // ---- What happens when a part has played.
  onPartDone.current = () => {
    const p = part;
    keepCaptions(p, p.lines.length);
    if (over.current) return;
    if (p.kind === 'ack') {
      const next = afterAck.current;
      afterAck.current = null;
      next?.();
      return;
    }
    if (p.kind === 'reply') {
      if (p.final) startEnglish();
      return;
    }
    if (p.kind === 'handover') {
      const next = englishNext.current;
      englishNext.current = null;
      next?.();
      return;
    }
    if (p.kind === 'upgrade') {
      if (p.speed === 1 && p.caption) {
        // Then the lines once more at 0.75×, then the closing.
        slower();
        return;
      }
      void toClosing();
      return;
    }
    if (p.kind === 'closing') setPhase('card');
  };

  // An answer with `pending` lines: ask once, when its first line starts playing.
  useEffect(() => {
    if (part.kind !== 'reply' || !part.turnId || !part.lines.some((l) => l.pending)) return;
    if (fetchedTurn.current === part.turnId) return;
    fetchedTurn.current = part.turnId;
    const key = part.key;
    void getLiveTurn(sessionId, part.turnId).then((res) => {
      if (!res.success || !res.data || over.current) return;
      const byseq = new Map(res.data.segments.map((s) => [s.seq, s]));
      setPart((p) =>
        p.key !== key
          ? p
          : {
              ...p,
              lines: p.lines.map((l) => {
                const s = byseq.get(l.seq);
                return s && s.audio_url ? { ...l, audioUrl: s.audio_url, pending: false } : { ...l, pending: false };
              }),
            }
      );
    });
  }, [part, sessionId]);

  // ---- An answer to the last piece.
  const handleAnswer = useCallback(
    (res: ApiResponse<LiveTurn | { received: number }>) => {
      if (over.current) return;
      setSlow(false);
      if (res.success && res.data && 'kind' in res.data) {
        const turn = res.data;
        const n = turn.notice ?? null;
        if (turn.kind === 'crisis') {
          toCare(n ?? { kind: 'paused', code: 'crisis', text: '' });
          return;
        }
        if (turn.kind === 'retry') {
          // Spoken by nobody; the microphone is ready again for the same turn, with a new turn_id.
          setLine(n?.text ?? null);
          setPhase('talk');
          return;
        }
        if (turn.kind === 'ended' || turn.kind === 'limit') {
          if (n?.text) addCaption(n.text);
          if (turn.kind === 'limit' || (n && (n.kind === 'quota' || CLOSING_AFTER_ENDED.has(n.code)))) {
            void toClosing();
          } else {
            over.current = true;
            setPhase('over');
          }
          return;
        }
        const final = turn.kind === 'final';
        if (final) askUpgrade();
        setPhase(final ? 'english' : 'talk');
        play({
          kind: 'reply',
          speed: 1,
          caption: true,
          turnId: turn.turn_id,
          final,
          lines: [...turn.segments]
            .sort((a, b) => a.seq - b.seq)
            .map((s) => ({ seq: s.seq, text: s.text, audioUrl: s.audio_url ?? null, pending: s.pending })),
        });
        return;
      }
      if (res.status === 409 && (res.errorCode === 'live_session_ended' || res.errorCode === 'live_session_not_found')) {
        over.current = true;
        addCaption(t('sessionEnded'));
        setPhase('over');
        return;
      }
      if (res.status === 409 || res.status === 422) {
        // `live_wrong_state`, `invalid_request`: a bug. Nothing more is fetched; the session ends.
        over.current = true;
        goHome();
        return;
      }
      if (res.status === 403 && isRadioAudienceCode(res.errorCode)) {
        over.current = true;
        routerRef.current.replace(studioHref);
        return;
      }
      if (res.status === 404) {
        over.current = true;
        goHome();
        return;
      }
      // `503 live_unavailable`, or the network failed after its retries.
      over.current = true;
      playerRef.current.pause();
      setPhase('unavailable');
    },
    [addCaption, askUpgrade, goHome, play, studioHref, t, toCare, toClosing]
  );

  // ---- Recording.
  const mic = useLiveMic({
    limits,
    onPiece: (seq, audio, durationMs) => upload.current?.addPiece(seq, audio, durationMs),
    onFinal: (seq, audio, durationMs) => {
      const up = upload.current;
      if (!up || over.current) return;
      setPhase('waiting');
      // One of the acks plays at once, while the answer comes.
      const ack = session.acks.length ? session.acks[Math.floor(Math.random() * session.acks.length)] : null;
      let answer: ApiResponse<LiveTurn | { received: number }> | null = null;
      let ackDone = !ack;
      const settle = () => {
        if (answer && ackDone) handleAnswer(answer);
      };
      if (ack) {
        afterAck.current = () => {
          ackDone = true;
          settle();
        };
        play({ kind: 'ack', speed: 1, caption: false, lines: [{ seq: 1, text: ack.text, audioUrl: ack.audio_url ?? null, pending: false }] });
      }
      void up.finish(seq, audio, durationMs).then((res) => {
        answer = res;
        // Not waiting for the ack to finish: the English part can be made while it plays.
        if (res.success && res.data && 'kind' in res.data && res.data.kind === 'final' && !over.current) askUpgrade();
        settle();
      });
    },
  });
  const micRef = useRef(mic);
  micRef.current = mic;

  const tapMic = useCallback(async () => {
    if (phaseRef.current !== 'talk' || over.current) return;
    if (micBlock === 'blocked') {
      setHelpOpen(true);
      return;
    }
    if (micBlock) return;
    // The host stops at once and recording starts.
    playerRef.current.pause();
    setLine(null);
    const opened = await micRef.current.open();
    if (opened !== 'ok') {
      setMicBlock(opened);
      return;
    }
    if (over.current) return;
    turnId.current = newLiveTurnId();
    upload.current = new LiveTurnUpload({ sessionId, turnId: turnId.current, mime: '' });
    setPhase('recording');
  }, [micBlock, sessionId]);

  // A `retry` line goes after 3 seconds.
  useEffect(() => {
    if (!line) return;
    const id = setTimeout(() => setLine(null), LIVE_NOTICE_MS);
    return () => clearTimeout(id);
  }, [line]);

  // Working: `states.slow` after 10 seconds.
  useEffect(() => {
    if (phase !== 'waiting') return;
    const id = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(id);
  }, [phase]);

  // Going to the background: a recording is sent as if Done; otherwise the voice pauses, and resumes on return.
  const pausedByHide = useRef(false);
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        events.current?.flush();
        if (micRef.current.state === 'recording') {
          micRef.current.done();
        } else if (playerRef.current.playing) {
          pausedByHide.current = true;
          playerRef.current.pause();
        }
      } else if (pausedByHide.current) {
        pausedByHide.current = false;
        if (phaseRef.current !== 'care' && phaseRef.current !== 'unavailable') playerRef.current.play();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Focus moves to the care card and the "unavailable" card when they appear.
  const coverRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (phase === 'care' || phase === 'unavailable') coverRef.current?.focus();
  }, [phase]);

  const end = useCallback(() => {
    // The voice and the microphone stop in the same moment as the tap; the rest happens on unmount.
    over.current = true;
    playerRef.current.pause();
    goHome();
  }, [goHome]);

  /** Replay the current line, reported with where it was (`reply`, `upgrade` or `closing`) and its seq. */
  const replay = () => {
    const p = partRef.current;
    const where = livePartOf(p.kind);
    const lineSeq = p.lines[Math.min(playerRef.current.index, p.lines.length - 1)]?.seq;
    if (where && lineSeq !== undefined) events.current?.add('live_replay', where, lineSeq);
    playerRef.current.repeat();
  };

  // Telegram's back button is End (Platform notes).
  const endRef = useRef(end);
  endRef.current = end;
  useEffect(() => {
    if (!isTelegramWebApp()) return;
    const back = getTelegramWebApp()?.BackButton;
    if (!back) return;
    const onBack = () => endRef.current();
    back.onClick(onBack);
    back.show();
    return () => {
      back.offClick(onBack);
      back.hide();
    };
  }, []);

  // The lock screen controls: the host's name, pause and stop only; stop ends the session.
  useEffect(() => {
    const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
    if (!ms) return;
    if (typeof MediaMetadata !== 'undefined') ms.metadata = new MediaMetadata({ title: host.name, artist: t('aiLabel') });
    const set = (action: MediaSessionAction, fn: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(action, fn);
      } catch {
        // An action this browser does not know.
      }
    };
    set('pause', () => playerRef.current.pause());
    set('play', () => playerRef.current.play());
    set('stop', () => endRef.current());
    for (const a of ['previoustrack', 'nexttrack', 'seekbackward', 'seekforward', 'seekto'] as MediaSessionAction[]) set(a, null);
    return () => {
      for (const a of ['pause', 'play', 'stop'] as MediaSessionAction[]) set(a, null);
      ms.metadata = null;
    };
  }, [host.name, t]);

  // ---- What is on screen.
  // A part already moved to the history is not drawn twice.
  const current: LiveCaption[] = part.caption && !kept.current.has(part.key)
    ? part.lines.slice(0, Math.min(part.lines.length, player.index + 1)).map((l) => ({ key: `${part.key}-${l.seq}`, text: l.text, lang: l.lang }))
    : [];
  const captions = [...history, ...current];
  const activeKey = part.caption && player.playing ? `${part.key}-${part.lines[player.index]?.seq}` : null;
  const englishLines = upgrade?.status === 'ready' ? [...(upgrade.lines ?? [])].sort((a, b) => a.seq - b.seq) : [];
  const showSentence = phase === 'english' && englishLines.length > 0 && (part.kind === 'upgrade' || part.kind === 'handover');
  const micOpen = phase === 'talk' && !micBlock;

  return (
    <div className="flex h-full flex-col bg-gray-50" data-testid="radio-live-screen" data-phase={phase}>
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
      <ListeningIndicator on={mic.state === 'recording'} />

      <main className="flex-1 overflow-y-auto px-4 py-4">
        <ol className="mx-auto flex max-w-2xl flex-col gap-3" data-testid="radio-live-captions" aria-live="polite">
          {captions.map((c) => (
            <li
              key={c.key}
              lang={captionLang(c.lang)}
              data-testid="radio-live-caption"
              aria-current={c.key === activeKey ? 'true' : undefined}
              className={cn(
                'rounded-xl px-3 py-2 text-base leading-relaxed',
                c.key === activeKey ? 'bg-white font-medium text-workspace-text shadow-sm' : 'text-workspace-secondary'
              )}
            >
              {c.text}
            </li>
          ))}
          {waitingEnglish ? (
            <li data-testid="radio-live-english-waiting" className="px-3 py-2 text-base text-workspace-secondary" aria-label={tStates('slow')}>
              …
            </li>
          ) : null}
        </ol>

        {showSentence ? (
          <section className="mx-auto mt-4 max-w-2xl rounded-xl border border-primary/30 bg-white p-4" data-testid="radio-live-your-sentence">
            <h2 className="text-xs font-semibold text-workspace-muted">{t('yourSentence')}</h2>
            {englishLines.map((l) => (
              <p key={l.seq} lang="en" className="mt-2 text-lg leading-relaxed text-workspace-text">
                {splitKeyWord(l.text, upgrade?.key_word).map((piece, i) =>
                  piece.key ? (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        events.current?.add('live_key_word_tap', 'upgrade');
                        setBubble((b) => !b);
                      }}
                      aria-expanded={bubble}
                      data-testid="radio-live-key-word"
                      className="font-bold underline underline-offset-4"
                    >
                      {piece.text}
                    </button>
                  ) : (
                    <span key={i}>{piece.text}</span>
                  )
                )}
              </p>
            ))}
            {bubble && upgrade?.key_word_zh ? (
              <p role="status" lang="zh" data-testid="radio-live-key-word-zh" className="mt-2 inline-block rounded-lg bg-gray-900 px-3 py-1.5 text-sm text-white">
                {upgrade.key_word_zh}
              </p>
            ) : null}
          </section>
        ) : null}
      </main>

      <footer className="border-t border-gray-200 bg-white px-4 py-3">
        {phase === 'card' ? (
          <EndCard card={card} onDone={goHome} />
        ) : phase === 'over' ? (
          <div className="flex justify-center">
            <button type="button" onClick={goHome} data-testid="radio-live-done" className="min-h-11 rounded-lg bg-primary px-6 text-sm font-medium text-white">
              {t('done')}
            </button>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-2">
            {line ? (
              <p role="status" data-testid="radio-live-line" className="text-sm text-workspace-secondary">
                {line}
              </p>
            ) : null}
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={replay}
                disabled={phase === 'recording' || phase === 'waiting'}
                data-testid="radio-live-replay"
                className="min-h-11 rounded-lg border border-gray-300 px-4 text-sm disabled:opacity-50"
              >
                {t('replay')}
              </button>
              <LiveMicButton
                phase={phase}
                open={micOpen}
                block={micBlock}
                slow={slow}
                onTap={() => void tapMic()}
                onDone={() => micRef.current.done()}
                labels={{ talk: t('mic.talk'), done: t('mic.done'), slow: tStates('slow'), blocked: tMic('blockedHelp.title'), unavailable: t('unavailable') }}
              />
              {phase === 'english' && englishLines.length ? (
                <button
                  type="button"
                  onClick={() => {
                    events.current?.add('live_slow', 'upgrade');
                    slower();
                  }}
                  data-testid="radio-live-slower" className="min-h-11 rounded-lg border border-gray-300 px-4 text-sm">
                  {t('slower')}
                </button>
              ) : null}
            </div>
            {phase === 'recording' && mic.secondsLeft !== null ? (
              <p data-testid="radio-live-remaining" className="text-sm font-medium text-workspace-text" aria-live={mic.secondsLeft === 10 ? 'polite' : 'off'}>
                {t('mic.remaining', { s: mic.secondsLeft })}
              </p>
            ) : null}
          </div>
        )}
      </footer>

      {phase === 'care' && care ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            ref={coverRef}
            tabIndex={-1}
            role="alertdialog"
            aria-modal="true"
            aria-describedby="radio-live-care-text"
            data-testid="radio-live-care"
            className="w-full max-w-md rounded-2xl bg-white p-5 outline-none"
          >
            <p id="radio-live-care-text" className="whitespace-pre-line text-base text-workspace-text">
              {care.text}
            </p>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={goHome} data-testid="radio-live-care-close" className="min-h-11 rounded-lg border border-gray-300 px-4 text-sm">
                {tNotice('close')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {phase === 'unavailable' ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div ref={coverRef} tabIndex={-1} role="alertdialog" aria-modal="true" data-testid="radio-live-unavailable" className="w-full max-w-sm rounded-2xl bg-white p-5 outline-none">
            <p className="text-sm text-workspace-text">{t('unavailable')}</p>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={goHome} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-white">
                {tNotice('gotIt')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {helpOpen ? (
        <BlockedHelpDialog
          platform={blockedHelpPlatform(typeof navigator !== 'undefined' ? navigator.userAgent : '', {
            telegram: isTelegramWebApp(),
            maxTouchPoints: typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0,
          })}
          onClose={() => setHelpOpen(false)}
        />
      ) : null}
    </div>
  );
}

/**
 * The microphone button (live-room.md, Recording): Tap to talk · Done while recording · a spinner while
 * the answer comes (`states.slow` after 10 s) · Unavailable when there is no microphone (blocked: a tap
 * opens the help). Disabled while the host is in the English part, the closing or the end card.
 */
function LiveMicButton({
  phase,
  open,
  block,
  slow,
  onTap,
  onDone,
  labels,
}: {
  phase: Phase;
  open: boolean;
  block: MicBlock;
  slow: boolean;
  onTap: () => void;
  onDone: () => void;
  labels: { talk: string; done: string; slow: string; blocked: string; unavailable: string };
}) {
  const ring = 'inline-flex min-h-16 min-w-16 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium';
  if (phase === 'recording') {
    return (
      <button type="button" onClick={onDone} data-testid="radio-live-mic" data-state="recording" className={cn(ring, 'bg-red-600 text-white')}>
        {labels.done}
      </button>
    );
  }
  if (phase === 'waiting') {
    return (
      <div className="flex flex-col items-center gap-1">
        <button type="button" disabled aria-busy="true" aria-label={labels.talk} data-testid="radio-live-mic" data-state="working" className={cn(ring, 'bg-gray-200 text-workspace-secondary')}>
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        </button>
        {slow ? <span data-testid="radio-live-slow" className="text-xs text-workspace-secondary">{labels.slow}</span> : null}
      </div>
    );
  }
  if (block) {
    return (
      <button
        type="button"
        onClick={onTap}
        disabled={block === 'no_device'}
        aria-label={block === 'blocked' ? labels.blocked : labels.unavailable}
        data-testid="radio-live-mic"
        data-state="unavailable"
        className={cn(ring, 'bg-gray-100 text-workspace-muted')}
      >
        <MicOff className="h-6 w-6" aria-hidden />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onTap}
      disabled={!open}
      data-testid="radio-live-mic"
      data-state={open ? 'ready' : 'off'}
      className={cn(ring, 'bg-primary text-white disabled:opacity-40')}
    >
      <Mic className="h-6 w-6" aria-hidden />
      {labels.talk}
    </button>
  );
}

/** The end card (live-room.md, Closing and the end card): shown once, not saved; `null` ⇒ Done only. */
function EndCard({ card, onDone }: { card: LiveCard | null; onDone: () => void }) {
  const t = useTranslations('radio.live');
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3" data-testid="radio-live-card">
      {card ? (
        <>
          <h2 className="text-sm font-semibold text-workspace-muted">{t('card.title')}</h2>
          <p lang="en" className="text-lg font-medium text-workspace-text" data-testid="radio-live-card-sentence">
            {card.sentence}
          </p>
          {card.key_word ? (
            <p data-testid="radio-live-card-key-word">
              <span lang="en" className="font-bold underline underline-offset-4">
                {card.key_word}
              </span>
              {card.key_word_zh ? (
                <span lang="zh" className="ml-2 text-sm text-workspace-secondary">
                  {card.key_word_zh}
                </span>
              ) : null}
            </p>
          ) : null}
          <p className="text-xs text-workspace-muted">{t('card.note')}</p>
        </>
      ) : null}
      <button type="button" onClick={onDone} data-testid="radio-live-done" className="min-h-11 self-center rounded-lg bg-primary px-6 text-sm font-medium text-white">
        {t('done')}
      </button>
    </div>
  );
}
