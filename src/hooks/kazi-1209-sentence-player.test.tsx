/**
 * @vitest-environment jsdom
 *
 * KAZI-1209 — the sentence player (kazispace-ui personal-radio.md, The audio of a part · Player).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readingPauseMs, useSentencePlayer, type PlayableSentence, type PlayerSpeed } from '@/hooks/use-sentence-player';

class FakeAudio {
  static all: FakeAudio[] = [];
  static nextPlay: () => Promise<void> = () => Promise.resolve();
  src = '';
  playbackRate = 1;
  preservesPitch = false;
  paused = true;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  plays: string[] = [];
  constructor() {
    FakeAudio.all.push(this);
  }
  play() {
    this.paused = false;
    this.plays.push(this.src);
    return FakeAudio.nextPlay();
  }
  pause() {
    this.paused = true;
  }
  end() {
    this.paused = true;
    this.onended?.();
  }
}

let container: HTMLDivElement;
let root: Root;
let api: ReturnType<typeof useSentencePlayer>;
const onDone = vi.fn();

function Harness({ sentences, speed = 1 }: { sentences: PlayableSentence[]; speed?: PlayerSpeed }) {
  api = useSentencePlayer({ sentences, speed, autoplay: true, onDone });
  return null;
}
const render = (sentences: PlayableSentence[], speed: PlayerSpeed = 1) =>
  act(() => root.render(<Harness sentences={sentences} speed={speed} />));
const flush = () => act(async () => {});

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  FakeAudio.all = [];
  FakeAudio.nextPlay = () => Promise.resolve();
  vi.stubGlobal('Audio', FakeAudio);
  container = document.createElement('div');
  root = createRoot(container);
  onDone.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const S = (seq: number, text: string, audioUrl: string | null = `https://a/${seq}.mp3`): PlayableSentence => ({ seq, text, audioUrl });

describe('useSentencePlayer', () => {
  it('plays each sentence in order, then calls onDone once', async () => {
    render([S(1, 'one'), S(2, 'two')]);
    await flush();
    const a = FakeAudio.all[0];
    expect(a.plays).toEqual(['https://a/1.mp3']);
    expect(api.index).toBe(0);
    act(() => a.end());
    await flush();
    expect(a.plays).toEqual(['https://a/1.mp3', 'https://a/2.mp3']);
    expect(api.index).toBe(1);
    act(() => a.end());
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(api.done).toBe(true);
  });

  it('a sentence with no voice is held for a reading pause (≥ 2 s, ~1 s / 15 chars)', async () => {
    expect(readingPauseMs('short')).toBe(2000);
    expect(readingPauseMs('x'.repeat(60))).toBe(4000);
    render([S(1, 'no voice here', null), S(2, 'two')]);
    await flush();
    expect(FakeAudio.all.length).toBe(0);
    act(() => vi.advanceTimersByTime(1999));
    expect(api.index).toBe(0);
    act(() => vi.advanceTimersByTime(1));
    await flush();
    expect(api.index).toBe(1);
    expect(FakeAudio.all[0].plays).toEqual(['https://a/2.mp3']);
  });

  it('speed 0.75 keeps the pitch', async () => {
    render([S(1, 'one')], 0.75);
    await flush();
    expect(FakeAudio.all[0].playbackRate).toBe(0.75);
    expect(FakeAudio.all[0].preservesPitch).toBe(true);
  });

  it('pause stops at once; play resumes the same sentence without restarting it', async () => {
    render([S(1, 'one'), S(2, 'two')]);
    await flush();
    const a = FakeAudio.all[0];
    act(() => api.pause());
    expect(a.paused).toBe(true);
    expect(api.playing).toBe(false);
    act(() => api.play());
    await flush();
    expect(api.playing).toBe(true);
    expect(api.index).toBe(0);
    expect(a.plays).toEqual(['https://a/1.mp3', 'https://a/1.mp3']);
  });

  it('autoplay blocked by the browser: waits for a tap instead of skipping the audio', async () => {
    FakeAudio.nextPlay = () => Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }));
    render([S(1, 'one'), S(2, 'two')]);
    await flush();
    expect(api.playing).toBe(false);
    act(() => vi.advanceTimersByTime(10_000));
    expect(api.index).toBe(0); // not skipped to the next sentence
    FakeAudio.nextPlay = () => Promise.resolve();
    act(() => api.play());
    await flush();
    expect(api.playing).toBe(true);
    expect(api.index).toBe(0);
  });

  it('unmounting stops the audio (leaving the player stops it)', async () => {
    render([S(1, 'one')]);
    await flush();
    const a = FakeAudio.all[0];
    act(() => root.unmount());
    expect(a.paused).toBe(true);
    root = createRoot(container);
  });
});
