/**
 * @vitest-environment jsdom
 *
 * KAZI-1287 F1 — the Live screen skeleton (kazispace-ui live-room.md 0.3, Screens and back · The Live
 * screen: Layout · A session, step by step: Opening · Ending · Accessibility).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ end: vi.fn(), replace: vi.fn(), push: vi.fn() }));

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${ns}.${key}:${JSON.stringify(vars)}` : `${ns}.${key}`,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: m.replace, push: m.push }) }));
vi.mock('@/lib/radio/live-api', async (orig) => ({
  ...(await orig<typeof import('@/lib/radio/live-api')>()),
  sendLiveEnd: m.end,
}));

import { LiveScreen, captionLang } from '@/components/radio/live-screen';
import {
  LIVE_SILENCE_WAV,
  liveAudioElement,
  resetLiveSessionForTest,
  setStartedLiveSession,
  takeStartedLiveSession,
  unlockLiveAudio,
} from '@/lib/radio/live-session';

class FakeAudio {
  static all: FakeAudio[] = [];
  src = '';
  playbackRate = 1;
  paused = true;
  currentTime = 0;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  played: string[] = [];
  constructor() {
    FakeAudio.all.push(this);
  }
  play() {
    this.paused = false;
    this.played.push(this.src);
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

const HOST = { key: 'warm' as const, name: 'Warm host', voice_id: 'zh_f1' };
const LIMITS = { record_max_ms: 72000, chunk_max_ms: 20000, chunks_max: 4 };
const SESSION = {
  session_id: 'ls1',
  host: 'warm',
  topic_id: 't1',
  status: 'open',
  // Out of order on purpose: the opening plays in `seq` order.
  opening: [
    { clip_id: 'o2', seq: 2, text: 'What did you eat today?', audio_url: 'https://a/o2.mp3', lang: 'en' as const },
    { clip_id: 'o1', seq: 1, text: '晚上好，我是今晚的主播。', audio_url: 'https://a/o1.mp3', lang: 'zh' as const },
  ],
  acks: [],
  limits: LIMITS,
};

let container: HTMLDivElement;
let root: Root;
const q = (id: string) => container.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const qa = (id: string) => Array.from(container.querySelectorAll(`[data-testid="${id}"]`)) as HTMLElement[];
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

async function mount() {
  await act(async () => root.render(<LiveScreen locale="zh" />));
  await settle();
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  FakeAudio.all = [];
  vi.stubGlobal('Audio', FakeAudio);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  Object.values(m).forEach((f) => f.mockReset());
  resetLiveSessionForTest();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('Screens and back', () => {
  it('opened with no session (a reload, a link): back to the radio home, nothing drawn, nothing sent', async () => {
    await mount();
    expect(m.replace).toHaveBeenCalledWith('/zh/radio');
    expect(q('radio-live-screen')).toBeNull();
    expect(m.end).not.toHaveBeenCalled();
  });

  it('the session is handed over once: a second screen does not get it again', () => {
    setStartedLiveSession({ session: SESSION, host: HOST });
    expect(takeStartedLiveSession()?.session.session_id).toBe('ls1');
    expect(takeStartedLiveSession()).toBeNull();
  });
});

describe('Layout', () => {
  it('header: End in place of back, the host name as sent, the AI label as text; announced once', async () => {
    setStartedLiveSession({ session: SESSION, host: HOST });
    await mount();
    expect(q('radio-live-end')?.textContent).toBe('radio.live.end');
    expect(q('radio-live-host-name')?.textContent).toBe('Warm host');
    expect(q('radio-live-ai-label')?.textContent).toBe('radio.live.aiLabel');
    expect(q('radio-live-announce')?.textContent).toBe('Warm host, radio.live.aiLabel');
    // No text box, no keyboard input.
    expect(container.querySelector('input, textarea')).toBeNull();
  });
});

describe('Opening', () => {
  it('plays in seq order through the element the Start tap unlocked; captions keep each line in its language', async () => {
    unlockLiveAudio();
    const unlocked = liveAudioElement() as unknown as FakeAudio;
    expect(unlocked.played).toEqual([LIVE_SILENCE_WAV]);
    setStartedLiveSession({ session: SESSION, host: HOST });
    await mount();
    expect(FakeAudio.all).toHaveLength(1);
    expect(unlocked.src).toBe('https://a/o1.mp3');
    let caps = qa('radio-live-caption');
    expect(caps.map((c) => c.textContent)).toEqual(['晚上好，我是今晚的主播。']);
    expect(caps[0].getAttribute('lang')).toBe('zh');
    expect(caps[0].getAttribute('aria-current')).toBe('true');

    await act(async () => unlocked.onended?.());
    caps = qa('radio-live-caption');
    expect(unlocked.src).toBe('https://a/o2.mp3');
    // Earlier lines stay so the user can read back; the line being spoken is highlighted.
    expect(caps.map((c) => c.textContent)).toEqual(['晚上好，我是今晚的主播。', 'What did you eat today?']);
    expect(caps.map((c) => c.getAttribute('aria-current'))).toEqual([null, 'true']);
    expect(caps[1].getAttribute('lang')).toBe('en');
  });

  it('Replay plays the current line again', async () => {
    unlockLiveAudio();
    const a = liveAudioElement() as unknown as FakeAudio;
    setStartedLiveSession({ session: SESSION, host: HOST });
    await mount();
    await act(async () => a.onended?.());
    a.played = [];
    await act(async () => q('radio-live-replay')!.click());
    expect(a.played).toEqual(['https://a/o2.mp3']);
  });

  it('captionLang: zh and en are marked; a mix is left to the page', () => {
    expect(captionLang('zh')).toBe('zh');
    expect(captionLang('en')).toBe('en');
    expect(captionLang('mix')).toBeUndefined();
  });
});

describe('Ending', () => {
  it('End stops the voice at once, goes back to the radio home, and sends end once', async () => {
    unlockLiveAudio();
    const a = liveAudioElement() as unknown as FakeAudio;
    setStartedLiveSession({ session: SESSION, host: HOST });
    await mount();
    expect(a.paused).toBe(false);
    await act(async () => q('radio-live-end')!.click());
    expect(a.paused).toBe(true);
    expect(m.replace).toHaveBeenCalledWith('/zh/radio');
    // The route change unmounts the screen; that is where end is sent.
    act(() => root.unmount());
    expect(m.end).toHaveBeenCalledTimes(1);
    expect(m.end).toHaveBeenCalledWith('ls1');
    root = createRoot(container);
  });

  it('closing the tab (pagehide) sends end; leaving afterwards does not send it again', async () => {
    setStartedLiveSession({ session: SESSION, host: HOST });
    await mount();
    await act(async () => window.dispatchEvent(new Event('pagehide')));
    expect(m.end).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    expect(m.end).toHaveBeenCalledTimes(1);
    root = createRoot(container);
  });

  it('any other way out (back, another destination) unmounts the screen and ends the session', async () => {
    setStartedLiveSession({ session: SESSION, host: HOST });
    await mount();
    act(() => root.unmount());
    expect(m.end).toHaveBeenCalledWith('ls1');
    root = createRoot(container);
  });
});
