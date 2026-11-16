/**
 * @vitest-environment jsdom
 *
 * KAZI-1366 — coming back to the English part after a reload (kazispace-ui live-room.md 0.11, The English
 * part: "Coming back to it"; Screens and back: the one exception). On iPhone a user stopped touching the phone
 * after the last answer; Safari unloaded the page while the screen was locked, and 20 minutes later the user
 * was back on the radio home with no English part and no end card. The user chose: play the English part from
 * the start, then the closing ("B，开始做").
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  chunk: vi.fn(),
  turn: vi.fn(),
  upgrade: vi.fn(),
  close: vi.fn(),
  end: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
  micOpen: vi.fn(),
  micDone: vi.fn(),
  events: vi.fn(),
}));
const tg = vi.hoisted(() => ({ on: false, back: { show: vi.fn(), hide: vi.fn(), onClick: vi.fn(), offClick: vi.fn() } }));

/** The fake microphone: the test plays the user's part. */
const mic = vi.hoisted(() => ({
  state: 'idle' as 'idle' | 'recording',
  secondsLeft: null as number | null,
  onPiece: null as null | ((seq: number, a: Blob, ms: number, mime: string) => void),
  onFinal: null as null | ((seq: number, a: Blob, ms: number, mime: string) => void),
}));

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${ns}.${key}:${JSON.stringify(vars)}` : `${ns}.${key}`,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: m.replace, push: m.push }) }));
vi.mock('@/lib/telegram', () => ({
  isTelegramWebApp: () => tg.on,
  getTelegramWebApp: () => (tg.on ? { BackButton: tg.back } : null),
}));
vi.mock('@/lib/radio/live-api', async (orig) => ({
  ...(await orig<typeof import('@/lib/radio/live-api')>()),
  postLiveChunk: m.chunk,
  getLiveTurn: m.turn,
  getLiveUpgrade: m.upgrade,
  postLiveClose: m.close,
  sendLiveEnd: m.end,
  postLiveEvents: m.events,
}));
vi.mock('@/hooks/use-live-mic', () => ({
  useLiveMic: (o: { onPiece: typeof mic.onPiece; onFinal: typeof mic.onFinal }) => {
    mic.onPiece = o.onPiece;
    mic.onFinal = o.onFinal;
    return { state: mic.state, level: 0, secondsLeft: mic.secondsLeft, open: m.micOpen, done: m.micDone };
  },
}));

import { LiveScreen, cardFromUpgrade } from '@/components/radio/live-screen';
import type { LiveSession } from '@/types/radio-live';
import {
  LIVE_ENGLISH_KEY,
  LIVE_ENGLISH_MAX_MS,
  LIVE_MIC_CONSENT_KEY,
  keepLiveEnglish,
  resetLiveSessionForTest,
  setStartedLiveSession,
  takeLiveEnglish,
} from '@/lib/radio/live-session';

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
/** Every line of the part playing now plays to its end. */
const finishPart = async () => {
  for (let i = 0; i < 30; i += 1) {
    const a = audio();
    if (!a || a.paused) return;
    const before = a.played.length;
    await act(async () => a.onended?.());
    await settle();
    if (a.played.length === before) return;
  }
};

const HOST = { key: 'warm' as const, name: 'Warm host', voice_id: 'zh_f1' };
const LIMITS = { record_max_ms: 72000, chunk_max_ms: 20000, chunks_max: 4 };
const SESSION = {
  session_id: 'ls1',
  host: 'warm',
  topic_id: 't1',
  status: 'open',
  opening: [{ clip_id: 'o1', seq: 1, text: '晚上好。今天吃了什么？', audio_url: 'https://a/o1.mp3', lang: 'zh' as const }],
  acks: [{ clip_id: 'k1', text: '嗯，我在听。', audio_url: 'https://a/ack.mp3' }],
  limits: LIMITS,
};
const ok = <T,>(data: T, status = 200) => ({ success: true, status, data });
const fail = (status: number, errorCode?: string) => ({ success: false, status, errorCode, error: errorCode ?? 'x' });
const seg = (seq: number, text: string, extra: Record<string, unknown> = {}) => ({ seq, text, audio_url: `https://a/r${seq}.mp3`, pending: false, ...extra });
const reply = (extra: Record<string, unknown> = {}) => ok({ turn_id: 'turn_x', kind: 'reply', segments: [seg(1, '听起来很好吃。'), seg(2, '后来呢？')], ...extra });
const notice = (kind: string, code: string, text = '主播的话') => ({ kind, code, text });

let container: HTMLDivElement;
let root: Root;
const q = (id: string) => container.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const qa = (id: string) => Array.from(container.querySelectorAll(`[data-testid="${id}"]`)) as HTMLElement[];
const settle = () => act(async () => { for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0)); });
const click = async (el: Element | null) => {
  expect(el).not.toBeNull();
  await act(async () => (el as HTMLElement).click());
  await settle();
};
const captions = () => qa('radio-live-caption').map((c) => c.textContent);
const phase = () => q('radio-live-screen')?.getAttribute('data-phase');

