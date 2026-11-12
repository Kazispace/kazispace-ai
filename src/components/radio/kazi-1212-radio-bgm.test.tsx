/**
 * @vitest-environment jsdom
 *
 * KAZI-1212 — background music under the host's voice (kazispace-ui personal-radio.md, Player · Background
 * music): the story page and the program page only, when `GET bgm` has a track and `bgm_on` is not false;
 * one random track per listening session, looped; from the first sentence that has audio (after the AI
 * rhythm); paused with the user's pause and while the microphone records; stopped on leaving; its level
 * `bgm_level` dB below the voice through a Web Audio gain node, never the element's volume; and no music
 * at all when the gain cannot be applied.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RadioPlayerResponse } from '@/types/radio';

const m = vi.hoisted(() => ({
  save: vi.fn(),
  turn: vi.fn(),
  render: vi.fn(),
  program: vi.fn(),
  bgm: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
  toast: vi.fn(),
}));
const region = vi.hoisted(() => ({
  label: true,
  prefs: { listen_window_on: false } as { listen_window_on: boolean; bgm_on?: boolean | null; bgm_level?: number | null },
}));
const mic = vi.hoisted(() => ({ state: 'idle' as 'idle' | 'starting' | 'window' | 'recording' }));

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: m.replace, push: m.push }) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('@/hooks/use-auth-ready', () => ({ useAuthReady: () => ({ ready: true, authenticated: true }) }));
vi.mock('@/lib/store', () => ({
  useUIStore: (select: (s: { showToast: typeof m.toast }) => unknown) => select({ showToast: m.toast }),
}));
vi.mock('@/hooks/use-radio-home', () => ({
  useRadioHome: () => ({
    access: 'open',
    home: {
      prefs: region.prefs,
      availability: { tts: true, asr: true, new_render: true, aigc_label: region.label },
    },
    isLoading: false,
    refresh: () => Promise.resolve(),
  }),
}));
vi.mock('@/hooks/use-radio-mic', () => ({
  useRadioMic: () => ({
    state: mic.state,
    level: 0,
    open: async () => 'ok',
    record: () => undefined,
    done: () => undefined,
    cancel: () => undefined,
  }),
}));
vi.mock('@/lib/radio/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/radio/api')>()),
  getRadioSave: m.save,
  postRadioTurn: m.turn,
  getRadioRender: m.render,
  getRadioProgram: m.program,
}));
vi.mock('@/lib/radio/player-api', async (orig) => ({
  ...(await orig<typeof import('@/lib/radio/player-api')>()),
  getRadioBgm: m.bgm,
}));

import { ProgramPlayerScreen } from '@/components/radio/program-player';
import { StoryPlayerScreen } from '@/components/radio/story-player';
import { bgmGain, resetBgmContextForTests } from '@/hooks/use-bgm';

const MORSE = '/audio/aigc-ai-morse.wav';
const T1 = 'https://m/t1.mp3';
const T2 = 'https://m/t2.mp3';

class FakeAudio {
  static all: FakeAudio[] = [];
  private _src = '';
  crossOrigin: string | null = null;
  /** `crossOrigin` as it was when `src` was set. */
  crossOriginAtSrc: string | null | undefined = undefined;
  loop = false;
  preload = '';
  volume = 1;
  playbackRate = 1;
  paused = true;
  currentTime = 0;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onloadedmetadata: (() => void) | null = null;
  ontimeupdate: (() => void) | null = null;
  played: string[] = [];
  constructor() {
    FakeAudio.all.push(this);
  }
  get src() {
    return this._src;
  }
  set src(v: string) {
    if (this.crossOriginAtSrc === undefined) this.crossOriginAtSrc = this.crossOrigin;
    this._src = v;
  }
  removeAttribute(name: string) {
    if (name === 'src') this._src = '';
  }
  load() {}
  play() {
    this.played.push(this._src);
    // As a browser does: an element with no source refuses to play (#298 R1).
    if (!this._src) return Promise.reject(new DOMException('no source', 'NotSupportedError'));
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

class FakeNode {
  connected: unknown[] = [];
  disconnected = false;
  connect(to: unknown) {
    this.connected.push(to);
  }
  disconnect() {
    this.disconnected = true;
  }
}
class FakeGain extends FakeNode {
  gain = { value: 1 };
}
class FakeAudioContext {
  static all: FakeAudioContext[] = [];
  /** The state a new context starts in. */
  static initial: 'running' | 'suspended' = 'running';
  /** `resume()` rejects. */
  static resumeFails = false;
  /** `resume()` works only inside a tap (as on iOS). */
  static needsTap = false;
  static inTap = false;
  state: string;
  destination = { name: 'destination' };
  sources: { el: FakeAudio; node: FakeNode }[] = [];
  gains: FakeGain[] = [];
  private listeners = new Set<() => void>();
  constructor() {
    this.state = FakeAudioContext.initial;
    FakeAudioContext.all.push(this);
  }
  createMediaElementSource(el: FakeAudio) {
    const node = new FakeNode();
    this.sources.push({ el, node });
    return node;
  }
  createGain() {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  resume() {
    if (FakeAudioContext.resumeFails) return Promise.reject(new Error('cannot start'));
    if (!FakeAudioContext.needsTap || FakeAudioContext.inTap) {
      this.state = 'running';
      this.listeners.forEach((f) => f());
    }
    return Promise.resolve();
  }
  suspend() {
    this.state = 'suspended';
    this.listeners.forEach((f) => f());
    return Promise.resolve();
  }
  addEventListener(_: string, f: () => void) {
    this.listeners.add(f);
  }
  removeEventListener(_: string, f: () => void) {
    this.listeners.delete(f);
  }
}

/** The music's element is the looped one; the voice's is the other one. */
const voice = () => FakeAudio.all.filter((a) => !a.loop)[0];
const music = () => FakeAudio.all.filter((a) => a.loop);
const bgm = () => music()[0] ?? null;
const ctx = () => FakeAudioContext.all[0];

const profile = { band: 'B1', en_ratio: 0.4, voice_id: 'en_gb_f1', source: 'override' } as const;
function story(nodeId = 'n1', nodeType = 'narration', firstAudio = true): RadioPlayerResponse {
  return {
    save_id: 'sv1',
    save_version: 3,
    status: 'active',
    profile,
    ai_calls_used: 0,
    node: {
      node_id: nodeId,
      node_type: nodeType,
      render_id: `r_${nodeId}`,
      source: 'cache',
      segments: [
        { seq: 1, lang: 'en', text: `${nodeId} first`, audio_url: firstAudio ? `https://a/${nodeId}-1.mp3` : null, pending: false },
        { seq: 2, lang: 'zh', text: `${nodeId} second`, audio_url: `https://a/${nodeId}-2.mp3`, pending: false },
      ],
      choices: [],
    },
  } as RadioPlayerResponse;
}
const program = (id: string, firstAudio = true) => ({
  program_id: id,
  title: '今日一句',
  band: 'B1',
  voice_id: 'en_gb_f1',
  duration_ms: 6000,
  segments: [
    { seq: 1, text: 'Line one.', audio_url: firstAudio ? `https://a/${id}-1.mp3` : null, start_ms: 0 },
    { seq: 2, text: 'Line two.', audio_url: `https://a/${id}-2.mp3`, start_ms: 3000 },
  ],
});

let container: HTMLDivElement;
let root: Root;
const q = (id: string) => container.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const settle = () =>
  act(async () => {
    for (let i = 0; i < 6; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

async function mountStory() {
  await act(async () => root.render(<StoryPlayerScreen locale="zh" saveId="sv1" from="home" />));
  await settle();
}
async function mountProgram(id = 'p1') {
  await act(async () => root.render(<ProgramPlayerScreen locale="zh" programId={id} />));
  await settle();
}
/** The voice's current sound ends. */
const end = async () => {
  await act(async () => voice().onended?.());
  await settle();
};
const tap = async (el: HTMLElement = document.body) => {
  FakeAudioContext.inTap = true;
  await act(async () => el.click());
  FakeAudioContext.inTap = false;
  await settle();
};
const button = (label: string) =>
  Array.from(container.querySelectorAll('button')).find((b) => b.getAttribute('aria-label') === label) as HTMLButtonElement;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  FakeAudio.all = [];
  FakeAudioContext.all = [];
  FakeAudioContext.initial = 'running';
  FakeAudioContext.resumeFails = false;
  FakeAudioContext.needsTap = false;
  FakeAudioContext.inTap = false;
  resetBgmContextForTests();
  vi.stubGlobal('Audio', FakeAudio);
  vi.stubGlobal('AudioContext', FakeAudioContext);
  Element.prototype.scrollIntoView = vi.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  Object.values(m).forEach((f) => f.mockReset());
  region.label = true;
  region.prefs = { listen_window_on: false };
  mic.state = 'idle';
  m.save.mockResolvedValue({ success: true, status: 200, data: story() });
  m.turn.mockResolvedValue({ success: true, status: 200, data: story('n2') });
  m.program.mockImplementation((id: string) => Promise.resolve({ success: true, status: 200, data: program(id) }));
  m.bgm.mockResolvedValue({
    success: true,
    status: 200,
    data: {
      tracks: [
        { track_id: 't1', title: 'One', audio_url: T1 },
        { track_id: 't2', title: 'Two', audio_url: T2 },
      ],
    },
  });
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the level', () => {
  it('is 10^(dB/20) of the voice; null ⇒ −18 dB; held to −30 … −12', () => {
    expect(bgmGain(null)).toBeCloseTo(Math.pow(10, -18 / 20), 10);
    expect(bgmGain(undefined)).toBeCloseTo(0.12589, 4);
    expect(bgmGain(-24)).toBeCloseTo(Math.pow(10, -24 / 20), 10);
    expect(bgmGain(-12)).toBeCloseTo(Math.pow(10, -12 / 20), 10);
    expect(bgmGain(-60)).toBeCloseTo(Math.pow(10, -30 / 20), 10);
    expect(bgmGain(0)).toBeCloseTo(Math.pow(10, -12 / 20), 10);
  });
});

describe('the story page', () => {
  it('after the AI rhythm, with the first voiced sentence: one looped track, through a gain node at −18 dB', async () => {
    await mountStory();
    expect(m.bgm).toHaveBeenCalledTimes(1);
    expect(voice().src).toBe(MORSE);
    const el = bgm();
    expect(el).not.toBeNull();
    expect(el!.paused).toBe(true); // not under the rhythm
    expect(el!.played).toEqual([]);
    await end(); // the rhythm → sentence 1
    expect(voice().src).toBe('https://a/n1-1.mp3');
    expect(el!.paused).toBe(false);
    expect([T1, T2]).toContain(el!.src);
    expect(el!.loop).toBe(true);
    // crossOrigin before src; the level only through the gain node
    expect(el!.crossOriginAtSrc).toBe('anonymous');
    expect(el!.volume).toBe(1);
    const c = ctx();
    expect(c.sources.map((s) => s.el)).toEqual([el]);
    expect(c.sources[0].node.connected).toEqual([c.gains[0]]);
    expect(c.gains[0].connected).toEqual([c.destination]);
    expect(c.gains[0].gain.value).toBeCloseTo(Math.pow(10, -18 / 20), 10);
  });

  it('the user’s level: bgm_level dB below the voice', async () => {
    region.prefs = { listen_window_on: false, bgm_level: -24 };
    await mountStory();
    await end();
    expect(bgm()!.paused).toBe(false);
    expect(ctx().gains[0].gain.value).toBeCloseTo(Math.pow(10, -24 / 20), 10);
    expect(bgm()!.volume).toBe(1);
  });

  it('where the region need not label: with the first sentence', async () => {
    region.label = false;
    await mountStory();
    expect(voice().src).toBe('https://a/n1-1.mp3');
    expect(bgm()!.paused).toBe(false);
  });

  it('a first sentence with no audio: the music waits for the first one that has', async () => {
    region.label = false;
    m.save.mockResolvedValue({ success: true, status: 200, data: story('n1', 'narration', false) });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await mountStory();
      expect(bgm()!.paused).toBe(true); // a reading pause
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2500);
      });
      await settle();
      expect(voice().src).toBe('https://a/n1-2.mp3');
      expect(bgm()!.paused).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('pauses with the user’s pause and resumes with play, the same track from the same place', async () => {
    await mountStory();
    await end();
    const el = bgm()!;
    const src = el.src;
    await act(async () => button('radio.player.pause').click());
    expect(el.paused).toBe(true);
    await act(async () => button('radio.player.play').click());
    await settle();
    expect(el.paused).toBe(false);
    expect(el.src).toBe(src);
    expect(music()).toHaveLength(1);
  });

  it('a music play interrupted by a pause is not a failed track: GET bgm is not asked again, the music goes on', async () => {
    const original = FakeAudio.prototype.play;
    let interruptOnce = true;
    FakeAudio.prototype.play = function (this: FakeAudio) {
      if (this.loop && interruptOnce) {
        interruptOnce = false;
        this.played.push(this.src);
        return Promise.reject(new DOMException('interrupted by pause()', 'AbortError'));
      }
      return original.call(this);
    };
    try {
      await mountStory();
      await end();
      const el = bgm()!;
      expect(m.bgm).toHaveBeenCalledTimes(1);
      await act(async () => button('radio.player.pause').click());
      await act(async () => button('radio.player.play').click());
      await settle();
      expect(m.bgm).toHaveBeenCalledTimes(1);
      expect(el.paused).toBe(false);
    } finally {
      FakeAudio.prototype.play = original;
    }
  });

  it('pauses while the microphone records and resumes when the recording ends', async () => {
    await mountStory();
    await end();
    const el = bgm()!;
    mic.state = 'recording';
    await mountStory(); // re-render with the microphone recording
    expect(el.paused).toBe(true);
    mic.state = 'idle';
    await mountStory();
    expect(el.paused).toBe(false);
  });

  it('one track for the whole visit: the next part keeps it', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    await mountStory();
    await end(); // rhythm
    await end(); // sentence 1
    await end(); // sentence 2 → advance
    await settle();
    expect(m.turn).toHaveBeenCalled();
    expect(voice().src).toBe('https://a/n2-1.mp3');
    expect(music()).toHaveLength(1);
    expect(bgm()!.src).toBe(T2);
    expect(bgm()!.paused).toBe(false);
    expect(random).toHaveBeenCalledTimes(1);
    expect(m.bgm).toHaveBeenCalledTimes(1);
  });

  it('stops at the story’s ending', async () => {
    m.turn.mockResolvedValue({ success: true, status: 200, data: story('end1', 'ending') });
    await mountStory();
    await end();
    await end();
    await end(); // → the ending
    await settle();
    expect(bgm()!.paused).toBe(true);
  });

  it('stops when the user leaves the page', async () => {
    await mountStory();
    await end();
    const el = bgm()!;
    act(() => root.unmount());
    expect(el.paused).toBe(true);
    expect(ctx().sources[0].node.disconnected).toBe(true);
    root = createRoot(container);
  });

  it('no tracks: nothing', async () => {
    m.bgm.mockResolvedValue({ success: true, status: 200, data: { tracks: [] } });
    await mountStory();
    await end();
    expect(music()).toHaveLength(0);
    expect(FakeAudio.all).toHaveLength(1);
  });

  it('GET bgm fails: nothing, the voice carries on', async () => {
    m.bgm.mockResolvedValue({ success: false, status: 500 });
    await mountStory();
    await end();
    expect(music()).toHaveLength(0);
    expect(voice().src).toBe('https://a/n1-1.mp3');
  });

  it('bgm_on false: GET bgm is not asked and nothing plays; null means on', async () => {
    region.prefs = { listen_window_on: false, bgm_on: false };
    await mountStory();
    await end();
    expect(m.bgm).not.toHaveBeenCalled();
    expect(music()).toHaveLength(0);
  });

  it('no Web Audio: no music at all (not even at the element’s volume), and GET bgm is not asked', async () => {
    vi.stubGlobal('AudioContext', undefined);
    await mountStory();
    await end();
    expect(m.bgm).not.toHaveBeenCalled();
    expect(FakeAudio.all).toHaveLength(1);
  });

  it('the audio context cannot start: no music, no volume change', async () => {
    FakeAudioContext.initial = 'suspended';
    FakeAudioContext.resumeFails = true;
    await mountStory();
    await end();
    await tap();
    const el = bgm()!;
    expect(el.played).toEqual([]);
    expect(el.paused).toBe(true);
    expect(el.volume).toBe(1);
  });

  it('a refused resume is not final: a later tap still starts the music (#297 R1)', async () => {
    FakeAudioContext.initial = 'suspended';
    FakeAudioContext.resumeFails = true;
    await mountStory();
    await end();
    await tap();
    expect(bgm()!.played).toEqual([]);
    FakeAudioContext.resumeFails = false; // e.g. the user's tap now counts as activation
    await tap();
    expect(ctx().state).toBe('running');
    expect(bgm()!.played.length).toBeGreaterThan(0);
    expect(bgm()!.volume).toBe(1);
  });

  it('the gain node cannot be made: no element plays and none gets the music url (never full volume) (#297 R1)', async () => {
    const original = FakeAudioContext.prototype.createMediaElementSource;
    FakeAudioContext.prototype.createMediaElementSource = function () {
      throw new Error('no source');
    } as never;
    try {
      await mountStory();
      await end();
      await tap();
      const playing = FakeAudio.all.filter((a) => a.played.some((p) => String(p[0] ?? p).includes('https://m/')));
      expect(playing).toEqual([]);
      expect(FakeAudio.all.filter((a) => a.loop && a.src)).toEqual([]);
    } finally {
      FakeAudioContext.prototype.createMediaElementSource = original;
    }
  });

  it('a locked audio context: the music waits for the first tap on the page, then plays', async () => {
    FakeAudioContext.initial = 'suspended';
    FakeAudioContext.needsTap = true;
    await mountStory();
    await end();
    const el = bgm()!;
    expect(el.played).toEqual([]);
    await tap();
    expect(ctx().state).toBe('running');
    expect(el.paused).toBe(false);
    expect(el.volume).toBe(1);
  });

  it('a tap before GET bgm answers unlocks too: the music then plays with no second tap (iOS N8 check 4)', async () => {
    FakeAudioContext.initial = 'suspended';
    FakeAudioContext.needsTap = true;
    let answer: (v: unknown) => void = () => undefined;
    m.bgm.mockReturnValue(new Promise((r) => (answer = r)));
    await mountStory();
    expect(bgm()).toBeNull();
    await tap();
    expect(ctx().state).toBe('running');
    const primed = FakeAudio.all.filter((a) => a.crossOrigin === 'anonymous');
    expect(primed).toHaveLength(1);
    // Played inside the tap, with no source yet: that play is what iOS counts (#298 R1).
    expect(primed[0].played).toEqual(['']);
    await act(async () => answer({ success: true, status: 200, data: { tracks: [{ track_id: 't1', title: 'One', audio_url: T1 }] } }));
    await settle();
    await end();
    const el = bgm()!;
    expect(el).toBe(primed[0]);
    expect(el.src).toBe(T1);
    expect(el.paused).toBe(false);
    expect(ctx().gains[0].gain.value).toBeCloseTo(10 ** (-18 / 20));
  });

  it('a tap before GET bgm answers with no tracks: the context is suspended and the made element dropped', async () => {
    let answer: (v: unknown) => void = () => undefined;
    m.bgm.mockReturnValue(new Promise((r) => (answer = r)));
    await mountStory();
    await tap();
    expect(ctx().state).toBe('running');
    await act(async () => answer({ success: true, status: 200, data: { tracks: [] } }));
    await settle();
    await end();
    expect(ctx().state).toBe('suspended');
    expect(bgm()).toBeNull();
  });

  it('GET bgm answered with no tracks: a tap makes no audio context and no element', async () => {
    m.bgm.mockResolvedValue({ success: true, status: 200, data: { tracks: [] } });
    await mountStory();
    const before = FakeAudio.all.length;
    await tap();
    expect(FakeAudioContext.all).toHaveLength(0);
    expect(FakeAudio.all.length).toBe(before);
  });

  it('an expired URL: GET bgm is asked again once, and the same track carries on from where it was', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    await mountStory();
    await end();
    const el = bgm()!;
    expect(el.src).toBe(T1);
    el.currentTime = 42;
    m.bgm.mockResolvedValueOnce({
      success: true,
      status: 200,
      data: {
        tracks: [
          { track_id: 't2', title: 'Two', audio_url: `${T2}?fresh` },
          { track_id: 't1', title: 'One', audio_url: `${T1}?fresh` },
        ],
      },
    });
    await act(async () => el.onerror?.());
    await settle();
    expect(m.bgm).toHaveBeenCalledTimes(2);
    expect(el.src).toBe(`${T1}?fresh`); // the same track, by track_id
    expect(el.paused).toBe(true); // until it has loaded
    el.currentTime = 0; // a new source starts at 0
    await act(async () => el.onloadedmetadata?.());
    await settle();
    expect(el.currentTime).toBe(42);
    expect(el.paused).toBe(false);
    expect(el.volume).toBe(1);
    expect(music()).toHaveLength(1); // the same element, still behind the gain node
    expect(ctx().sources.map((x) => x.el)).toEqual([el]);
  });

  it('a second error: the track is skipped for the session, silently; the voice carries on', async () => {
    await mountStory();
    await end();
    const el = bgm()!;
    await act(async () => el.onerror?.());
    await settle();
    await act(async () => el.onloadedmetadata?.());
    await settle();
    expect(el.paused).toBe(false);
    await act(async () => el.onerror?.());
    await settle();
    expect(el.paused).toBe(true);
    expect(m.bgm).toHaveBeenCalledTimes(2); // asked again once, not twice
    await act(async () => button('radio.player.pause').click());
    await act(async () => button('radio.player.play').click());
    await settle();
    expect(el.paused).toBe(true);
    expect(el.volume).toBe(1);
    expect(m.toast).not.toHaveBeenCalled();
    expect(voice().paused).toBe(false);
  });

  it('the track is gone from GET bgm when asked again: no music for the session, silently', async () => {
    await mountStory();
    await end();
    const el = bgm()!;
    const played = el.played.length;
    m.bgm.mockResolvedValueOnce({ success: true, status: 200, data: { tracks: [{ track_id: 'other', title: 'X', audio_url: 'https://m/x.mp3' }] } });
    await act(async () => el.onerror?.());
    await settle();
    await act(async () => el.onloadedmetadata?.());
    expect(el.paused).toBe(true);
    expect(el.played).toHaveLength(played);
    expect(el.volume).toBe(1);
  });

  it('iOS: the audio session is set to playback, so the ringer switch does not mute the music', async () => {
    const session = { type: 'auto' };
    Object.defineProperty(navigator, 'audioSession', { value: session, configurable: true });
    FakeAudioContext.initial = 'suspended';
    try {
      await mountStory();
      await end();
      expect(session.type).toBe('playback');
      expect(bgm()!.paused).toBe(false);
    } finally {
      delete (navigator as { audioSession?: unknown }).audioSession;
    }
  });
});

