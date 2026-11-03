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
}: {
  sentences: PlayableSentence[];
  speed: PlayerSpeed;
  autoplay: boolean;
  onDone?: () => void;
  /** Changing it starts the list again from its first sentence (a new answer, even for the same part). */
  partKey?: string | number;
}) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Paused inside a sentence's audio: play resumes from the same point in it.
  const pausedInAudio = useRef(false);
  const sentencesRef = useRef(sentences);
  const onDoneRef = useRef(onDone);
  const speedRef = useRef(speed);
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
      const a = audioRef.current ?? new Audio();
      audioRef.current = a;
      a.src = s.audioUrl;
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
    [clear]
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

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  useEffect(() => () => clear(), [clear]);

  const pause = useCallback(() => {
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
      a.playbackRate = speedRef.current;
      a.play().catch(() => playAt(index + 1));
      return;
    }
    playAt(index);
  }, [done, index, playAt]);

  const repeat = useCallback(() => playAt(Math.min(index, Math.max(0, sentencesRef.current.length - 1))), [index, playAt]);

  /** Plays from sentence `i` (the choice point reads its choices again from the first choice). */
  const playFrom = useCallback((i: number) => playAt(Math.max(0, i)), [playAt]);

  return { index, playing, done, play, pause, repeat, playFrom };
}
