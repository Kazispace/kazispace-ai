/**
 * @vitest-environment jsdom
 *
 * KAZI-1209 part 2 — the radio microphone (kazispace-ui personal-radio.md, Voice) and its pure rules.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useRadioMic } from '@/hooks/use-radio-mic';
import {
  RECORD_MAX_MS,
  appCommandOf,
  blockedHelpPlatform,
  micErrorKind,
  pickRecordingMime,
  recordingFileName,
} from '@/lib/radio/voice';

// ── fakes: a stream, a recorder, and an analyser whose level the test sets ──────────────────────
let level = 0;
const tracks: { stopped: boolean }[] = [];
class FakeTrack {
  stopped = false;
  constructor() {
    tracks.push(this);
  }
  stop() {
    this.stopped = true;
  }
}
class FakeRecorder {
  static isTypeSupported = (mime: string) => mime === 'audio/webm;codecs=opus';
  state: 'inactive' | 'recording' = 'inactive';
  mimeType: string;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(_s: unknown, opts?: { mimeType?: string }) {
    this.mimeType = opts?.mimeType ?? '';
  }
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['abc']) });
    this.onstop?.();
  }
}
class FakeCtx {
  createAnalyser() {
    return {
      fftSize: 256,
      getByteTimeDomainData(buf: Uint8Array) {
        // A square wave of amplitude `level` around 128 gives an RMS of `level`.
        for (let i = 0; i < buf.length; i += 1) buf[i] = 128 + (i % 2 ? 1 : -1) * Math.round(level * 128);
      },
    };
  }
  createMediaStreamSource() {
    return { connect: () => undefined };
  }
  close() {
    return Promise.resolve();
  }
}

type Mic = ReturnType<typeof useRadioMic>;
let mic: Mic;
const recorded: Array<{ size: number; duration: number; mime: string }> = [];
let silences = 0;
function Harness() {
  mic = useRadioMic({
    onRecorded: (a, d, m) => recorded.push({ size: a.size, duration: d, mime: m }),
    onSilence: () => (silences += 1),
  });
  return <span data-testid="state">{mic.state}</span>;
}

let container: HTMLDivElement;
let root: Root;
const state = () => container.querySelector('[data-testid="state"]')?.textContent;
const getUserMedia = vi.fn();

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  level = 0;
  tracks.length = 0;
  recorded.length = 0;
  silences = 0;
  getUserMedia.mockReset();
  getUserMedia.mockImplementation(async () => {
    const t = new FakeTrack();
    return { getTracks: () => [t] };
  });
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  vi.stubGlobal('AudioContext', FakeCtx);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Harness />));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const tick = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};

describe('useRadioMic', () => {
  it('listen window with nothing said: dropped after the window, onSilence, and the microphone released', async () => {
    await act(async () => {
      expect(await mic.open({ windowMs: 8000 })).toBe('ok');
    });
    expect(state()).toBe('window');
    await tick(7900);
    expect(silences).toBe(0);
    await tick(200);
    expect(silences).toBe(1);
    expect(recorded).toEqual([]);
    expect(state()).toBe('idle');
    expect(tracks.every((t) => t.stopped)).toBe(true);
  });

  it('speech in the window: recording; it ends by itself after a pause and is sent', async () => {
    await act(async () => {
      await mic.open({ windowMs: 8000 });
    });
    level = 0.2;
    await tick(500);
    expect(state()).toBe('recording');
    level = 0;
    await tick(1100);
    expect(recorded).toEqual([]);
    await tick(300);
    expect(recorded).toHaveLength(1);
    expect(recorded[0].mime).toBe('audio/webm;codecs=opus');
    expect(silences).toBe(0);
    expect(tracks.every((t) => t.stopped)).toBe(true);
  });

  it('never records longer than 20 seconds', async () => {
    await act(async () => {
      await mic.open();
    });
    level = 0.2;
    await tick(RECORD_MAX_MS - 200);
    expect(recorded).toEqual([]);
    await tick(300);
    expect(recorded).toHaveLength(1);
  });

  it('cancel drops the recording and releases the microphone', async () => {
    await act(async () => {
      await mic.open();
    });
    await act(async () => mic.cancel());
    expect(recorded).toEqual([]);
    expect(state()).toBe('idle');
    expect(tracks.every((t) => t.stopped)).toBe(true);
  });

  it('done sends now; a tap in the window starts recording', async () => {
    await act(async () => {
      await mic.open({ windowMs: 8000 });
    });
    await act(async () => mic.record());
    expect(state()).toBe('recording');
    await tick(9000 - 7000); // past where the window would have closed: no silence now
    await act(async () => mic.done());
    expect(silences).toBe(0);
    expect(recorded).toHaveLength(1);
  });

  it('a refusal reads as blocked; no microphone reads as no_device', async () => {
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
    await act(async () => {
      expect(await mic.open()).toBe('blocked');
    });
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'NotFoundError' }));
    await act(async () => {
      expect(await mic.open()).toBe('no_device');
    });
    expect(state()).toBe('idle');
  });

  it('leaving releases the microphone', async () => {
    await act(async () => {
      await mic.open();
    });
    act(() => root.unmount());
    expect(tracks.every((t) => t.stopped)).toBe(true);
    root = createRoot(container);
  });
});

describe('voice rules', () => {
  it('micErrorKind', () => {
    expect(micErrorKind({ name: 'NotAllowedError' })).toBe('blocked');
    expect(micErrorKind({ name: 'SecurityError' })).toBe('blocked');
    expect(micErrorKind({ name: 'NotReadableError' })).toBe('no_device');
    expect(micErrorKind(null)).toBe('no_device');
  });

  it('file names carry the real extension', () => {
    expect(recordingFileName('audio/webm;codecs=opus')).toBe('voice.webm');
    expect(recordingFileName('audio/mp4')).toBe('voice.m4a');
    expect(recordingFileName('audio/ogg;codecs=opus')).toBe('voice.ogg');
    expect(pickRecordingMime((m) => m === 'audio/mp4')).toBe('audio/mp4');
    expect(pickRecordingMime(() => false)).toBe('');
  });

  it('blocked-microphone help steps by platform', () => {
    expect(blockedHelpPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('ios');
    expect(blockedHelpPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', { maxTouchPoints: 5 })).toBe('ios');
    expect(blockedHelpPlatform('Mozilla/5.0 (Linux; Android 14)')).toBe('android');
    expect(blockedHelpPlatform('Mozilla/5.0 (Linux; Android 14)', { telegram: true })).toBe('telegram');
    expect(blockedHelpPlatform('Mozilla/5.0 (Windows NT 10.0)')).toBe('desktop');
  });

  it('only the commands the server leaves to the app are carried out by it', () => {
    expect(appCommandOf({ kind: 'command', command: 'slower' })).toBe('slower');
    expect(appCommandOf({ kind: 'command', command: 'advance' })).toBeNull();
    expect(appCommandOf({ kind: 'choice', command: null })).toBeNull();
    expect(appCommandOf(null)).toBeNull();
  });
});
