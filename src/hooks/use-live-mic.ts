'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { LIVE_QUIET_MS, secondsLeft, shouldCutPiece } from '@/lib/radio/live-recording';
import { LEVEL_SAMPLE_MS, SPEECH_LEVEL, micErrorKind, pickRecordingMime } from '@/lib/radio/voice';
import type { LiveLimits } from '@/types/radio-live';

export type LiveMicState = 'idle' | 'starting' | 'recording';
export type LiveMicOpen = 'ok' | 'blocked' | 'no_device';

interface Recording {
  stream: MediaStream;
  mime: string;
  ctx: AudioContext | null;
  analyser: AnalyserNode | null;
  timer: ReturnType<typeof setInterval>;
  startedAt: number;
  /** The piece being recorded, its seq, and where in the recording it began. */
  recorder: MediaRecorder;
  seq: number;
  pieceStartMs: number;
  quietSince: number | null;
  ending: boolean;
}

/** Each piece's data, kept per recorder, so a piece is always one whole file. */
const pieceData = new WeakMap<MediaRecorder, Blob[]>();

function startPiece(recorder: MediaRecorder): void {
  const parts: Blob[] = [];
  pieceData.set(recorder, parts);
  recorder.ondataavailable = (e: BlobEvent) => {
    if (e.data && e.data.size > 0) parts.push(e.data);
  };
  recorder.start();
}

/** Stops a piece; `deliver` gets it whole once its last data has arrived. */
function stopPiece(recorder: MediaRecorder, mime: string, deliver: (blob: Blob) => void): void {
  const whole = () => new Blob(pieceData.get(recorder) ?? [], { type: mime || 'audio/webm' });
  if (recorder.state === 'inactive') {
    deliver(whole());
    return;
  }
  // The last data arrives with the stop, before `onstop`.
  recorder.onstop = () => deliver(whole());
  recorder.stop();
}

/**
 * Live Room's microphone (KAZI-1287; kazispace-ui live-room.md, Recording · Sending a recording).
 *
 * - Recording starts only by a tap (`open`), and ends by `done()` or at `limits.record_max_ms`; a pause
 *   in speech does not end it. There is no cancel.
 * - It is recorded in pieces, each a whole file of its own (a new `MediaRecorder` on the same stream),
 *   so each can be transcribed as it arrives. The next piece starts before the last one stops, so
 *   nothing between them is lost. Where a piece ends follows `shouldCutPiece`.
 * - `onPiece` gets each piece but the last; `onFinal` gets the last. The microphone is released (every
 *   track stopped) as soon as the last piece is recorded, and on unmount.
 */
