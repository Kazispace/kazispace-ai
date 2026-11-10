/**
 * @vitest-environment jsdom
 *
 * KAZI-1242 — the explicit AI label on the radio's players (D20 = E1; kazispace-ui personal-radio.md "AI label";
 * design player spec §5.7): where `availability.aigc_label` is true, the line "本音频由人工智能生成" under the
 * header on the story page and the programme page, and the Morse "AI" rhythm once per listening session
 * (a story's visit; each programme played: the user, 2026-11-10, 「节目也播一次」), before the first voiced
 * sentence, at 1.0×, never cut short by the microphone (「放完才能录音」).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RadioPlayerResponse } from '@/types/radio';

const m = vi.hoisted(() => ({ save: vi.fn(), turn: vi.fn(), render: vi.fn(), program: vi.fn(), replace: vi.fn(), push: vi.fn(), toast: vi.fn() }));
const region = vi.hoisted(() => ({ label: true }));

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
      prefs: { listen_window_on: false },
      availability: { tts: true, asr: true, new_render: true, aigc_label: region.label },
    },
    isLoading: false,
    refresh: () => Promise.resolve(),
  }),
}));
vi.mock('@/lib/radio/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/radio/api')>()),
  getRadioSave: m.save,
  postRadioTurn: m.turn,
  getRadioRender: m.render,
  getRadioProgram: m.program,
}));

import { ProgramPlayerScreen } from '@/components/radio/program-player';
import { StoryPlayerScreen } from '@/components/radio/story-player';

const MORSE = '/audio/aigc-ai-morse.wav';

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
const audio = () => FakeAudio.all[0];
const srcs = () => audio().played.map((p) => p[0]);

const profile = { band: 'B1', en_ratio: 0.4, voice_id: 'en_gb_f1', source: 'override' } as const;
function story(nodeId = 'n1'): RadioPlayerResponse {
  return {
    save_id: 'sv1',
    save_version: 3,
    status: 'active',
    profile,
    ai_calls_used: 0,
    node: {
      node_id: nodeId,
      node_type: 'narration',
      render_id: `r_${nodeId}`,
      source: 'cache',
      segments: [
        { seq: 1, lang: 'en', text: `${nodeId} first`, audio_url: `https://a/${nodeId}-1.mp3`, pending: false },
        { seq: 2, lang: 'zh', text: `${nodeId} second`, audio_url: `https://a/${nodeId}-2.mp3`, pending: false },
      ],
      choices: [],
    },
  } as RadioPlayerResponse;
}
const PROGRAM = {
  program_id: 'p1',
  title: '今日一句',
  band: 'B1',
  voice_id: 'en_gb_f1',
  duration_ms: 6000,
  segments: [
    { seq: 1, text: 'Line one.', audio_url: 'https://a/p1.mp3', start_ms: 0 },
    { seq: 2, text: 'Line two.', audio_url: 'https://a/p2.mp3', start_ms: 3000 },
  ],
};

let container: HTMLDivElement;
let root: Root;
const q = (id: string) => container.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const settle = () => act(async () => { for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0)); });

async function mountStory() {
  await act(async () => root.render(<StoryPlayerScreen locale="zh" saveId="sv1" from="home" />));
  await settle();
}
async function mountProgram() {
  await act(async () => root.render(<ProgramPlayerScreen locale="zh" programId="p1" />));
  await settle();
}
const end = async () => {
  await act(async () => audio().onended?.());
  await settle();
};

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  FakeAudio.all = [];
  vi.stubGlobal('Audio', FakeAudio);
  Element.prototype.scrollIntoView = vi.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  Object.values(m).forEach((f) => f.mockReset());
  region.label = true;
  m.save.mockResolvedValue({ success: true, status: 200, data: story() });
  m.turn.mockResolvedValue({ success: true, status: 200, data: story('n2') });
  m.program.mockResolvedValue({ success: true, status: 200, data: PROGRAM });
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('the story page', () => {
  it('where the region must label: the line under the header, while loading and while playing', async () => {
    m.save.mockReturnValueOnce(new Promise(() => undefined));
    await mountStory();
    expect(q('radio-aigc-label')?.textContent).toBe('radio.player.aigcLabel');
    act(() => root.unmount());
    root = createRoot(container);
    await mountStory();
    expect(q('radio-aigc-label')?.textContent).toBe('radio.player.aigcLabel');
  });

  it('the rhythm plays first, at 1.0×, then the first sentence; the captions start at that sentence', async () => {
    await mountStory();
    expect(audio().played[0]).toEqual([MORSE, 1]);
    expect(srcs()).not.toContain('https://a/n1-1.mp3');
    await end();
    expect(audio().src).toBe('https://a/n1-1.mp3');
    expect(srcs().filter((s) => s === MORSE)).toHaveLength(1);
  });

  it('once per visit: not before the next part', async () => {
    await mountStory();
    await end(); // the rhythm
    await end(); // sentence 1
    await end(); // sentence 2 → narration done → advance
    await settle();
    expect(m.turn).toHaveBeenCalled();
    expect(srcs()).toContain('https://a/n2-1.mp3');
    expect(srcs().filter((s) => s === MORSE)).toHaveLength(1);
  });

  it('the microphone waits for the rhythm: disabled, and a tap does nothing; ready once it has played', async () => {
    await mountStory();
    const btn = q('radio-mic-button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    await act(async () => btn.click());
    expect(audio().paused).toBe(false);
    expect(audio().src).toBe(MORSE);
    await end();
    expect((q('radio-mic-button') as HTMLButtonElement).disabled).toBe(false);
  });

  it('where the region need not label: no line and no rhythm', async () => {
    region.label = false;
    await mountStory();
    expect(q('radio-aigc-label')).toBeNull();
    expect(srcs()).not.toContain(MORSE);
    expect(audio().src).toBe('https://a/n1-1.mp3');
  });
});

describe('the programme page (the user, 2026-11-10: 「节目也播一次」)', () => {
  it('the line under the header; the rhythm once, first, at 1.0×', async () => {
    await mountProgram();
    expect(q('radio-aigc-label')?.textContent).toBe('radio.player.aigcLabel');
    expect(audio().played[0]).toEqual([MORSE, 1]);
    await end();
    expect(audio().src).toBe('https://a/p1.mp3');
    await end();
    expect(srcs().filter((s) => s === MORSE)).toHaveLength(1);
  });

  it('the microphone waits for the rhythm', async () => {
    await mountProgram();
    const btn = q('radio-mic-button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    await act(async () => btn.click());
    expect(audio().src).toBe(MORSE);
    expect(audio().paused).toBe(false);
    await end();
    expect((q('radio-mic-button') as HTMLButtonElement).disabled).toBe(false);
  });

  it('pausing during the rhythm and playing again resumes the rhythm, then the programme', async () => {
    await mountProgram();
    await act(async () => q('radio-play-pause')!.click()); // pause
    expect(audio().paused).toBe(true);
    await act(async () => q('radio-play-pause')!.click()); // play again
    await settle();
    expect(audio().played.at(-1)).toEqual([MORSE, 1]);
    expect(srcs().filter((s) => s === MORSE).length).toBe(2); // resumed, not a second session's rhythm
    await end();
    expect(audio().src).toBe('https://a/p1.mp3');
  });

  it('us-west: no line, no rhythm', async () => {
    region.label = false;
    await mountProgram();
    expect(q('radio-aigc-label')).toBeNull();
    expect(srcs()).not.toContain(MORSE);
  });
});
