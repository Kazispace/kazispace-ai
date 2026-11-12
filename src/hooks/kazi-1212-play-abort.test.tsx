/**
 * @vitest-environment jsdom
 *
 * KAZI-1212 browser test (2026-11-12, KAZI-1307): a `play()` interrupted by a later `pause()` or a new source is
 * rejected with `AbortError`. That is not "this sound failed": whoever interrupted it decides what happens next.
 * Before the fix the player read it as the end of the AI rhythm (the rhythm was skipped and the first sentence
 * started, with the background music) or as a sentence with no audio (the next sentence started while paused).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSentencePlayer, type PlayableSentence } from '@/hooks/use-sentence-player';

/** A browser-like element: play() resolves only when the source starts; pause() before that rejects it. */
class FakeAudio {
  static all: FakeAudio[] = [];
  private _src = '';
  playbackRate = 1;
  paused = true;
  currentTime = 0;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeupdate: (() => void) | null = null;
  played: string[] = [];
  private pending: { resolve: () => void; reject: (e: unknown) => void } | null = null;
  constructor() {
    FakeAudio.all.push(this);
  }
  get src() {
    return this._src;
  }
  set src(v: string) {
    this.abort(); // a new source interrupts a pending play, as in a browser
    this._src = v;
  }
  private abort() {
    if (this.pending) {
      const p = this.pending;
      this.pending = null;
      p.reject(new DOMException('interrupted', 'AbortError'));
    }
  }
  play() {
    this.paused = false;
    this.played.push(this._src);
    return new Promise<void>((resolve, reject) => {
      this.pending = { resolve, reject };
    });
  }
  /** The source has started. */
  start() {
    const p = this.pending;
    this.pending = null;
    p?.resolve();
  }
  pause() {
    this.paused = true;
    this.abort();
  }
}

let api: ReturnType<typeof useSentencePlayer>;
function Harness({ sentences, preroll }: { sentences: PlayableSentence[]; preroll: string | null }) {
  api = useSentencePlayer({ sentences, speed: 1, autoplay: true, preroll });
  return null;
}

let container: HTMLDivElement;
let root: Root;
const a = () => FakeAudio.all[0];
const S = (seq: number, url: string | null): PlayableSentence => ({ seq, text: `s${seq}`, audioUrl: url });
const flush = () => act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); });

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  FakeAudio.all = [];
  vi.stubGlobal('Audio', FakeAudio);
  container = document.createElement('div');
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('an interrupted play is not the end of the sound', () => {
  it('a tap on play while the AI rhythm is starting plays the rhythm, not the first sentence', async () => {
    await act(async () => root.render(<Harness sentences={[S(1, 'u1'), S(2, 'u2')]} preroll="/m.wav" />));
    expect(a().played).toEqual(['/m.wav']);
    // The user taps play before the rhythm has started (as on the page's first tap).
    await act(async () => api.play());
    await flush();
    expect(api.prerolling).toBe(true);
    expect(a().src).toBe('/m.wav');
    expect(a().played.filter((s) => s === 'u1')).toEqual([]);
    a().start();
    await act(async () => a().onended?.());
    expect(api.prerolling).toBe(false);
    expect(a().src).toBe('u1');
  });

  it('pausing while the rhythm is starting stays paused, and play resumes the rhythm', async () => {
    await act(async () => root.render(<Harness sentences={[S(1, 'u1')]} preroll="/m.wav" />));
    await act(async () => api.pause());
    await flush();
    expect(api.playing).toBe(false);
    expect(api.prerolling).toBe(true);
    expect(a().played).toEqual(['/m.wav']);
    await act(async () => api.play());
    expect(a().played).toEqual(['/m.wav', '/m.wav']);
  });

  it('pausing while a sentence is starting does not move on to the next sentence', async () => {
    await act(async () => root.render(<Harness sentences={[S(1, 'u1'), S(2, 'u2')]} preroll={null} />));
    expect(a().played).toEqual(['u1']);
    await act(async () => api.pause());
    await flush();
    await act(async () => vi.advanceTimersByTime(60_000));
    expect(a().played).toEqual(['u1']);
    expect(api.index).toBe(0);
    expect(api.playing).toBe(false);
  });

  it('a sentence that really fails (not an interruption) still moves on after its reading pause', async () => {
    await act(async () => root.render(<Harness sentences={[S(1, 'u1'), S(2, 'u2')]} preroll={null} />));
    const original = FakeAudio.prototype.play;
    FakeAudio.prototype.play = function () {
      this.played.push(this.src);
      return Promise.reject(new DOMException('no source', 'NotSupportedError'));
    };
    await act(async () => api.repeat());
    await flush();
    await act(async () => vi.advanceTimersByTime(60_000));
    FakeAudio.prototype.play = original;
    expect(a().played).toContain('u2');
  });
});