export function useLiveMic({
  limits,
  onPiece,
  onFinal,
}: {
  limits: LiveLimits;
  onPiece: (seq: number, audio: Blob, durationMs: number, mime: string) => void;
  onFinal: (seq: number, audio: Blob, durationMs: number, mime: string) => void;
}) {
  const [state, setState] = useState<LiveMicState>('idle');
  const [level, setLevel] = useState(0);
  const [left, setLeft] = useState<number | null>(null);
  const recRef = useRef<Recording | null>(null);
  const cb = useRef({ onPiece, onFinal, limits });
  cb.current = { onPiece, onFinal, limits };

  const release = useCallback((r: Recording) => {
    clearInterval(r.timer);
    r.stream.getTracks().forEach((track) => track.stop());
    if (r.ctx) void r.ctx.close().catch(() => undefined);
    if (recRef.current === r) recRef.current = null;
    setState('idle');
    setLevel(0);
    setLeft(null);
  }, []);

  const finish = useCallback(
    (r: Recording) => {
      if (r.ending) return;
      r.ending = true;
      clearInterval(r.timer);
      const elapsed = Math.min(Date.now() - r.startedAt, cb.current.limits.record_max_ms);
      const seq = r.seq;
      const durationMs = Math.max(1, elapsed - r.pieceStartMs);
      stopPiece(r.recorder, r.mime, (blob) => {
        release(r);
        cb.current.onFinal(seq, blob, durationMs, r.mime);
      });
    },
    [release]
  );

  const cut = useCallback((r: Recording, atMs: number) => {
    let next: MediaRecorder;
    try {
      next = r.mime ? new MediaRecorder(r.stream, { mimeType: r.mime }) : new MediaRecorder(r.stream);
    } catch {
      return; // the piece carries on; it is cut again at the next check
    }
    const old = r.recorder;
    const seq = r.seq;
    const durationMs = Math.max(1, atMs - r.pieceStartMs);
    startPiece(next);
    r.recorder = next;
    r.seq = seq + 1;
    r.pieceStartMs = atMs;
    r.quietSince = null;
    stopPiece(old, r.mime, (blob) => cb.current.onPiece(seq, blob, durationMs, r.mime));
  }, []);

  const open = useCallback(async (): Promise<LiveMicOpen> => {
    if (recRef.current) return 'ok';
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      return 'no_device';
    }
    setState('starting');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setState('idle');
      return micErrorKind(err);
    }
    const mime = pickRecordingMime((m) =>
      typeof MediaRecorder.isTypeSupported === 'function' ? MediaRecorder.isTypeSupported(m) : false
    );
    let recorder: MediaRecorder;
    try {
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      setState('idle');
      return 'no_device';
    }
    // Quiet moments to cut at. Without an AudioContext the pieces are cut every `chunk_max_ms`.
    let ctx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    const Ctx =
      typeof window !== 'undefined'
        ? (window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
        : undefined;
    if (Ctx) {
      try {
        ctx = new Ctx();
        analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        ctx.createMediaStreamSource(stream).connect(analyser);
      } catch {
        ctx = null;
        analyser = null;
      }
    }
    const r: Recording = {
      stream,
      mime: recorder.mimeType || mime,
      ctx,
      analyser,
      timer: 0 as unknown as ReturnType<typeof setInterval>,
      startedAt: Date.now(),
      recorder,
      seq: 1,
      pieceStartMs: 0,
      quietSince: null,
      ending: false,
    };
    startPiece(recorder);
    const buf = analyser ? new Uint8Array(analyser.fftSize) : null;
    r.timer = setInterval(() => {
      const now = Date.now();
      const elapsed = now - r.startedAt;
      let rms = 0;
      if (r.analyser && buf) {
        r.analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i += 1) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        rms = Math.sqrt(sum / buf.length);
      }
      setLevel(rms);
      setLeft(secondsLeft(elapsed, cb.current.limits));
      if (elapsed >= cb.current.limits.record_max_ms) {
        finish(r);
        return;
      }
      if (r.analyser) {
        if (rms > SPEECH_LEVEL) r.quietSince = null;
        else if (r.quietSince === null) r.quietSince = now;
      }
      const quiet = r.quietSince !== null && now - r.quietSince >= LIVE_QUIET_MS;
      if (shouldCutPiece({ k: r.seq, elapsedMs: elapsed, pieceStartMs: r.pieceStartMs, quiet, limits: cb.current.limits })) {
        cut(r, elapsed);
      }
    }, LEVEL_SAMPLE_MS);
    recRef.current = r;
    setState('recording');
    setLeft(null);
    return 'ok';
  }, [cut, finish]);

  /** Done (or the page can no longer be seen): the rest is sent as the last piece. */
  const done = useCallback(() => {
    const r = recRef.current;
    if (r) finish(r);
  }, [finish]);

  useEffect(
    () => () => {
      // Leaving: the microphone goes off at once and nothing more is delivered.
      const r = recRef.current;
      if (!r) return;
      r.ending = true;
      r.recorder.ondataavailable = null;
      r.recorder.onstop = null;
      if (r.recorder.state !== 'inactive') r.recorder.stop();
      clearInterval(r.timer);
      r.stream.getTracks().forEach((track) => track.stop());
      if (r.ctx) void r.ctx.close().catch(() => undefined);
      recRef.current = null;
    },
    []
  );

  return { state, level, secondsLeft: left, open, done };
}
