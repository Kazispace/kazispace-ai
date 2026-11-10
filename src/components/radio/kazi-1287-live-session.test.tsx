/**
 * @vitest-environment jsdom
 *
 * KAZI-1287 F2 — a Live Room session on the Live screen (kazispace-ui live-room.md 0.3, A session, step
 * by step · Recording · Sending a recording · Answers · The English part · Closing and the end card ·
 * Care). The microphone is a fake (its own rules are in kazi-1287-live-mic); the API is mocked.
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

import { LiveScreen } from '@/components/radio/live-screen';
import { LIVE_MIC_CONSENT_KEY, resetLiveSessionForTest, setStartedLiveSession } from '@/lib/radio/live-session';

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

describe('A session, step by step', () => {
  it('the microphone is ready as soon as the opening starts; a tap stops the host at once and records', async () => {
    await mount();
    expect(q('radio-live-mic')?.getAttribute('data-state')).toBe('ready');
    expect(audio().paused).toBe(false);
    await click(q('radio-live-mic'));
    expect(audio().paused).toBe(true);
    expect(m.micOpen).toHaveBeenCalledTimes(1);
    expect(phase()).toBe('recording');
    // The opening line the host reached stays in the captions.
    expect(captions()).toEqual(['晚上好。今天吃了什么？']);
  });

  it('pieces go while the user talks, all under one turn_id; Done sends the last with meta final', async () => {
    await mount();
    await finishPart();
    await talk(3);
    const calls = m.chunk.mock.calls.map((c) => c[0]);
    expect(calls.map((c) => [c.seq, c.final])).toEqual([
      [1, false],
      [2, false],
      [3, true],
    ]);
    expect(new Set(calls.map((c) => c.turnId)).size).toBe(1);
    expect(calls[0].turnId).toMatch(/^[A-Za-z0-9_-]{8,40}$/);
    expect(calls[0].sessionId).toBe('ls1');
  });

  it('right after Done one of the acks plays, then the answer, then the microphone is ready again', async () => {
    await mount();
    await finishPart();
    let answer: (v: unknown) => void = () => undefined;
    m.chunk.mockImplementation(() => new Promise((r) => (answer = r)));
    await talk();
    expect(phase()).toBe('waiting');
    expect(q('radio-live-mic')?.getAttribute('data-state')).toBe('working');
    expect(audio().src).toBe('https://a/ack.mp3');
    await act(async () => answer(reply()));
    await settle();
    // The answer waits for the ack to finish.
    expect(audio().src).toBe('https://a/ack.mp3');
    await finishPart();
    expect(audio().played.map((p) => p[0])).toContain('https://a/r1.mp3');
    expect(captions()).toEqual(['晚上好。今天吃了什么？', '听起来很好吃。', '后来呢？']);
    expect(q('radio-live-mic')?.getAttribute('data-state')).toBe('ready');
    // The ack is not a caption, and the user's own words are never shown.
    expect(container.textContent).not.toContain('嗯，我在听。');
  });

  it('a line still pending: the turn is asked for once, when the answer starts, and its audio is used', async () => {
    m.chunk.mockImplementation((a: { final: boolean }) =>
      Promise.resolve(a.final ? ok({ turn_id: 'turn_x', kind: 'reply', segments: [seg(1, 'A'), { seq: 2, text: 'B', audio_url: null, pending: true }] }) : ok({ received: 1 }, 202))
    );
    m.turn.mockResolvedValue(ok({ turn_id: 'turn_x', kind: 'reply', segments: [seg(1, 'A'), seg(2, 'B', { audio_url: 'https://a/late.mp3' })] }));
    await mount();
    await finishPart();
    await talk();
    await finishPart();
    expect(m.turn).toHaveBeenCalledTimes(1);
    expect(m.turn).toHaveBeenCalledWith('ls1', 'turn_x');
    expect(audio().played.map((p) => p[0])).toContain('https://a/late.mp3');
  });
});

describe('Answers', () => {
  it('retry: notice.text above the microphone for 3 s, spoken by nobody; the next recording has a new turn_id', async () => {
    m.chunk.mockImplementationOnce(() => Promise.resolve(ok({ turn_id: 't1', kind: 'retry', notice: notice('retry', 'voice_unrecognized', '没听清，再说一次？'), segments: [] })));
    await mount();
    await finishPart();
    await talk();
    await finishPart(); // the ack
    expect(q('radio-live-line')?.textContent).toBe('没听清，再说一次？');
    expect(captions()).not.toContain('没听清，再说一次？');
    expect(q('radio-live-mic')?.getAttribute('data-state')).toBe('ready');
    const first = m.chunk.mock.calls[0][0].turnId;
    await talk();
    expect(m.chunk.mock.calls[1][0].turnId).not.toBe(first);
  });

  it.each(['asr_failed', 'retry_limit'])('ended %s: notice.text as a host caption, then the closing', async (code) => {
    m.chunk.mockResolvedValue(ok({ turn_id: 't', kind: 'ended', notice: notice('ended', code, '今天先到这里。'), segments: [] }));
    await mount();
    await finishPart();
    await talk();
    await finishPart();
    expect(captions()).toContain('今天先到这里。');
    expect(m.close).toHaveBeenCalledTimes(1);
  });

  it('ended with notice.kind quota: the closing follows, its end card null', async () => {
    m.chunk.mockResolvedValue(ok({ turn_id: 't', kind: 'ended', notice: notice('quota', 'live_daily_limit', '今天的次数用完了。'), segments: [] }));
    m.close.mockResolvedValue(ok({ session_id: 'ls1', end_reason: 'quota', closing: [{ seq: 1, clip_id: 'c', text: 'Bye.', audio_url: 'https://a/c.mp3', lang: 'en' }], card: null }));
    await mount();
    await finishPart();
    await talk();
    await finishPart();
    await finishPart();
    expect(m.close).toHaveBeenCalledTimes(1);
    expect(q('radio-live-card-sentence')).toBeNull();
    expect(q('radio-live-done')).not.toBeNull();
  });

  it('ended live_session_ended: no closing; Done goes back to the radio home', async () => {
    m.chunk.mockResolvedValue(ok({ turn_id: 't', kind: 'ended', notice: notice('ended', 'live_session_ended', '这一期结束了。'), segments: [] }));
    await mount();
    await finishPart();
    await talk();
    await finishPart();
    expect(captions()).toContain('这一期结束了。');
    expect(m.close).not.toHaveBeenCalled();
    await click(q('radio-live-done'));
    expect(m.replace).toHaveBeenCalledWith('/zh/radio');
  });

  it('limit: notice.text as a host caption, then the closing', async () => {
    m.chunk.mockResolvedValue(ok({ turn_id: 't', kind: 'limit', notice: notice('limit', 'live_time_limit', '时间到了。'), segments: [] }));
    await mount();
    await finishPart();
    await talk();
    await finishPart();
    expect(captions()).toContain('时间到了。');
    expect(m.close).toHaveBeenCalledTimes(1);
  });

  it.each(['live_session_ended', 'live_session_not_found'])('409 %s: sessionEnded as a host caption, and Done', async (code) => {
    m.chunk.mockResolvedValue(fail(409, code));
    await mount();
    await finishPart();
    await talk();
    await finishPart();
    expect(captions()).toContain('radio.live.sessionEnded');
    expect(q('radio-live-done')).not.toBeNull();
  });

  it.each([
    [409, 'live_wrong_state'],
    [422, 'invalid_request'],
  ])('%s %s (a bug): nothing more is fetched; the session ends', async (status, code) => {
    m.chunk.mockResolvedValue(fail(status, code));
    await mount();
    await finishPart();
    await talk();
    await finishPart();
    expect(m.replace).toHaveBeenCalledWith('/zh/radio');
    expect(m.close).not.toHaveBeenCalled();
    expect(m.turn).not.toHaveBeenCalled();
  });

  it('503 live_unavailable: a card with gotIt, and back to the radio home', async () => {
    m.chunk.mockResolvedValue(fail(503, 'live_unavailable'));
    await mount();
    await finishPart();
    await talk();
    await finishPart();
    const cardEl = q('radio-live-unavailable')!;
    expect(cardEl.textContent).toContain('radio.live.unavailable');
    expect(document.activeElement).toBe(cardEl);
    await click(cardEl.querySelector('button'));
    expect(m.replace).toHaveBeenCalledWith('/zh/radio');
  });

  it("403 radio_pro_required: the radio's rules (Studio)", async () => {
    m.chunk.mockResolvedValue(fail(403, 'radio_pro_required'));
    await mount();
    await finishPart();
    await talk();
    await finishPart();
    expect(m.replace).toHaveBeenCalledWith(expect.not.stringContaining('/radio'));
  });
});

describe('Care', () => {
  it('crisis: the voice stops, the microphone is off, a card that stays with one button; no closing', async () => {
    m.chunk.mockResolvedValue(ok({ turn_id: 't', kind: 'crisis', notice: notice('paused', 'self_harm', '你不是一个人。可以拨打 12356。'), segments: [] }));
    await mount();
    await finishPart();
    await talk();
    await finishPart();
    const careEl = q('radio-live-care')!;
    expect(careEl.textContent).toContain('你不是一个人。可以拨打 12356。');
    expect(document.activeElement).toBe(careEl);
    expect(careEl.querySelectorAll('button')).toHaveLength(1);
    expect(q('radio-live-mic')?.getAttribute('data-state')).toBe('off');
    expect(audio().paused).toBe(true);
    expect(m.close).not.toHaveBeenCalled();
    await click(q('radio-live-care-close'));
    expect(m.replace).toHaveBeenCalledWith('/zh/radio');
  });
});

describe('The English part, the closing and the end card', () => {
  const READY = ok({
    status: 'ready',
    handover: { text: "Let me put that in English for you.", audio_url: 'https://a/h.mp3' },
    lines: [{ seq: 1, text: 'I had noodles with my sister.', audio_url: 'https://a/e1.mp3' }],
    key_word: 'noodles',
    key_word_zh: '面条',
  });
  const finalAnswer = () => ok({ turn_id: 'tf', kind: 'final', next: 'upgrade', segments: [seg(1, '真好。')] });

  it('final: the English part is asked for at once; handover, the lines, the lines again at 0.75×, the closing, the end card', async () => {
    m.chunk.mockImplementation((a: { final: boolean }) => Promise.resolve(a.final ? finalAnswer() : ok({ received: 1 }, 202)));
    m.upgrade.mockResolvedValue(READY);
    await mount();
    await finishPart();
    await talk();
    expect(m.upgrade).toHaveBeenCalledTimes(1); // asked as soon as the last answer arrived
    expect(q('radio-live-mic')?.getAttribute('data-state')).not.toBe('ready');
    await finishPart(); // ack, then the final answer, the handover, the lines (1× and 0.75×), the closing
    await finishPart();
    await finishPart();
    await finishPart();
    const played = audio().played;
    const e1 = played.filter((p) => p[0] === 'https://a/e1.mp3').map((p) => p[1]);
    expect(e1).toEqual([1, 0.75]);
    const order = played.map((p) => p[0]);
    expect(order.indexOf('https://a/h.mp3')).toBeLessThan(order.indexOf('https://a/e1.mp3'));
    expect(order.indexOf('https://a/c1.mp3')).toBeGreaterThan(order.lastIndexOf('https://a/e1.mp3'));
    expect(m.close).toHaveBeenCalledTimes(1);
    const cardEl = q('radio-live-card')!;
    expect(cardEl.textContent).toContain('radio.live.card.title');
    expect(q('radio-live-card-sentence')?.textContent).toBe('I had noodles with my sister.');
    expect(q('radio-live-card-key-word')?.textContent).toBe('noodles面条');
    expect(cardEl.textContent).toContain('radio.live.card.note');
    await click(q('radio-live-done'));
    expect(m.replace).toHaveBeenCalledWith('/zh/radio');
  });

  it('Your sentence: the key word underlined and bold, a bubble with its Chinese; Slower plays the lines again at 0.75×', async () => {
    m.chunk.mockImplementation((a: { final: boolean }) => Promise.resolve(a.final ? finalAnswer() : ok({ received: 1 }, 202)));
    m.upgrade.mockResolvedValue(READY);
    await mount();
    await finishPart();
    await talk();
    await act(async () => audio().onended?.()); // ack
    await settle();
    await act(async () => audio().onended?.()); // final answer
    await settle();
    await act(async () => audio().onended?.()); // handover
    await settle();
    expect(q('radio-live-your-sentence')?.textContent).toContain('radio.live.yourSentence');
    const key = q('radio-live-key-word')!;
    expect(key.textContent).toBe('noodles');
    expect(key.className).toContain('font-bold');
    expect(key.className).toContain('underline');
    await click(key);
    expect(q('radio-live-key-word-zh')?.textContent).toBe('面条');
    audio().played = [];
    await click(q('radio-live-slower'));
    expect(audio().played).toEqual([['https://a/e1.mp3', 0.75]]);
  });

  it('pending: "…" while waiting, never a blank screen; it plays when ready', async () => {
    m.chunk.mockImplementation((a: { final: boolean }) => Promise.resolve(a.final ? finalAnswer() : ok({ received: 1 }, 202)));
    let ready: (v: unknown) => void = () => undefined;
    m.upgrade.mockResolvedValueOnce(ok({ status: 'pending', retry_after_ms: 1 })).mockImplementationOnce(() => new Promise((r) => (ready = r)));
    await mount();
    await finishPart();
    await talk();
    await finishPart();
    await finishPart();
    expect(q('radio-live-english-waiting')?.textContent).toBe('…');
    await act(async () => ready(READY));
    await settle();
    expect(q('radio-live-english-waiting')).toBeNull();
    expect(audio().src).toBe('https://a/h.mp3');
  });

  it('skipped with no notice: straight to the closing; nothing says a part was skipped', async () => {
    m.chunk.mockImplementation((a: { final: boolean }) => Promise.resolve(a.final ? finalAnswer() : ok({ received: 1 }, 202)));
    m.upgrade.mockResolvedValue(ok({ status: 'skipped' }));
    await mount();
    await finishPart();
    await talk();
    await finishPart();
    await finishPart();
    expect(m.close).toHaveBeenCalledTimes(1);
    expect(q('radio-live-your-sentence')).toBeNull();
  });

  it('skipped with a notice: the care card, whatever the notice kind; no closing', async () => {
    m.chunk.mockImplementation((a: { final: boolean }) => Promise.resolve(a.final ? finalAnswer() : ok({ received: 1 }, 202)));
    m.upgrade.mockResolvedValue(ok({ status: 'skipped', notice: notice('ended', 'self_harm', '请照顾好自己。') }));
    await mount();
    await finishPart();
    await talk();
    await finishPart();
    await finishPart();
    expect(q('radio-live-care')?.textContent).toContain('请照顾好自己。');
    expect(m.close).not.toHaveBeenCalled();
  });

  it('close answers 409 live_no_closing: the end card with Done only', async () => {
    m.chunk.mockResolvedValue(ok({ turn_id: 't', kind: 'limit', notice: notice('limit', 'live_time_limit', '时间到了。'), segments: [] }));
    m.close.mockResolvedValue(fail(409, 'live_no_closing'));
    await mount();
    await finishPart();
    await talk();
    await finishPart();
    expect(q('radio-live-card')).not.toBeNull();
    expect(q('radio-live-card-sentence')).toBeNull();
    expect(q('radio-live-done')).not.toBeNull();
  });
});

describe('Recording, the edges', () => {
  it('time left under the button in the last 10 seconds', async () => {
    await mount();
    await click(q('radio-live-mic'));
    mic.secondsLeft = 7;
    await act(async () => root.render(<LiveScreen locale="zh" />));
    expect(q('radio-live-remaining')?.textContent).toBe('radio.live.mic.remaining:{"s":7}');
  });

  it('going to the background while recording sends the recording, as if Done', async () => {
    await mount();
    await click(q('radio-live-mic'));
    mic.state = 'recording';
    await act(async () => root.render(<LiveScreen locale="zh" />));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    expect(m.micDone).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  });

  it('going to the background at any other time pauses the voice; coming back resumes it', async () => {
    await mount();
    expect(audio().paused).toBe(false);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    expect(audio().paused).toBe(true);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    expect(audio().paused).toBe(false);
  });

  it('a blocked microphone: Unavailable; a tap opens the help; the user can still end the session', async () => {
    m.micOpen.mockResolvedValue('blocked');
    await mount();
    await click(q('radio-live-mic'));
    expect(q('radio-live-mic')?.getAttribute('data-state')).toBe('unavailable');
    await click(q('radio-live-mic'));
    expect(container.textContent).toContain('radio.mic.blockedHelp');
    await click(q('radio-live-end'));
    expect(m.replace).toHaveBeenCalledWith('/zh/radio');
  });

  it('no microphone: Unavailable, and no "tap instead"', async () => {
    m.micOpen.mockResolvedValue('no_device');
    await mount();
    await click(q('radio-live-mic'));
    const btn = q('radio-live-mic') as HTMLButtonElement;
    expect(btn.getAttribute('data-state')).toBe('unavailable');
    expect(btn.disabled).toBe(true);
    expect(container.textContent).not.toContain('denied');
  });

  it('leaving while the answer is in flight sends nothing more for the turn, and ends the session', async () => {
    await mount();
    await finishPart();
    let answer: (v: unknown) => void = () => undefined;
    m.chunk.mockImplementation(() => new Promise((r) => (answer = r)));
    await talk();
    await click(q('radio-live-end'));
    act(() => root.unmount());
    expect(m.end).toHaveBeenCalledWith('ls1');
    await act(async () => answer(reply()));
    expect(m.turn).not.toHaveBeenCalled();
    expect(m.close).not.toHaveBeenCalled();
    root = createRoot(container);
  });
});

describe('Playback events', () => {
  const sent = () => m.events.mock.calls.flatMap((c) => c[1]).map((e: Record<string, unknown>) => ({ kind: e.kind, part: e.part, seq: e.seq }));

  it('Replay during an answer is live_replay with part reply and the line seq; sent when the session ends', async () => {
    await mount();
    await finishPart();
    await talk();
    await act(async () => audio().onended?.()); // the ack
    await settle();
    await act(async () => audio().onended?.()); // line 1 of the answer
    await settle();
    await click(q('radio-live-replay'));
    expect(m.events).not.toHaveBeenCalled(); // batched
    await click(q('radio-live-end'));
    act(() => root.unmount());
    expect(sent()).toEqual([{ kind: 'live_replay', part: 'reply', seq: 2 }]);
    expect(m.events.mock.calls[0][0]).toBe('ls1');
    root = createRoot(container);
  });

  it('Replay during the opening is not reported (it is not reply, upgrade or closing)', async () => {
    await mount();
    await click(q('radio-live-replay'));
    act(() => root.unmount());
    expect(m.events).not.toHaveBeenCalled();
    root = createRoot(container);
  });

  it('Slower is live_slow and a tap on the key word live_key_word_tap, both part upgrade with no seq; sent when the app goes to the background', async () => {
    m.chunk.mockImplementation((a: { final: boolean }) =>
      Promise.resolve(a.final ? ok({ turn_id: 'tf', kind: 'final', next: 'upgrade', segments: [seg(1, '真好。')] }) : ok({ received: 1 }, 202))
    );
    m.upgrade.mockResolvedValue(
      ok({ status: 'ready', handover: { text: 'In English:', audio_url: 'https://a/h.mp3' }, lines: [{ seq: 1, text: 'I had noodles.', audio_url: 'https://a/e1.mp3' }], key_word: 'noodles', key_word_zh: '面条' })
    );
    await mount();
    await finishPart();
    await talk();
    for (let i = 0; i < 3; i += 1) {
      await act(async () => audio().onended?.());
      await settle();
    }
    await click(q('radio-live-key-word'));
    await click(q('radio-live-slower'));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    expect(sent()).toEqual([
      { kind: 'live_key_word_tap', part: 'upgrade', seq: undefined },
      { kind: 'live_slow', part: 'upgrade', seq: undefined },
    ]);
  });
});

describe('Platform notes', () => {
  it("Telegram's back button is End", async () => {
    tg.on = true;
    await mount();
    expect(tg.back.show).toHaveBeenCalled();
    const onBack = tg.back.onClick.mock.calls[0][0] as () => void;
    await act(async () => onBack());
    expect(m.replace).toHaveBeenCalledWith('/zh/radio');
    act(() => root.unmount());
    expect(tg.back.offClick).toHaveBeenCalledWith(onBack);
    expect(tg.back.hide).toHaveBeenCalled();
    root = createRoot(container);
  });

  it("the lock screen: the host's name, pause and stop only; stop ends the session", async () => {
    const handlers: Record<string, (() => void) | null> = {};
    const session = { metadata: null as unknown, setActionHandler: (a: string, fn: (() => void) | null) => (handlers[a] = fn) };
    Object.defineProperty(navigator, 'mediaSession', { configurable: true, value: session });
    vi.stubGlobal('MediaMetadata', class { title: string; artist: string; constructor(o: { title: string; artist: string }) { this.title = o.title; this.artist = o.artist; } });
    await mount();
    expect((session.metadata as { title: string }).title).toBe('Warm host');
    expect(handlers.nexttrack).toBeNull();
    expect(handlers.seekforward).toBeNull();
    await act(async () => handlers.pause?.());
    expect(audio().paused).toBe(true);
    await act(async () => handlers.stop?.());
    expect(m.replace).toHaveBeenCalledWith('/zh/radio');
    act(() => root.unmount());
    expect(session.metadata).toBeNull();
    expect(handlers.stop).toBeNull();
    root = createRoot(container);
    Object.defineProperty(navigator, 'mediaSession', { configurable: true, value: undefined });
  });
});

describe('Microphone access (live-room.md 0.4)', () => {
  beforeEach(() => window.localStorage.removeItem(LIVE_MIC_CONSENT_KEY));
  afterEach(() => {
    Object.defineProperty(navigator, 'permissions', { configurable: true, value: undefined });
  });

  it('the first tap shows Live Room\'s own card before the system prompt; two buttons of equal weight; focus moves to it', async () => {
    await mount();
    await click(q('radio-live-mic'));
    const cardEl = q('radio-live-consent')!;
    expect(m.micOpen).not.toHaveBeenCalled();
    for (const k of ['title', 'body', 'allow', 'later']) expect(cardEl.textContent).toContain(`radio.live.consent.${k}`);
    // Not the radio's story-choice card.
    expect(container.textContent).not.toContain('radio.consent.');
    const [allow, later] = [q('radio-live-consent-allow')!, q('radio-live-consent-later')!];
    expect(allow.className).toBe(later.className);
    expect(document.activeElement).toBe(cardEl);
    // The card replaces the controls; the captions stay.
    expect(q('radio-live-mic')).toBeNull();
    expect(captions()).toEqual(['晚上好。今天吃了什么？']);
  });

  it('Turn on microphone: only now is the system asked; recording starts; the card does not come back on this device', async () => {
    await mount();
    await click(q('radio-live-mic'));
    await click(q('radio-live-consent-allow'));
    expect(m.micOpen).toHaveBeenCalledTimes(1);
    expect(phase()).toBe('recording');
    expect(window.localStorage.getItem(LIVE_MIC_CONSENT_KEY)).toBe('1');
    await act(async () => mic.onFinal?.(1, new Blob(['f']), 3000, 'audio/webm'));
    await settle();
    await finishPart();
    await finishPart();
    await click(q('radio-live-mic'));
    expect(q('radio-live-consent')).toBeNull();
    expect(m.micOpen).toHaveBeenCalledTimes(2);
  });

  it('Not now: nothing is asked, the session waits, focus returns to the microphone; the next tap shows the card again', async () => {
    await mount();
    await click(q('radio-live-mic'));
    await click(q('radio-live-consent-later'));
    expect(m.micOpen).not.toHaveBeenCalled();
    expect(q('radio-live-consent')).toBeNull();
    expect(phase()).toBe('talk');
    expect(document.activeElement).toBe(q('radio-live-mic'));
    expect(window.localStorage.getItem(LIVE_MIC_CONSENT_KEY)).toBeNull();
    await click(q('radio-live-mic'));
    expect(q('radio-live-consent')).not.toBeNull();
  });

  it('decided by the user\'s choice, not the browser: an earlier Turn on skips the card even if the browser would prompt again', async () => {
    window.localStorage.setItem(LIVE_MIC_CONSENT_KEY, '1');
    Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: () => Promise.resolve({ state: 'prompt' }) } });
    await mount();
    await click(q('radio-live-mic'));
    expect(q('radio-live-consent')).toBeNull();
    expect(m.micOpen).toHaveBeenCalledTimes(1);
  });

  it('already blocked by the system: no card; the tap opens the blocked-microphone help', async () => {
    Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: () => Promise.resolve({ state: 'denied' }) } });
    m.micOpen.mockResolvedValue('blocked');
    await mount();
    await click(q('radio-live-mic'));
    expect(q('radio-live-consent')).toBeNull();
    expect(container.textContent).toContain('radio.mic.blockedHelp');
  });
});

describe('The audible AI marker (KAZI-1242; content compliance §6.3, D20 = E1)', () => {
  const MORSE = '/audio/aigc-ai-morse.wav';
  async function mountLabelled(session = SESSION) {
    setStartedLiveSession({ session, host: HOST, aigcLabel: true });
    await act(async () => root.render(<LiveScreen locale="zh" />));
    await settle();
  }

  it('where the region must label: the rhythm plays first, at 1.0×, then the opening; it is never a caption', async () => {
    await mountLabelled();
    expect(audio().played[0]).toEqual([MORSE, 1]);
    expect(captions()).toEqual([]);
    await act(async () => audio().onended?.());
    await settle();
    expect(audio().src).toBe('https://a/o1.mp3');
    expect(captions()).toEqual(['晚上好。今天吃了什么？']);
  });

  it('once per session: not before the answers, the English part or the closing', async () => {
    await mountLabelled();
    await finishPart();
    await talk();
    await finishPart();
    await finishPart();
    expect(audio().played.filter((p) => p[0] === MORSE)).toHaveLength(1);
  });

  it('not where the region need not label', async () => {
    await mount();
    expect(audio().played.map((p) => p[0])).not.toContain(MORSE);
  });

  it('an opening with no audio gets no rhythm; it plays before the first host line that has audio', async () => {
    await mountLabelled({ ...SESSION, opening: [{ ...SESSION.opening[0], audio_url: null }] });
    expect(FakeAudio.all.length === 0 || !audio().played.some((p) => p[0] === MORSE)).toBe(true);
    // the opening is a reading pause; the user answers
    await click(q('radio-live-mic'));
    await act(async () => mic.onFinal?.(1, new Blob(['f']), 3000, 'audio/webm'));
    await settle();
    expect(audio().played[0]).toEqual([MORSE, 1]); // before the ack, the first line with audio
    expect(audio().played.filter((p) => p[0] === MORSE)).toHaveLength(1);
  });

  it('Replay during the rhythm is not reported as a line', async () => {
    await mountLabelled();
    await click(q('radio-live-replay'));
    act(() => root.unmount());
    expect(m.events).not.toHaveBeenCalled();
    root = createRoot(container);
  });
});