async function mount() {
  setStartedLiveSession({ session: SESSION, host: HOST });
  await act(async () => root.render(<LiveScreen locale="zh" />));
  await settle();
}

/** The user taps the microphone, talks (in `pieces` pieces), and the last piece goes. */
async function talk(pieces = 1) {
  await click(q('radio-live-mic'));
  for (let s = 1; s < pieces; s += 1) await act(async () => mic.onPiece?.(s, new Blob(['p']), 20000, 'audio/webm'));
  await act(async () => mic.onFinal?.(pieces, new Blob(['f']), 3000, 'audio/webm'));
  await settle();
}
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  FakeAudio.all = [];
  vi.stubGlobal('Audio', FakeAudio);
  vi.spyOn(Math, 'random').mockReturnValue(0);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  Object.values(m).forEach((f) => f.mockReset());
  mic.state = 'idle';
  tg.on = false;
  Object.values(tg.back).forEach((f) => f.mockReset());
  m.events.mockResolvedValue({ success: true, status: 200, data: { accepted: 1, duplicates: 0 } });
  mic.secondsLeft = null;
  m.micOpen.mockResolvedValue('ok');
  m.chunk.mockImplementation((a: { final: boolean }) => Promise.resolve(a.final ? reply() : ok({ received: 1 }, 202)));
  m.close.mockResolvedValue(ok({ session_id: 'ls1', end_reason: 'finished', closing: [{ seq: 1, clip_id: 'c1', text: 'Good night.', audio_url: 'https://a/c1.mp3', lang: 'en' }], card: { sentence: 'I had noodles with my sister.', key_word: 'noodles', key_word_zh: '面条' } }));
  resetLiveSessionForTest();
  // These tests are about the session: the microphone card was already answered on this device
  // (the card itself: "Microphone access" below).
  window.localStorage.setItem(LIVE_MIC_CONSENT_KEY, '1');
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const READY = ok({
  status: 'ready',
  handover: { text: 'Let me put that in English for you.', audio_url: 'https://a/h.mp3' },
  lines: [{ seq: 1, text: 'I had noodles with my sister.', audio_url: 'https://a/e1.mp3' }],
  key_word: 'noodles',
  key_word_zh: '面条',
});
const finalAnswer = () => ok({ turn_id: 'tf', kind: 'final', next: 'upgrade', segments: [seg(1, '真好。')] });
const kept = () => window.sessionStorage.getItem(LIVE_ENGLISH_KEY);

/** A reload of the same tab: nothing handed over in memory, only what the tab kept. */
async function reload() {
  await act(async () => root.render(<LiveScreen locale="zh" />));
  await settle();
}

describe('Keeping the English part in the tab', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('the last answer keeps the session; the closing forgets it', async () => {
    m.chunk.mockImplementation((a: { final: boolean }) => Promise.resolve(a.final ? finalAnswer() : ok({ received: 1 }, 202)));
    m.upgrade.mockResolvedValue(READY);
    await mount();
    await finishPart();
    expect(kept()).toBeNull(); // nothing kept before the last answer
    await talk();
    expect(JSON.parse(kept()!).started.session.session_id).toBe('ls1');
    for (let i = 0; i < 4; i += 1) await finishPart();
    expect(m.close).toHaveBeenCalledTimes(1);
    expect(kept()).toBeNull();
  });

  it('after the last answer, pagehide keeps it and does NOT end the session; leaving the screen does both', async () => {
    m.chunk.mockImplementation((a: { final: boolean }) => Promise.resolve(a.final ? finalAnswer() : ok({ received: 1 }, 202)));
    m.upgrade.mockImplementation(() => new Promise(() => undefined)); // never ready: the page is put away first
    await mount();
    await finishPart();
    await talk();
    await act(async () => window.dispatchEvent(new Event('pagehide')));
    // #301 R1: ending here would make the server drop an English part still being made and refuse the closing
    expect(m.end).not.toHaveBeenCalled();
    expect(kept()).not.toBeNull();
    await act(async () => root.unmount());
    root = createRoot(container);
    expect(m.end).toHaveBeenCalledTimes(1);
    expect(kept()).toBeNull();
  });

  it('before the last answer, pagehide still ends the session (leaving, as before)', async () => {
    await mount();
    await finishPart();
    await act(async () => window.dispatchEvent(new Event('pagehide')));
    expect(m.end).toHaveBeenCalledTimes(1);
    expect(kept()).toBeNull();
  });

  it('older than 60 minutes, or unreadable: forgotten', () => {
    keepLiveEnglish({ session: SESSION as unknown as LiveSession, host: HOST }, Date.now() - LIVE_ENGLISH_MAX_MS - 1);
    expect(takeLiveEnglish()).toBeNull();
    expect(kept()).toBeNull();
    window.sessionStorage.setItem(LIVE_ENGLISH_KEY, '{not json');
    expect(takeLiveEnglish()).toBeNull();
  });

  it('the AI marker never plays again on the way back', () => {
    keepLiveEnglish({ session: SESSION as unknown as LiveSession, host: HOST, aigcLabel: true });
    expect(takeLiveEnglish()?.aigcLabel).toBe(false);
  });
});

