/**
 * @vitest-environment jsdom
 *
 * KAZI-1287 F2 — Live Room's microphone (kazispace-ui live-room.md 0.3, Recording · Sending a recording).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useLiveMic } from '@/hooks/use-live-mic';

const LIMITS = { record_max_ms: 72_000, chunk_max_ms: 20_000, chunks_max: 4 };

class FakeRecorder {
  static all: FakeRecorder[] = [];
  static isTypeSupported = (m: string) => m === 'audio/webm;codecs=opus';
  state: 'inactive' | 'recording' = 'inactive';
  mimeType: string;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(_s: unknown, opts?: { mimeType?: string }) {
    this.mimeType = opts?.mimeType ?? '';
    FakeRecorder.all.push(this);
  }
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob([`piece${FakeRecorder.all.indexOf(this) + 1}`]) });
    this.onstop?.();
  }
}

/** The input level: speech (loud) or quiet, read by the analyser. */
let loud = true;
class FakeContext {
  createAnalyser() {
    return {
      fftSize: 256,
      getByteTimeDomainData(buf: Uint8Array) {
        buf.fill(loud ? 200 : 128);
      },
    };
  }
  createMediaStreamSource() {
    return { connect() {} };
  }
  close() {
    return Promise.resolve();
  }
}

const stopTrack = vi.fn();
const getUserMedia = vi.fn();
let api: ReturnType<typeof useLiveMic>;
const pieces: [number, number][] = [];
const finals: [number, number, string][] = [];

function Harness() {
  api = useLiveMic({
    limits: LIMITS,
    onPiece: (seq, _a, ms) => pieces.push([seq, ms]),
    onFinal: (seq, a, ms) => {
      finals.push([seq, ms, a.type]);
    },
  });
  return null;
}

let container: HTMLDivElement;
let root: Root;
const advance = (ms: number) => act(async () => void vi.advanceTimersByTime(ms));

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  vi.setSystemTime(0);
  loud = true;
  FakeRecorder.all = [];
  pieces.length = 0;
  finals.length = 0;
  stopTrack.mockReset();
  getUserMedia.mockReset().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] });
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  vi.stubGlobal('AudioContext', FakeContext);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  container = document.createElement('div');
  root = createRoot(container);
  await act(async () => root.render(<Harness />));
});
afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Recording', () => {
  it('starts only when asked (a tap), records, and Done sends the rest as the last piece', async () => {
    expect(api.state).toBe('idle');
    expect(getUserMedia).not.toHaveBeenCalled();
    await act(async () => void (await api.open()));
    expect(api.state).toBe('recording');
    await advance(5_000);
    await act(async () => api.done());
    expect(pieces).toEqual([]);
    expect(finals).toEqual([[1, 5_000, 'audio/webm;codecs=opus']]);
    // Released at once: every track stopped.
    expect(stopTrack).toHaveBeenCalled();
    expect(api.state).toBe('idle');
  });

  it('a pause in speech does not end it', async () => {
    await act(async () => void (await api.open()));
    loud = false;
    await advance(9_000);
    expect(finals).toEqual([]);
    expect(api.state).toBe('recording');
  });

  it('time left shows only in the last 10 seconds; at 72 s it ends by itself', async () => {
    await act(async () => void (await api.open()));
    await advance(61_000);
    expect(api.secondsLeft).toBeNull();
    await advance(1_000);
    expect(api.secondsLeft).toBe(10);
    await advance(10_000);
    expect(finals).toHaveLength(1);
    expect(api.state).toBe('idle');
  });

  it('no quiet moment: pieces cut every 20 s; 72 s makes 4 pieces, never a 5th', async () => {
    await act(async () => void (await api.open()));
    await advance(72_000);
    expect(pieces).toEqual([
      [1, 20_000],
      [2, 20_000],
      [3, 20_000],
    ]);
    expect(finals).toEqual([[4, 12_000, 'audio/webm;codecs=opus']]);
    expect(FakeRecorder.all).toHaveLength(4);
  });

  it('a quiet moment cuts the piece, but not before 12 s', async () => {
    await act(async () => void (await api.open()));
    await advance(8_000);
    loud = false; // quiet from 8 s: too early to cut
    await advance(3_000);
    expect(pieces).toEqual([]);
    await advance(1_000); // 12 s
    expect(pieces).toEqual([[1, 12_000]]);
  });

  it('each piece is its own recorder on the same stream; the next starts before the last stops', async () => {
    await act(async () => void (await api.open()));
    await advance(20_000);
    expect(FakeRecorder.all).toHaveLength(2);
    expect(FakeRecorder.all[0].state).toBe('inactive');
    expect(FakeRecorder.all[1].state).toBe('recording');
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['NotAllowedError', 'blocked'],
    ['NotFoundError', 'no_device'],
  ])('the system refuses (%s): %s', async (name, want) => {
    getUserMedia.mockRejectedValue(Object.assign(new Error('x'), { name }));
    let got = '';
    await act(async () => void (got = await api.open()));
    expect(got).toBe(want);
    expect(api.state).toBe('idle');
  });

  it('leaving while recording: the microphone goes off and nothing is delivered', async () => {
    await act(async () => void (await api.open()));
    await advance(3_000);
    act(() => root.unmount());
    expect(stopTrack).toHaveBeenCalled();
    expect(finals).toEqual([]);
    root = createRoot(container);
  });
});
