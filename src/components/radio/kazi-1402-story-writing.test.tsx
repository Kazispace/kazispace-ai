/**
 * @vitest-environment jsdom
 *
 * KAZI-1402 — a part written while it plays (kazispace-ui personal-radio.md 0.21, Data · The audio of a part ·
 * A part written while it plays). The server may send a part before all of it is written; only the first
 * `GET renders/{render_id}` can tell, so the app asks it once for every part with a render id, then follows `state`.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RadioPlayerResponse, RadioRenderAudio } from '@/types/radio';

const m = vi.hoisted(() => ({
  save: vi.fn(),
  turn: vi.fn(),
  render: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
  toast: vi.fn(),
}));

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
    home: { prefs: { listen_window_on: false }, availability: { tts: true, asr: true, new_render: true } },
    isLoading: false,
    refresh: () => Promise.resolve(),
  }),
}));
vi.mock('@/lib/radio/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/radio/api')>()),
  getRadioSave: m.save,
  postRadioTurn: m.turn,
  getRadioRender: m.render,
}));

import {
  RENDER_POLL_LIMIT,
  RENDER_WRITING_EXTRA_MS,
  RENDER_WRITING_WAIT_MS,
  StoryPlayerScreen,
} from '@/components/radio/story-player';

class FakeAudio {
  static all: FakeAudio[] = [];
  /** Every source played, in order: a sentence replayed would show up twice. */
  static played: string[] = [];
  src = '';
  playbackRate = 1;
  paused = true;
  currentTime = 0;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    FakeAudio.all.push(this);
  }
  play() {
    this.paused = false;
    FakeAudio.played.push(this.src);
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}
const audio = () => FakeAudio.all[0];
/** The sentence now playing ends. */
const ends = async () => {
  await act(async () => audio()?.onended?.());
};
const tick = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

const profile = { band: 'B1', en_ratio: 0.4, voice_id: 'en_gb_f1', source: 'override' } as const;
const seg = (seq: number, text = `s${seq}`) => ({ seq, lang: 'en' as const, text, audio_url: `https://a/${seq}.mp3`, pending: false });

/** A turn / resume answer carrying part `n1`: its first sentence only, and no choices (the server is still writing). */
function streamed(nodeType: 'choice' | 'narration' = 'choice', nodeId = 'n1'): RadioPlayerResponse {
  return {
    save_id: 'sv1',
    save_version: 3,
    status: 'active',
    profile,
    ai_calls_used: 0,
    node: { node_id: nodeId, node_type: nodeType, render_id: `r_${nodeId}`, source: 'llm', segments: [seg(1)], choices: [] },
  };
}
function complete(nodeId = 'n1'): RadioPlayerResponse {
  return {
    ...streamed('choice', nodeId),
    node: {
      node_id: nodeId,
      node_type: 'choice',
      render_id: `r_${nodeId}`,
      source: 'cache',
      segments: [seg(1), seg(2)],
      choices: [
        { key: 'A', choice_id: 'c_a', label: 'Knock' },
        { key: 'B', choice_id: 'c_b', label: 'Leave' },
      ],
    },
  };
}
function render(over: Partial<RadioRenderAudio>, renderId = 'r_n1') {
  return { success: true, data: { render_id: renderId, voice_id: 'en_gb_f1', segments: [], choices: [], ...over } };
}
const writing = (n: number) =>
  render({ state: 'writing', segments: Array.from({ length: n }, (_, i) => seg(i + 1)) });
const done = (n: number) =>
  render({
    state: 'done',
    segments: Array.from({ length: n }, (_, i) => seg(i + 1)),
    choices: [
      { choice_id: 'c_a', label: 'Knock', audio_url: 'https://a/ca.mp3' },
      { choice_id: 'c_b', label: 'Leave', audio_url: 'https://a/cb.mp3' },
    ],
    glossary: [{ term: 'knock', gloss: '敲' }],
  });

let container: HTMLDivElement;
let root: Root;
const q = (id: string) => container.querySelector(`[data-testid="${id}"]`);
const qa = (id: string) => Array.from(container.querySelectorAll(`[data-testid="${id}"]`));
const captions = () => q('radio-captions')?.textContent ?? '';

