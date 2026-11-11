'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** One sentence the player can speak. No `audioUrl` (and not pending) ⇒ a reading pause. */
export interface PlayableSentence {
  seq: number;
  text: string;
  audioUrl?: string | null;
  durationMs?: number | null;
  pending?: boolean;
}

export type PlayerSpeed = 1 | 0.75;

/** A sentence with no voice is held on screen for reading: ~1 s per 15 characters, at least 2 s. */
export function readingPauseMs(text: string): number {
  return Math.max(2000, Math.round((text.length / 15) * 1000));
}

/**
 * Plays sentences in order (KAZI-1209; kazispace-ui personal-radio.md, The audio of a part · Player).
 *
 * - Each sentence with an `audioUrl` is played through one `<audio>` element; one without audio
 *   (or still `pending` when narration reaches it) is highlighted for a reading pause instead.
 * - `speed` switches between 1× and 0.75× keeping the pitch.
 * - Pause stops at once; play carries on from the same sentence. `repeat` replays the current one.
 * - `playFrom(i)` plays from sentence `i`.
 * - `onDone` fires once when the last sentence has been played.
 * - Unmounting stops everything (leaving the player stops it).
 *
 * The sentence list may change while playing (audio arriving for a pending sentence); the player
 * reads the current list each time it moves on.
 */