describe('Coming back to it after a reload', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    keepLiveEnglish({ session: SESSION as unknown as LiveSession, host: HOST });
  });

  it('opens on the English part with one button; nothing plays and nothing is asked until the tap', async () => {
    await reload();
    expect(m.replace).not.toHaveBeenCalled();
    expect(phase()).toBe('english');
    expect(q('radio-live-resume')?.textContent).toBe('radio.live.resumeEnglish');
    expect(q('radio-live-mic')).toBeNull();
    expect(FakeAudio.all.every((a) => a.played.length === 0)).toBe(true); // the opening is not played again
    expect(m.upgrade).not.toHaveBeenCalled();
  });

  it('the tap: the English part from the start, then the closing and the end card', async () => {
    m.upgrade.mockResolvedValue(READY);
    await reload();
    await click(q('radio-live-resume'));
    expect(q('radio-live-resume')).toBeNull();
    expect(m.upgrade).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 4; i += 1) await finishPart();
    const order = audio().played.map((p) => p[0]);
    expect(order.indexOf('https://a/h.mp3')).toBeGreaterThan(-1);
    expect(order.indexOf('https://a/h.mp3')).toBeLessThan(order.indexOf('https://a/e1.mp3'));
    expect(audio().played.filter((p) => p[0] === 'https://a/e1.mp3').map((p) => p[1])).toEqual([1, 0.75]);
    expect(m.close).toHaveBeenCalledTimes(1);
    expect(q('radio-live-card-sentence')?.textContent).toBe('I had noodles with my sister.');
    expect(kept()).toBeNull();
  });

  it('the real path (#301 R1): the session timed out while locked; English part ready before; close 409 ⇒ the card from the English part', async () => {
    m.upgrade.mockResolvedValue(READY);
    m.close.mockResolvedValue(fail(409, 'live_no_closing'));
    await reload();
    await click(q('radio-live-resume'));
    for (let i = 0; i < 4; i += 1) await finishPart();
    expect(audio().played.some((p) => p[0] === 'https://a/e1.mp3')).toBe(true);
    expect(m.close).toHaveBeenCalledTimes(1);
    // the server builds no card for a timed-out session; the app builds tonight's sentence from the English part
    expect(q('radio-live-card-sentence')?.textContent).toBe('I had noodles with my sister.');
    expect(q('radio-live-card-key-word')?.textContent).toBe('noodles面条');
    await click(q('radio-live-done'));
    expect(m.replace).toHaveBeenCalledWith('/zh/radio');
  });

  it('the English part was dropped (skipped, code ended): nothing plays, the closing answers 409, Done only', async () => {
    m.upgrade.mockResolvedValue(ok({ status: 'skipped', notice: null }));
    m.close.mockResolvedValue(fail(409, 'live_no_closing'));
    await reload();
    await click(q('radio-live-resume'));
    for (let i = 0; i < 4; i += 1) await finishPart();
    expect(audio().played.some((p) => p[0] === 'https://a/e1.mp3')).toBe(false);
    expect(m.close).toHaveBeenCalledTimes(1);
    expect(q('radio-live-card-sentence')).toBeNull();
    expect(q('radio-live-done')).not.toBeNull();
  });

  it('End on the way back is leaving: the session ends, nothing is kept', async () => {
    await reload();
    await click(q('radio-live-end'));
    expect(m.replace).toHaveBeenCalledWith('/zh/radio');
    await act(async () => root.unmount());
    root = createRoot(container);
    expect(m.end).toHaveBeenCalledTimes(1);
    expect(kept()).toBeNull();
  });

  it('nothing kept: a reload still goes back to the radio home', async () => {
    window.sessionStorage.clear();
    await reload();
    expect(m.replace).toHaveBeenCalledWith('/zh/radio');
    expect(q('radio-live-screen')).toBeNull();
  });
});

describe('cardFromUpgrade', () => {
  const up = (lines: string[], key_word: string | null) =>
    ({ status: 'ready', lines: lines.map((text, i) => ({ seq: i + 1, text })), key_word, key_word_zh: '中' }) as never;

  it('the line that holds the key word, as the server picks it', () => {
    expect(cardFromUpgrade(up(['I came home late.', 'I had Noodles.'], 'noodles'))).toEqual({
      sentence: 'I had Noodles.', key_word: 'noodles', key_word_zh: '中',
    });
  });

  it('no line holds it: the first line; nothing ready: null', () => {
    expect(cardFromUpgrade(up(['First.', 'Second.'], 'xyz'))?.sentence).toBe('First.');
    expect(cardFromUpgrade({ status: 'skipped' } as never)).toBeNull();
    expect(cardFromUpgrade(null)).toBeNull();
  });
});