async function mount() {
  await act(async () => {
    root.render(<StoryPlayerScreen locale="zh" saveId="sv1" from="home" />);
  });
  await act(async () => {});
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  FakeAudio.all = [];
  FakeAudio.played = [];
  vi.stubGlobal('Audio', FakeAudio);
  Element.prototype.scrollIntoView = vi.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  Object.values(m).forEach((f) => f.mockReset());
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('the first GET renders, for every part with a render id', () => {
  it('a complete part with nothing pending: one request as the resume answer arrives, then none', async () => {
    m.save.mockResolvedValue({ success: true, data: complete() });
    m.render.mockResolvedValue(render({ segments: [seg(1), seg(2)] }));
    await mount();
    expect(m.render).toHaveBeenCalledTimes(1);
    expect(m.render).toHaveBeenCalledWith('r_n1', 'en_gb_f1');
    await tick(20_000);
    expect(m.render).toHaveBeenCalledTimes(1);
    expect(qa('radio-choice').map((b) => b.textContent)).toEqual(['AKnock', 'BLeave']);
  });

  it('a turn answer carrying a new part: one request for that part too', async () => {
    m.save.mockResolvedValue({ success: true, data: complete() });
    m.turn.mockResolvedValue({ success: true, data: complete('n2') });
    m.render.mockImplementation((rid: string) => Promise.resolve(render({ segments: [seg(1), seg(2)] }, rid)));
    await mount();
    await act(async () => (qa('radio-choice')[0] as HTMLButtonElement).click());
    await act(async () => {});
    expect(m.render.mock.calls.map((c) => c[0])).toEqual(['r_n1', 'r_n2']);
  });

  it(`a complete part (no state) with a sentence that stays pending: at most ${RENDER_POLL_LIMIT} requests, 1 s apart, then no voice`, async () => {
    const data = complete();
    data.node!.segments[1] = { ...seg(2), audio_url: null, pending: true };
    m.save.mockResolvedValue({ success: true, data });
    m.render.mockResolvedValue(render({ segments: [seg(1), { seq: 2, audio_url: null, pending: true }] }));
    await mount();
    await tick(999);
    expect(m.render).toHaveBeenCalledTimes(1);
    await tick(1);
    expect(m.render).toHaveBeenCalledTimes(2);
    await tick(60_000);
    expect(m.render).toHaveBeenCalledTimes(RENDER_POLL_LIMIT);
  });
});

describe('a part written while it plays', () => {
  it('new sentences join after the ones the app has; a held sentence never changes and is never replayed', async () => {
    m.save.mockResolvedValue({ success: true, data: streamed() });
    m.render
      .mockResolvedValueOnce(writing(1))
      .mockResolvedValueOnce(render({ state: 'writing', segments: [seg(1, 'REWRITTEN'), seg(2)] }))
      .mockResolvedValue(render({ state: 'writing', segments: [seg(1), seg(2), seg(3)] }));
    await mount();
    expect(captions()).toContain('s1');
    expect(captions()).not.toContain('s2');
    await tick(1000);
    expect(captions()).toContain('s2');
    expect(captions()).not.toContain('REWRITTEN');
    await tick(1000);
    expect(captions()).toContain('s3');
    expect(captions().indexOf('s1')).toBeLessThan(captions().indexOf('s2'));
    expect(captions().indexOf('s2')).toBeLessThan(captions().indexOf('s3'));
    await ends();
    await ends();
    expect(FakeAudio.played).toEqual(['https://a/1.mp3', 'https://a/2.mp3', 'https://a/3.mp3']);
  });

  it('choices (and the glossary) only once state is done; the 10-request cap does not apply while writing', async () => {
    m.save.mockResolvedValue({ success: true, data: streamed() });
    m.render.mockResolvedValue(writing(1));
    await mount();
    await tick(20_000);
    expect(m.render.mock.calls.length).toBeGreaterThan(RENDER_POLL_LIMIT);
    expect(qa('radio-choice')).toHaveLength(0);
    m.render.mockResolvedValue(done(2));
    await tick(1000);
    expect(qa('radio-choice').map((b) => b.textContent)).toEqual(['AKnock', 'BLeave']);
    const calls = m.render.mock.calls.length;
    await tick(20_000);
    expect(m.render).toHaveBeenCalledTimes(calls); // done, nothing pending: no more requests
  });

  it('narration waits silently at the last ready sentence, then goes on; the part ends only at done', async () => {
    m.save.mockResolvedValue({ success: true, data: streamed('narration') });
    m.turn.mockResolvedValue({ success: true, data: complete('n2') });
    m.render.mockResolvedValue(writing(1));
    await mount();
    await ends(); // s1 played to its end; the part is still being written
    const html = container.innerHTML;
    await tick(5000);
    expect(m.turn).not.toHaveBeenCalled(); // no "advance": the part has not ended
    expect(FakeAudio.played).toEqual(['https://a/1.mp3']);
    expect(container.innerHTML).toBe(html); // silent: no spinner, no text, nothing new on screen
    m.render.mockResolvedValue(writing(2));
    await tick(1000);
    expect(FakeAudio.played).toEqual(['https://a/1.mp3', 'https://a/2.mp3']); // straight on with the new one
    await ends();
    expect(m.turn).not.toHaveBeenCalled();
    m.render.mockResolvedValue(render({ state: 'done', segments: [seg(1), seg(2)] }));
    await tick(1000);
    expect(m.turn).toHaveBeenCalledTimes(1);
    expect(m.turn.mock.calls[0][3]).toEqual({ kind: 'command', command: 'advance' });
  });

  it('choices that came in the answer are not shown while the part is still being written', async () => {
    const data = streamed();
    data.node!.choices = [{ key: 'A', choice_id: 'c_a', label: 'Knock' }];
    m.save.mockResolvedValue({ success: true, data });
    m.render.mockResolvedValue(writing(1));
    await mount();
    expect(qa('radio-choice')).toHaveLength(0);
    m.render.mockResolvedValue(done(1));
    await tick(1000);
    expect(qa('radio-choice').map((b) => b.textContent)).toEqual(['AKnock', 'BLeave']);
  });

  it('done on the very first request: the choices come from GET renders, lettered in order', async () => {
    m.save.mockResolvedValue({ success: true, data: streamed() });
    m.render.mockResolvedValue(done(3));
    await mount();
    expect(captions()).toContain('s3');
    expect(qa('radio-choice').map((b) => b.textContent)).toEqual(['AKnock', 'BLeave']);
  });
});

describe('45 seconds still writing', () => {
  it('GET saves once; still without choices ⇒ one more minute of GET renders ⇒ "content cannot be found"', async () => {
    m.save.mockResolvedValue({ success: true, data: streamed() });
    m.render.mockResolvedValue(writing(1));
    await mount();
    expect(m.save).toHaveBeenCalledTimes(1); // the resume
    await tick(RENDER_WRITING_WAIT_MS - 1000);
    expect(m.save).toHaveBeenCalledTimes(1);
    await tick(1000);
    expect(m.save).toHaveBeenCalledTimes(2); // asked once, after 45 s
    const atSave = m.render.mock.calls.length;
    expect(atSave).toBeLessThanOrEqual(RENDER_WRITING_WAIT_MS / 1000 + 1); // ≤ 1 a second
    expect(q('radio-story-missing')).toBeNull();
    await tick(RENDER_WRITING_EXTRA_MS - 1000);
    expect(q('radio-story-missing')).toBeNull();
    expect(m.render.mock.calls.length).toBeGreaterThan(atSave + 50); // kept asking during that minute
    await tick(1000);
    expect(q('radio-story-missing')?.textContent).toContain('radio.contentMissing');
    expect(m.save).toHaveBeenCalledTimes(2);
    const last = m.render.mock.calls.length;
    await tick(10_000);
    expect(m.render).toHaveBeenCalledTimes(last); // stopped
  });

  it('GET saves has the part ended with its choices ⇒ goes on from there, nothing replayed', async () => {
    const ended = complete();
    ended.node!.segments = [seg(1), seg(2), seg(3)];
    m.save.mockResolvedValueOnce({ success: true, data: streamed() }).mockResolvedValueOnce({ success: true, data: ended });
    m.render.mockResolvedValue(writing(1));
    await mount();
    await tick(RENDER_WRITING_WAIT_MS);
    expect(m.save).toHaveBeenCalledTimes(2);
    expect(captions()).toContain('s3');
    expect(qa('radio-choice').map((b) => b.textContent)).toEqual(['AKnock', 'BLeave']);
    expect(FakeAudio.played).toEqual(['https://a/1.mp3']);
    const calls = m.render.mock.calls.length;
    await tick(10_000);
    expect(m.render).toHaveBeenCalledTimes(calls);
    expect(q('radio-story-missing')).toBeNull();
  });

  it('GET saves fails ⇒ "content cannot be found"', async () => {
    m.save.mockResolvedValueOnce({ success: true, data: streamed() }).mockResolvedValueOnce({ success: false, status: 500 });
    m.render.mockResolvedValue(writing(1));
    await mount();
    await tick(RENDER_WRITING_WAIT_MS);
    expect(q('radio-story-missing')?.textContent).toContain('radio.contentMissing');
  });
});
