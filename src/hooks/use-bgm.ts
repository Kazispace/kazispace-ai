'use client';

import { useEffect, useRef, useState } from 'react';

import { getRadioBgm } from '@/lib/radio/player-api';
import { BGM_LEVEL_DEFAULT, BGM_LEVEL_MAX, BGM_LEVEL_MIN } from '@/lib/radio/settings';
import type { RadioBgmTrack } from '@/types/radio';

/**
 * The music's gain relative to the voice (the voice plays at 1.0): `10^(dB/20)`. `null` ⇒ −18 dB;
 * a stored level outside −30 … −12 dB is held to that range.
 */
export function bgmGain(levelDb: number | null | undefined): number {
  const db = levelDb == null || !Number.isFinite(levelDb) ? BGM_LEVEL_DEFAULT : Math.min(BGM_LEVEL_MAX, Math.max(BGM_LEVEL_MIN, levelDb));
  return Math.pow(10, db / 20);
}

// ── one audio context for the radio's music, shared across pages ────────────────────────────────
// Shared so that a tap on one page of the app keeps it unlocked on the next (iOS allows only a few
// contexts, and each new one starts locked). It is never closed.
let sharedContext: AudioContext | null = null;
let contextFailed = false;

type AudioContextCtor = typeof AudioContext;
function contextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** The shared context, made on first use; `null` where there is no Web Audio (then no music plays). */
function bgmContext(): AudioContext | null {
  if (sharedContext || contextFailed) return sharedContext;
  const Ctor = contextCtor();
  if (!Ctor) return null;
  try {
    sharedContext = new Ctor();
  } catch {
    contextFailed = true;
  }
  return sharedContext;
}

/** Tests only: forget the shared context. */
export function resetBgmContextForTests() {
  sharedContext = null;
  contextFailed = false;
}

// A tap unlocks the context. These are the events browsers count as the user's activation
// (a touch's `pointerdown` is not one of them on iOS, its `touchend` / `pointerup` / `click` are).
const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'] as const;

/**
 * Background music under the host's voice (KAZI-1212; kazispace-ui personal-radio.md, Player ·
 * Background music). Story page and program page only, never Live Room.
 *
 * - `enabled`: `GET home` has answered and `prefs.bgm_on` is not `false`. `GET bgm` is asked once
 *   per page, only when enabled and the browser has Web Audio; no tracks ⇒ nothing.
 * - `sessionKey`: one listening session (the same sessions as the AI label: a story visit, a program
 *   played). Each new key picks one track at random, played looped for the whole session.
 * - `voiced`: the voice is speaking a sentence that has audio right now (not the AI rhythm). The music
 *   starts the first time it is true in the session, and from then on plays unless `held`.
 * - `held`: the user paused, the microphone records, or the session is over (an ending, a program
 *   played to its end). The music pauses and resumes in place.
 * - Level: `levelDb` below the voice, through a GainNode (`10^(dB/20)`), never through the element's
 *   `volume` (iOS ignores it). The element is `crossOrigin="anonymous"` so a server that does not allow
 *   it fails to load rather than playing through an unreadable (and so ungainable) source.
 * - No Web Audio, a context that cannot be made or resumed, or a track that fails to load ⇒ no music for
 *   the session, silently: music at full volume over the voice is never acceptable.
 * - Unmounting stops it.
 */
