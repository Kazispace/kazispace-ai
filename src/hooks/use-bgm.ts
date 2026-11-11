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
    preferPlayback();
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
  sessionSet = false;
}

// iOS (Safari 17+, and the WebViews built on it) mutes Web Audio with the ringer switch unless the page
// says it plays media: then the music is heard with the switch on silent, as the voice is.
let sessionSet = false;
function preferPlayback() {
  if (sessionSet || typeof navigator === 'undefined') return;
  sessionSet = true;
  const session = (navigator as Navigator & { audioSession?: { type?: string } }).audioSession;
  if (!session || !('type' in session)) return;
  try {
    session.type = 'playback';
  } catch {
    /* not settable here */
  }
}

/** `resume()`, after the audio session is set where the browser has one. */
function resumeContext(ctx: AudioContext): Promise<void> {
  preferPlayback();
  return ctx.resume ? ctx.resume() : Promise.resolve();
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
 * - A track that errors (an expired signed URL) is asked for again once, by `track_id`, and carries on
 *   from where it was (from the start where it cannot seek).
 * - No Web Audio, a context that cannot be made or resumed, or a track that errors twice ⇒ no music for
 *   the session, silently: music at full volume over the voice is never acceptable.
 * - The first tap on the page unlocks the context, even before `GET bgm` answers (iOS N8 check 4).
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
  // An element made and played inside a tap that came before the track was known (iOS lets an element
  // play later only once it has been played inside a gesture); the session's track then uses it.
  const primedRef = useRef<HTMLAudioElement | null>(null);
  const tracksRef = useRef<RadioBgmTrack[] | null>(null);
  tracksRef.current = tracks;
  const gainRef = useRef<GainNode | null>(null);
  const wantRef = useRef(false);
  const levelRef = useRef(levelDb);
  levelRef.current = levelDb;
  // A load or playback error: ask `GET bgm` again once (a signed URL lasts 15 minutes).
  const recoverRef = useRef<() => void>(() => undefined);

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

  // No music on this page after all: a tap that came first left a running context and an element made for a
  // track; put the context back to sleep and drop the element (#298 R1).
  useEffect(() => {
    if (!tracks || tracks.length) return;
    primedRef.current = null;
    if (sharedContext && sharedContext.state === 'running') void sharedContext.suspend?.().catch(() => undefined);
  }, [tracks]);

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
  const trackId = url ? (pick?.track?.track_id ?? null) : null;
  useEffect(() => {
    if (!url) return;
    const ctx = bgmContext();
    if (!ctx || typeof Audio === 'undefined') return;
    const a = primedRef.current ?? new Audio();
    primedRef.current = null;
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
    // An error (most often the signed URL expired while the track looped): ask `GET bgm` once more for
    // the same track and carry on from where it was. A second error: the track is skipped for the
    // session, with no notice, and the voice carries on.
    let live = true;
    let retried = false;
    const giveUp = () => {
      a.pause();
      setFailed(true);
    };
    const recover = () => {
      if (!live) return;
      const at = Number.isFinite(a.currentTime) ? a.currentTime : 0;
      a.pause();
      if (retried) {
        giveUp();
        return;
      }
      retried = true;
      void getRadioBgm()
        .then((res) => {
          if (!live) return;
          const fresh = res.success ? res.data?.tracks?.find((x) => x.track_id === trackId)?.audio_url : null;
          if (!fresh) {
            giveUp();
            return;
          }
          a.onloadedmetadata = () => {
            a.onloadedmetadata = null;
            try {
              if (at > 0) a.currentTime = at;
            } catch {
              /* not seekable: from the start */
            }
            if (wantRef.current && ctx.state === 'running') a.play().catch(() => recoverRef.current());
          };
          a.src = fresh;
          a.load?.();
        })
        .catch(() => live && giveUp());
    };
    recoverRef.current = recover;
    a.onerror = recover;
    a.src = url;
    audioRef.current = a;
    gainRef.current = gain;
    const onState = () => setRunning(ctx.state === 'running');
    onState();
    ctx.addEventListener?.('statechange', onState);
    return () => {
      live = false;
      recoverRef.current = () => undefined;
      ctx.removeEventListener?.('statechange', onState);
      a.onerror = null;
      a.onloadedmetadata = null;
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
  }, [url, trackId]);

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
      // A refusal here is not final: on iOS a resume outside a gesture may be refused, and the next tap
      // (below) tries again. Only a context or node that cannot be made, or a track that errors twice, ends
      // the music for the session (#297 R1).
      resumeContext(ctx).then(
        () => setRunning(ctx.state === 'running'),
        () => setRunning(false)
      );
      return;
    }
    a.play().catch((err: unknown) => {
      // Not yet allowed: the next tap plays it (below). Anything else: one more try, as for a load error.
      if ((err as { name?: string } | null)?.name !== 'NotAllowedError') recoverRef.current();
    });
  }, [want, running]);

  // The first tap on the page unlocks the context (and, on iOS, the element), inside the gesture, whether
  // or not `GET bgm` has answered: a user who taps play straight away would otherwise wait for a second
  // tap. Not once `GET bgm` has answered with no tracks.
  useEffect(() => {
    if (!enabled) return;
    const onGesture = () => {
      if (tracksRef.current && !tracksRef.current.length) return;
      const ctx = bgmContext();
      if (!ctx) return;
      if (!audioRef.current && !primedRef.current && typeof Audio !== 'undefined') {
        const p = new Audio();
        p.crossOrigin = 'anonymous';
        primedRef.current = p;
        try {
          void p.play()?.catch(() => undefined);
        } catch {
          /* nothing to play yet: the gesture is what counts */
        }
      }
      if (ctx.state !== 'running') {
        resumeContext(ctx).then(
          () => {
            setRunning(ctx.state === 'running');
            const el = audioRef.current;
            if (wantRef.current && el && el.paused && ctx.state === 'running') el.play().catch(() => undefined);
          },
          () => setRunning(false) // still locked: the next tap tries again
        );
      }
      const a = audioRef.current;
      if (wantRef.current && a && a.paused && ctx.state === 'running') {
        a.play().catch(() => undefined);
      }
    };
    GESTURES.forEach((e) => window.addEventListener(e, onGesture, true));
    return () => GESTURES.forEach((e) => window.removeEventListener(e, onGesture, true));
  }, [enabled]);

  return { trackId, playing: want && running && !failed };
}
