'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  LEVEL_SAMPLE_MS,
  RECORD_MAX_MS,
  SILENCE_AFTER_SPEECH_MS,
  SPEECH_LEVEL,
  micErrorKind,
  pickRecordingMime,
} from '@/lib/radio/voice';

/** idle · starting (asking the system) · window (listen window open, nothing heard yet) · recording. */
export type RadioMicState = 'idle' | 'starting' | 'window' | 'recording';
export type RadioMicOpen = 'ok' | 'blocked' | 'no_device';

type Finish = 'send' | 'silence' | 'cancel';

interface Session {
  stream: MediaStream;
  recorder: MediaRecorder;
  mime: string;
  ctx: AudioContext | null;
  analyser: AnalyserNode | null;
  timer: ReturnType<typeof setInterval>;
  startedAt: number;
  windowMs: number | null;
  heard: boolean;
  lastSpeechAt: number;
  finishing: boolean;
  chunks: Blob[];
}

/**
 * The radio's microphone (KAZI-1209 part 2; personal-radio.md, Voice).
 *
 * - `open({windowMs})` opens the **listen window**: recording starts at once, so the first words are
 *   kept; if no speech is heard within `windowMs`, the recording is dropped and `onSilence` fires.
 *   Without `windowMs` (a tap on the microphone) it records straight away.
 * - Once speech is heard, recording ends by itself after a pause in speech or after 20 seconds, and
 *   `onRecorded` gets the audio. `done()` ends it now; `cancel()` drops it.
 * - Whenever the microphone turns off it is **released** (every track stopped), so the device's own
 *   microphone light goes out too. Unmounting releases it.
 *
 * `open` answers why it could not open: `blocked` (the system refused) or `no_device` (no microphone,
 * one in use elsewhere, or no recording support: voice is unavailable for this visit).
 */
export function useRadioMic({
  onRecorded,
  onSilence,
}: {
  onRecorded: (audio: Blob, durationMs: number, mime: string) => void;
  onSilence: () => void;
}) {
  const [state, setState] = useState<RadioMicState>('idle');
  const [level, setLevel] = useState(0);
  const sessionRef = useRef<Session | null>(null);
  const onRecordedRef = useRef(onRecorded);
  const onSilenceRef = useRef(onSilence);
  onRecordedRef.current = onRecorded;
  onSilenceRef.current = onSilence;

  const release = useCallback((s: Session) => {
    clearInterval(s.timer);
    s.stream.getTracks().forEach((track) => track.stop());
    if (s.ctx) void s.ctx.close().catch(() => undefined);
    if (sessionRef.current === s) sessionRef.current = null;
    setState('idle');
    setLevel(0);
  }, []);

  const finish = useCallback(
    (s: Session, how: Finish) => {
      if (s.finishing) return;
      s.finishing = true;
      clearInterval(s.timer);
      const durationMs = Date.now() - s.startedAt;
      const deliver = () => {
        release(s);
        if (how === 'silence') onSilenceRef.current();
        else if (how === 'send' && s.chunks.length) {
          onRecordedRef.current(new Blob(s.chunks, { type: s.mime || 'audio/webm' }), durationMs, s.mime);
        }
      };
      if (how === 'cancel') {
        s.recorder.ondataavailable = null;
        s.recorder.onstop = null;
        if (s.recorder.state !== 'inactive') s.recorder.stop();
        deliver();
        return;
      }
      if (s.recorder.state === 'inactive') {
        deliver();
        return;
      }
      // The last chunk arrives with the stop, before `onstop`.
      s.recorder.onstop = deliver;
      s.recorder.stop();
    },
    [release]
  );

  const open = useCallback(
    async ({ windowMs }: { windowMs?: number | null } = {}): Promise<RadioMicOpen> => {
      if (sessionRef.current) return 'ok';
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

      // The level meter, and how speech and the pause after it are told apart. Without an
      // AudioContext the recording simply runs to the end of the window (or Done, or 20 s).
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

      const now = Date.now();
      const s: Session = {
        stream,
        recorder,
        mime: recorder.mimeType || mime,
        ctx,
        analyser,
        timer: 0 as unknown as ReturnType<typeof setInterval>,
        startedAt: now,
        windowMs: windowMs ?? null,
        heard: !windowMs,
        lastSpeechAt: now,
        finishing: false,
        chunks: [],
      };
      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) s.chunks.push(e.data);
      };
      const buf = analyser ? new Uint8Array(analyser.fftSize) : null;
      s.timer = setInterval(() => {
        const t = Date.now();
        let rms = 0;
        if (s.analyser && buf) {
          s.analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i += 1) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          rms = Math.sqrt(sum / buf.length);
        }
        setLevel(rms);
        if (rms > SPEECH_LEVEL) {
          if (!s.heard) setState('recording');
          s.heard = true;
          s.lastSpeechAt = t;
        }
        const elapsed = t - s.startedAt;
        if (elapsed >= RECORD_MAX_MS) return finish(s, 'send');
        if (s.windowMs && !s.heard && elapsed >= s.windowMs) {
          return finish(s, s.analyser ? 'silence' : 'send');
        }
        if (s.heard && s.analyser && t - s.lastSpeechAt >= SILENCE_AFTER_SPEECH_MS) finish(s, 'send');
      }, LEVEL_SAMPLE_MS);
      sessionRef.current = s;
      recorder.start(250);
      setState(windowMs ? 'window' : 'recording');
      return 'ok';
    },
    [finish]
  );

  /** A tap while the listen window is open: recording starts now. */
  const record = useCallback(() => {
    const s = sessionRef.current;
    if (!s || s.heard) return;
    s.heard = true;
    s.lastSpeechAt = Date.now();
    setState('recording');
  }, []);

  const done = useCallback(() => {
    const s = sessionRef.current;
    if (s) finish(s, 'send');
  }, [finish]);

  const cancel = useCallback(() => {
    const s = sessionRef.current;
    if (s) finish(s, 'cancel');
  }, [finish]);

  useEffect(
    () => () => {
      const s = sessionRef.current;
      if (s) {
        s.finishing = true;
        s.recorder.ondataavailable = null;
        s.recorder.onstop = null;
        if (s.recorder.state !== 'inactive') s.recorder.stop();
        clearInterval(s.timer);
        s.stream.getTracks().forEach((track) => track.stop());
        if (s.ctx) void s.ctx.close().catch(() => undefined);
        sessionRef.current = null;
      }
    },
    []
  );

  return { state, level, open, record, done, cancel };
}