export function useBgm({
  enabled,
  levelDb,
  sessionKey,
  voiced,
  held,
}: {
  enabled: boolean;
  levelDb: number | null | undefined;
  sessionKey: string | number | null;
  voiced: boolean;
  held: boolean;
}) {
  const [tracks, setTracks] = useState<RadioBgmTrack[] | null>(null);
  const asked = useRef(false);
  const [pick, setPick] = useState<{ key: string | number; track: RadioBgmTrack | null } | null>(null);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [running, setRunning] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const wantRef = useRef(false);
  const levelRef = useRef(levelDb);
  levelRef.current = levelDb;

  // `GET bgm`, once per page; only where the gain can be applied (there is no use for it otherwise).
  useEffect(() => {
    if (!enabled || asked.current || !contextCtor()) return;
    asked.current = true;
    let live = true;
    void getRadioBgm()
      .then((res) => {
        if (!live) return;
        setTracks(res.success && res.data ? (res.data.tracks ?? []).filter((x) => !!x.audio_url) : []);
      })
      .catch(() => live && setTracks([]));
    return () => {
      live = false;
      asked.current = false;
    };
  }, [enabled]);

  // One track per listening session, at random.
  useEffect(() => {
    if (sessionKey == null || !tracks) return;
    setPick((p) => {
      if (p && p.key === sessionKey) return p;
      const track = tracks.length ? tracks[Math.floor(Math.random() * tracks.length)] : null;
      return { key: sessionKey, track };
    });
    setStarted(false);
    setFailed(false);
  }, [sessionKey, tracks]);

  // The music starts with the session's first sentence that has audio.
  useEffect(() => {
    if (voiced && pick?.key === sessionKey) setStarted(true);
  }, [voiced, pick, sessionKey]);

  // The element and its gain, for the session's track.
  const url = enabled && pick?.key === sessionKey ? (pick.track?.audio_url ?? null) : null;
  useEffect(() => {
    if (!url) return;
    const ctx = bgmContext();
    if (!ctx || typeof Audio === 'undefined') return;
    const a = new Audio();
    // Before `src`: a cross-origin source without CORS would play, but Web Audio would read only silence
    // from it and could not set its level. With this it fails to load instead.
    a.crossOrigin = 'anonymous';
    a.loop = true;
    a.preload = 'auto';
    let source: MediaElementAudioSourceNode;
    let gain: GainNode;
    try {
      source = ctx.createMediaElementSource(a);
      gain = ctx.createGain();
      gain.gain.value = bgmGain(levelRef.current);
      source.connect(gain);
      gain.connect(ctx.destination);
    } catch {
      setFailed(true);
      return;
    }
    // A track that fails to load is skipped for the session: no notice, the voice carries on.
    a.onerror = () => {
      a.pause();
      setFailed(true);
    };
    a.src = url;
    audioRef.current = a;
    gainRef.current = gain;
    const onState = () => setRunning(ctx.state === 'running');
    onState();
    ctx.addEventListener?.('statechange', onState);
    return () => {
      ctx.removeEventListener?.('statechange', onState);
      a.onerror = null;
      a.pause();
      a.removeAttribute?.('src');
      a.load?.();
      try {
        source.disconnect();
        gain.disconnect();
      } catch {
        /* already disconnected */
      }
      audioRef.current = null;
      gainRef.current = null;
    };
  }, [url]);

  // The level follows the setting.
  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = bgmGain(levelDb);
  }, [levelDb]);

  const want = !!url && started && !held && !failed;
  wantRef.current = want;

  // Play / pause with the voice. The element plays only once the context runs: through a suspended
  // context it would advance in silence.
  useEffect(() => {
    const a = audioRef.current;
    const ctx = sharedContext;
    if (!a || !ctx) return;
    if (!want) {
      a.pause();
      return;
    }
    if (ctx.state !== 'running') {
      // Allowed without a tap where the page already has the user's activation; otherwise the tap does it.
      ctx.resume?.().then(
        () => setRunning(ctx.state === 'running'),
        () => setFailed(true)
      );
      return;
    }
    a.play().catch((err: unknown) => {
      // Not yet allowed: the next tap plays it (below). Anything else: no music this session.
      if ((err as { name?: string } | null)?.name !== 'NotAllowedError') setFailed(true);
    });
  }, [want, running]);

  // The first tap on the page unlocks the context (and, on iOS, the element), inside the gesture.
  useEffect(() => {
    if (!url) return;
    const onGesture = () => {
      const ctx = sharedContext;
      if (!ctx) return;
      if (ctx.state !== 'running') {
        ctx.resume?.().then(
          () => setRunning(ctx.state === 'running'),
          () => setFailed(true)
        );
      }
      const a = audioRef.current;
      if (wantRef.current && a && a.paused && ctx.state === 'running') {
        a.play().catch(() => undefined);
      }
    };
    GESTURES.forEach((e) => window.addEventListener(e, onGesture, true));
    return () => GESTURES.forEach((e) => window.removeEventListener(e, onGesture, true));
  }, [url]);

  return { trackId: url ? (pick?.track?.track_id ?? null) : null, playing: want && running && !failed };
}