export function useSentencePlayer({
  sentences,
  speed,
  autoplay,
  onDone,
  partKey,
  onPlayed,
  element,
  preroll,
  hold,
}: {
  sentences: PlayableSentence[];
  speed: PlayerSpeed;
  autoplay: boolean;
  onDone?: () => void;
  /** Changing it starts the list again from its first sentence (a new answer, even for the same part). */
  partKey?: string | number;
  /**
   * Audio that actually played, in ms, as it plays (forward progress of the audio only: pauses, reading
   * pauses with no audio and seeking back add nothing). For `player_left.listened_ms` (KAZI-1255).
   */
  onPlayed?: (ms: number) => void;
  /**
   * An element to play through instead of a new one: Live Room (KAZI-1287) passes the element its
   * Start tap unlocked, so the opening may play without another tap.
   */
  element?: HTMLAudioElement | null;
  /**
   * A sound played once, at 1.0×, through the same element, before the first sentence that has audio
   * (KAZI-1242: the Morse "AI" rhythm where the region must label). Not a sentence: `index` does not move
   * for it, it adds nothing to `onPlayed`, and it never plays twice for this player.
   */
  preroll?: string | null;
  /**
   * While true nothing starts: autoplay, `playFrom` and play are remembered and the remembered sentence
   * starts once it turns false. (Resuming inside a paused sentence is another path; it cannot happen while
   * held, since nothing has played yet.) For a `preroll` that is not known yet (KAZI-1242: the region's answer has
   * not arrived) — without it the first sentence would play before the rhythm.
   */
  hold?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);
  const [prerolling, setPrerolling] = useState(false);
  const prerollRef = useRef(preroll ?? null);
  prerollRef.current = preroll ?? null;
  const prerollDone = useRef(false);
  const prerollingRef = useRef(false);
  const holdRef = useRef(!!hold);
  holdRef.current = !!hold;
  // The sentence asked for while held.
  const heldAt = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Paused inside a sentence's audio: play resumes from the same point in it.
  const pausedInAudio = useRef(false);
  const sentencesRef = useRef(sentences);
  const onDoneRef = useRef(onDone);
  const speedRef = useRef(speed);
  const onPlayedRef = useRef(onPlayed);
  onPlayedRef.current = onPlayed;
  const lastTime = useRef(0);
  sentencesRef.current = sentences;
  onDoneRef.current = onDone;
  speedRef.current = speed;

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const a = audioRef.current;
    if (a) {
      a.onended = null;
      a.onerror = null;
      a.pause();
    }
  }, []);

  const playAt = useCallback(
    (i: number) => {
      if (holdRef.current) {
        heldAt.current = i;
        return;
      }
      heldAt.current = null;
      clear();
      pausedInAudio.current = false;
      const list = sentencesRef.current;
      if (i >= list.length) {
        setPlaying(false);
        setDone(true);
        onDoneRef.current?.();
        return;
      }
      setIndex(i);
      setPlaying(true);
      setDone(false);
      const s = list[i];
      const next = () => playAt(i + 1);
      const hold = () => {
        timerRef.current = setTimeout(next, readingPauseMs(s.text) / speedRef.current);
      };
      if (!s.audioUrl || typeof Audio === 'undefined') {
        hold();
        return;
      }
      const a = audioRef.current ?? element ?? new Audio();
      audioRef.current = a;
      if (prerollRef.current && !prerollDone.current) {
        // The pre-roll first, then this sentence; it is not a sentence and is never cut by a speed change.
        const after = () => {
          prerollDone.current = true;
          prerollingRef.current = false;
          setPrerolling(false);
          playAt(i);
        };
        prerollingRef.current = true;
        setPrerolling(true);
        a.src = prerollRef.current;
        a.ontimeupdate = null;
        a.playbackRate = 1;
        a.onended = after;
        a.onerror = after;
        a.play().catch((err: unknown) => {
          if ((err as { name?: string } | null)?.name === 'NotAllowedError') {
            pausedInAudio.current = true;
            setPlaying(false);
          } else {
            after();
          }
        });
        return;
      }
      a.src = s.audioUrl;
      lastTime.current = 0;
      a.ontimeupdate = () => {
        const t = a.currentTime;
        const d = t - lastTime.current;
        lastTime.current = t;
        // a jump (a seek, a new source) is not listening; normal updates come a few times a second
        if (d > 0 && d < 2) onPlayedRef.current?.(d * 1000);
      };
      a.playbackRate = speedRef.current;
      (a as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
      a.onended = next;
      a.onerror = hold;
      a.play().catch((err: unknown) => {
        // Autoplay blocked: wait for a tap on play, which resumes this sentence. Any other failure
        // is a sentence with no voice (a reading pause).
        if ((err as { name?: string } | null)?.name === 'NotAllowedError') {
          pausedInAudio.current = true;
          setPlaying(false);
        } else {
          hold();
        }
      });
    },
    [clear, element]
  );

  // A new list (a new part) starts from its first sentence.
  const firstKey = sentences.length ? `${sentences[0].seq}:${sentences[0].text}` : '';
  useEffect(() => {
    clear();
    setIndex(0);
    setDone(false);
    setPlaying(false);
    if (autoplay && sentencesRef.current.length) playAt(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstKey, sentences.length === 0, partKey]);

  // Declared after the start effect: a part that arrives as the hold ends starts there, once.
  useEffect(() => {
    if (hold || heldAt.current == null) return;
    const i = heldAt.current;
    heldAt.current = null;
    playAt(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hold]);

  useEffect(() => {
    if (audioRef.current && !prerollingRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  useEffect(() => () => clear(), [clear]);

  const pause = useCallback(() => {
    heldAt.current = null; // paused before it could start: it stays paused
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      pausedInAudio.current = false;
    } else if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      pausedInAudio.current = true;
    }
    setPlaying(false);
  }, []);

  const play = useCallback(() => {
    if (done) {
      playAt(0);
      return;
    }
    const a = audioRef.current;
    if (pausedInAudio.current && a) {
      pausedInAudio.current = false;
      setPlaying(true);
      a.playbackRate = prerollingRef.current ? 1 : speedRef.current;
      a.play().catch(() => playAt(index + 1));
      return;
    }
    playAt(index);
  }, [done, index, playAt]);

  const repeat = useCallback(() => playAt(Math.min(index, Math.max(0, sentencesRef.current.length - 1))), [index, playAt]);

  /** Plays from sentence `i` (the choice point reads its choices again from the first choice). */
  const playFrom = useCallback((i: number) => playAt(Math.max(0, i)), [playAt]);

  /** Where in the current sentence's audio the player is, in ms (0 for a reading pause). */
  const offsetMs = useCallback(() => {
    const a = audioRef.current;
    if (prerollingRef.current) return 0; // still before the sentence
    return a && Number.isFinite(a.currentTime) ? Math.round(a.currentTime * 1000) : 0;
  }, []);

  return { index, playing, done, play, pause, repeat, playFrom, offsetMs, prerolling };
}
