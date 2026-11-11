/**
 * @vitest-environment jsdom
 *
 * KAZI-1242 — `useSentencePlayer({ preroll })`: the Morse "AI" rhythm before the first sentence with audio.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSentencePlayer, type PlayableSentence, type PlayerSpeed } from '@/hooks/use-sentence-player';

class FakeAudio {
  static all: FakeAudio[] = [];
  src = '';
  playbackRate = 1;
  paused = true;
  currentTime = 0;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeupdate: (() => void) | null = null;
  played: [string, number][] = [];
  constructor() {
    FakeAudio.all.push(this);
  }
  play() {
    this.paused = false;
    this.played.push([this.src, this.playbackRate]);
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

let api: ReturnType<typeof useSentencePlayer>;
const listened: number[] = [];
function Harness({ sentences, speed = 1, preroll, element, hold }: { sentences: PlayableSentence[]; speed?: PlayerSpeed; preroll: string | null; element?: HTMLAudioElement; hold?: boolean }) {
  api = useSentencePlayer({ sentences, speed, autoplay: true, preroll, element, hold, onPlayed: (ms) => listened.push(ms) });
  return null;
}

let container: HTMLDivElement;
let root: Root;
const a = () => FakeAudio.all[0];

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  FakeAudio.all = [];
  listened.length = 0;
  vi.stubGlobal('Audio', FakeAudio);
  container = document.createElement('div');
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const S = (seq: number, url: string | null): PlayableSentence => ({ seq, text: `s${seq}`, audioUrl: url });

describe('preroll', () => {
  it('plays before the first sentence, at 1.0× even at 0.75×; index stays on that sentence; prerolling while it plays', async () => {
    await act(async () => root.render(<Harness sentences={[S(1, 'u1'), S(2, 'u2')]} speed={0.75} preroll="/m.wav" />));
    expect(a().played).toEqual([['/m.wav', 1]]);
    expect(api.index).toBe(0);
    expect(api.prerolling).toBe(true);
    expect(api.offsetMs()).toBe(0);
    await act(async () => a().onended?.());
    expect(api.prerolling).toBe(false);
    expect(a().played[1]).toEqual(['u1', 0.75]);
  });

  it('at 1.0× even through an element left at 0.75× by earlier audio', async () => {
    const el = new FakeAudio();
    el.playbackRate = 0.75;
    await act(async () => root.render(<Harness sentences={[S(1, 'u1')]} speed={0.75} preroll="/m.wav" element={el as unknown as HTMLAudioElement} />));
    expect(el.played[0]).toEqual(['/m.wav', 1]);
  });

  it('adds nothing to the listened time', async () => {
    await act(async () => root.render(<Harness sentences={[S(1, 'u1')]} preroll="/m.wav" />));
    a().currentTime = 1;
    await act(async () => a().ontimeupdate?.());
    expect(listened).toEqual([]);
  });

  it('a first sentence with no audio: the rhythm waits for the first sentence that has', async () => {
    await act(async () => root.render(<Harness sentences={[S(1, null), S(2, 'u2')]} preroll="/m.wav" />));
    expect(FakeAudio.all).toHaveLength(0); // a reading pause, nothing played
    await act(async () => void vi.advanceTimersByTime(3000));
    expect(a().played[0]).toEqual(['/m.wav', 1]);
    expect(api.index).toBe(1);
  });

  it('never twice: repeat and a new list play no rhythm', async () => {
    const list = [S(1, 'u1')];
    await act(async () => root.render(<Harness sentences={list} preroll="/m.wav" />));
    await act(async () => a().onended?.()); // rhythm
    await act(async () => api.repeat());
    await act(async () => root.render(<Harness sentences={[S(1, 'v1')]} preroll="/m.wav" />));
    expect(a().played.filter((p) => p[0] === '/m.wav')).toHaveLength(1);
  });

  it('a speed change during the rhythm does not touch it', async () => {
    await act(async () => root.render(<Harness sentences={[S(1, 'u1')]} preroll="/m.wav" />));
    await act(async () => root.render(<Harness sentences={[S(1, 'u1')]} speed={0.75} preroll="/m.wav" />));
    expect(a().playbackRate).toBe(1);
  });

  it('no preroll: nothing extra', async () => {
    await act(async () => root.render(<Harness sentences={[S(1, 'u1')]} preroll={null} />));
    expect(a().played).toEqual([['u1', 1]]);
    expect(api.prerolling).toBe(false);
  });
});

describe('hold: the preroll is not known yet (KAZI-1242, www.kazispace.cn 2026-11-10: a story opened by its link)', () => {
  it('nothing plays while held; once released with the rhythm known, the rhythm first, then the first sentence', async () => {
    await act(async () => root.render(<Harness sentences={[S(1, 'u1'), S(2, 'u2')]} preroll={null} hold />));
    expect(FakeAudio.all.flatMap((x) => x.played)).toEqual([]);
    await act(async () => root.render(<Harness sentences={[S(1, 'u1'), S(2, 'u2')]} preroll="/m.wav" hold={false} />));
    expect(a().played).toEqual([['/m.wav', 1]]);
    await act(async () => a().onended?.());
    expect(a().played[1]).toEqual(['u1', 1]);
  });

  it('a jump asked for while held (resume from sentence 2) starts there on release, after the rhythm', async () => {
    await act(async () => root.render(<Harness sentences={[S(1, 'u1'), S(2, 'u2')]} preroll={null} hold />));
    await act(async () => api.playFrom(1));
    expect(FakeAudio.all.flatMap((x) => x.played)).toEqual([]);
    await act(async () => root.render(<Harness sentences={[S(1, 'u1'), S(2, 'u2')]} preroll="/m.wav" hold={false} />));
    await act(async () => a().onended?.());
    expect(a().played.map((p) => p[0])).toEqual(['/m.wav', 'u2']);
  });

  it('released with no rhythm needed: the first sentence, once', async () => {
    await act(async () => root.render(<Harness sentences={[S(1, 'u1')]} preroll={null} hold />));
    await act(async () => root.render(<Harness sentences={[S(1, 'u1')]} preroll={null} hold={false} />));
    expect(a().played).toEqual([['u1', 1]]);
  });

  it('paused while held: it stays paused on release', async () => {
    await act(async () => root.render(<Harness sentences={[S(1, 'u1')]} preroll={null} hold />));
    await act(async () => api.pause());
    await act(async () => root.render(<Harness sentences={[S(1, 'u1')]} preroll="/m.wav" hold={false} />));
    expect(FakeAudio.all.flatMap((x) => x.played)).toEqual([]);
  });
});