describe('the program page', () => {
  it('after the rhythm, loops one track; pauses with pause; pauses at the end of the programme', async () => {
    await mountProgram();
    expect(bgm()!.paused).toBe(true);
    await end(); // rhythm
    const el = bgm()!;
    expect(el.paused).toBe(false);
    expect(el.loop).toBe(true);
    await act(async () => button('radio.player.pause').click());
    expect(el.paused).toBe(true);
    await act(async () => button('radio.player.play').click());
    await settle();
    expect(el.paused).toBe(false);
    await end(); // line one
    await end(); // line two → played to its end
    expect(q('radio-program-done')).not.toBeNull();
    expect(el.paused).toBe(true);
  });

  it('pauses while the microphone records', async () => {
    await mountProgram();
    await end();
    mic.state = 'recording';
    await mountProgram();
    expect(bgm()!.paused).toBe(true);
    mic.state = 'idle';
    await mountProgram();
    expect(bgm()!.paused).toBe(false);
  });

  it('a new programme played: a new random pick', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.99);
    region.label = false;
    await mountProgram('p1');
    expect(bgm()!.src).toBe(T1);
    expect(bgm()!.paused).toBe(false);
    const first = bgm()!;
    await mountProgram('p2');
    expect(first.paused).toBe(true);
    const now = music().filter((a) => a !== first);
    expect(now).toHaveLength(1);
    expect(now[0].src).toBe(T2);
    expect(now[0].paused).toBe(false);
    expect(random).toHaveBeenCalledTimes(2);
  });
});

describe('Live Room', () => {
  it('has no background music', () => {
    const src = readFileSync(join(__dirname, 'live-screen.tsx'), 'utf8') + readFileSync(join(__dirname, 'live-section.tsx'), 'utf8');
    expect(src).not.toMatch(/use-bgm|useBgm|getRadioBgm/);
  });
});
