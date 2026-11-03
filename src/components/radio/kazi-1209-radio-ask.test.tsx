/**
 * @vitest-environment jsdom
 *
 * KAZI-1209 part 3 — asking questions (kazispace-ui personal-radio.md, Player · Asking a question ·
 * Programs · Data · A program). A long press on a sentence asks the host to explain it, in a story
 * (`POST saves/{id}/turn`, kind `text`) and in a program (`POST programs/{id}/ask`); a program also
 * takes a spoken question (`POST programs/{id}/ask/audio`).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RadioPlayerResponse, RadioProgramDetail } from '@/types/radio';

type MicOpts = { onRecorded: (a: Blob, d: number, m: string) => void; onSilence: () => void };
const m = vi.hoisted(() => ({
  save: vi.fn(),
  turn: vi.fn(),
  program: vi.fn(),
  ask: vi.fn(),
  askAudio: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
  toast: vi.fn(),
  home: null as null | Record<string, unknown>,
  mic: {
    opts: null as null | MicOpts,
    setState: null as null | ((s: string) => void),
    result: 'ok' as 'ok' | 'blocked' | 'no_device',
    opens: 0,
  },
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
  useRadioHome: () => ({ access: 'open', home: m.home, isLoading: false }),
}));
vi.mock('@/hooks/use-radio-mic', async () => {
  const React = await import('react');
  return {
    useRadioMic: (opts: MicOpts) => {
      const [state, setState] = React.useState('idle');
      m.mic.opts = opts;
      m.mic.setState = setState;
      return {
        state,
        level: 0,
        open: async () => {
          m.mic.opens += 1;
          if (m.mic.result === 'ok') setState('recording');
          return m.mic.result;
        },
        record: () => undefined,
        done: () => undefined,
        cancel: () => setState('idle'),
      };
    },
  };
});
vi.mock('@/lib/radio/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/radio/api')>()),
  getRadioSave: m.save,
  postRadioTurn: m.turn,
  getRadioProgram: m.program,
  getRadioRender: vi.fn(),
}));

vi.mock('@/lib/radio/player-api', () => ({ askRadioProgram: m.ask, askRadioProgramAudio: m.askAudio, postRadioTurnAudio: vi.fn() }));

import { ProgramPlayerScreen } from '@/components/radio/program-player';
import { StoryPlayerScreen } from '@/components/radio/story-player';

class FakeAudio {
  static all: FakeAudio[] = [];
  src = '';
  playbackRate = 1;
  paused = true;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    FakeAudio.all.push(this);
  }
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

const profile = { band: 'B1', en_ratio: 0.4, voice_id: 'en_gb_f1', source: 'override' } as const;
const story = (over: Partial<RadioPlayerResponse> = {}): RadioPlayerResponse => ({
  save_id: 'sv1',
  save_version: 3,
  status: 'active',
  profile,
  ai_calls_used: 0,
  listen_window_ms: null,
  node: {
    node_id: 'n1',
    node_type: 'narration',
    render_id: 'r_n1',
    source: 'cache',
    segments: [
      { seq: 1, lang: 'en', text: 'The door creaked open.', audio_url: 'https://a/1.mp3', pending: false },
      { seq: 2, lang: 'zh', text: '门吱呀一声开了。', audio_url: 'https://a/2.mp3', pending: false },
    ],
    choices: [],
  },
  ...over,
});
const program: RadioProgramDetail = {
  program_id: 'sotd_20261103',
  kind: 'sotd',
  title: '今日一句',
  band: 'B1',
  voice_id: 'en_gb_f1',
  duration_ms: 20000,
  segments: [
    { seq: 1, lang: 'en', text: 'Break a leg.', start_ms: 0, end_ms: 4000, audio_url: 'https://p/1.mp3' },
    { seq: 2, lang: 'zh', text: '祝你好运。', start_ms: 4000, end_ms: 8000, audio_url: 'https://p/2.mp3' },
  ],
};
const answered = (text = '这句话是祝人好运的意思。') => ({
  success: true,
  data: { request_id: 'x', answer: { segments: [{ seq: 1, lang: 'zh', text }] }, parsed: { kind: 'ask' }, ai_calls_used: 1 },
});

let container: HTMLDivElement;
let root: Root;
const q = (id: string) => container.querySelector(`[data-testid="${id}"]`);
const qa = (id: string) => Array.from(container.querySelectorAll(`[data-testid="${id}"]`));
const click = async (el: Element | null) => {
  expect(el).not.toBeNull();
  await act(async () => (el as HTMLElement).click());
};
/** Right-click (desktop) opens the sentence's menu. */
const openMenu = async (i: number) => {
  await act(async () => {
    qa('radio-sentence')[i].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  });
};
async function mount(el: React.ReactElement) {
  await act(async () => root.render(el));
  await act(async () => {});
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  FakeAudio.all = [];
  vi.stubGlobal('Audio', FakeAudio);
  Element.prototype.scrollIntoView = vi.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  [m.save, m.turn, m.program, m.ask, m.askAudio, m.replace, m.push, m.toast].forEach((f) => f.mockReset());
  m.mic.result = 'ok';
  m.mic.opens = 0;
  m.home = { prefs: { listen_window_on: true }, availability: { tts: true, asr: true, new_render: true }, voices: [] };
  m.program.mockResolvedValue({ success: true, data: program });
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('a question in a story', () => {
  it('long press → "explain this sentence": the voice pauses, a text turn with that sentence and its seq', async () => {
    m.save.mockResolvedValue({ success: true, data: story() });
    m.turn.mockResolvedValue({ success: true, data: story({ node: null, parsed: { kind: 'question' }, answer: { segments: [{ seq: 1, text: '意思是门开了。' }] } }) });
    await mount(<StoryPlayerScreen locale="zh" saveId="sv1" from="home" />);
    await openMenu(1);
    expect(q('radio-explain')?.textContent).toBe('radio.player.explain');
    await click(q('radio-explain'));
    expect(FakeAudio.all[0].paused).toBe(true);
    expect(m.turn).toHaveBeenCalledTimes(1);
    const [, turnId, version, input] = m.turn.mock.calls[0];
    expect(turnId).toMatch(/^[A-Za-z0-9_-]{8,40}$/);
    expect(version).toBe(3);
    expect(input).toEqual({ kind: 'text', text: 'radio.player.explain：门吱呀一声开了。', position: { seq: 2 } });
    // The answer shows as host captions; the part stays (an answer has no part).
    expect(q('radio-answer')?.textContent).toContain('意思是门开了。');
    expect(q('radio-captions')?.textContent).toContain('The door creaked open.');
  });

  it('after the answer, the story carries on from where it stopped', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    m.save.mockResolvedValue({ success: true, data: story() });
    m.turn.mockResolvedValue({ success: true, data: story({ node: null, answer: { segments: [{ seq: 1, text: '答' }] } }) });
    await mount(<StoryPlayerScreen locale="zh" saveId="sv1" from="home" />);
    await openMenu(0);
    await click(q('radio-explain'));
    expect(FakeAudio.all[0].paused).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100); // the answer's reading pause
    });
    expect(q('radio-answer')).toBeNull();
    expect(FakeAudio.all[0].paused).toBe(false);
    expect(FakeAudio.all[0].src).toBe('https://a/1.mp3');
  });

  it("today's limit (quota): a card with Got it; closing it carries the story on", async () => {
    m.save.mockResolvedValue({ success: true, data: story() });
    m.turn.mockResolvedValue({ success: true, data: story({ node: null, notice: { kind: 'quota', code: 'ask', text: '今天的提问用完了' } }) });
    await mount(<StoryPlayerScreen locale="zh" saveId="sv1" from="home" />);
    await openMenu(0);
    await click(q('radio-explain'));
    expect(q('radio-notice')?.textContent).toContain('今天的提问用完了');
    expect(q('radio-notice-close')?.textContent).toBe('radio.notice.gotIt');
    expect(FakeAudio.all[0].paused).toBe(true);
    await click(q('radio-notice-close'));
    expect(q('radio-notice')).toBeNull();
    expect(FakeAudio.all[0].paused).toBe(false);
  });

  it('a long question is cut to 200 characters', async () => {
    const long = 'x'.repeat(400);
    m.save.mockResolvedValue({ success: true, data: story({ node: { ...story().node!, segments: [{ seq: 1, lang: 'en', text: long, audio_url: null, pending: false }] } }) });
    m.turn.mockResolvedValue({ success: true, data: story({ node: null }) });
    await mount(<StoryPlayerScreen locale="zh" saveId="sv1" from="home" />);
    await openMenu(0);
    await click(q('radio-explain'));
    expect(m.turn.mock.calls[0][3].text).toHaveLength(200);
  });
});

describe('a question in a program', () => {
  it('long press → explain: POST /ask with a fresh request_id, the text and the sentence start; the answer, then the program carries on', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    m.ask.mockResolvedValue(answered());
    await mount(<ProgramPlayerScreen locale="zh" programId="sotd_20261103" />);
    await openMenu(1);
    await click(q('radio-explain'));
    expect(m.ask).toHaveBeenCalledTimes(1);
    const [programId, requestId, text, positionMs] = m.ask.mock.calls[0];
    expect(programId).toBe('sotd_20261103');
    expect(requestId).toMatch(/^[A-Za-z0-9_-]{8,40}$/);
    expect(text).toBe('radio.player.explain：祝你好运。');
    expect(positionMs).toBe(4000);
    expect(q('radio-answer')?.textContent).toContain('祝人好运');
    expect(FakeAudio.all[0].paused).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    expect(q('radio-answer')).toBeNull();
    expect(FakeAudio.all[0].paused).toBe(false);
  });

  it('busy: the same question is resent with the same request_id', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    m.ask
      .mockResolvedValueOnce({ success: false, status: 503, errorCode: 'busy', retryAfter: 1 })
      .mockResolvedValueOnce(answered());
    await mount(<ProgramPlayerScreen locale="zh" programId="sotd_20261103" />);
    await openMenu(0);
    await click(q('radio-explain'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(m.ask).toHaveBeenCalledTimes(2);
    expect(m.ask.mock.calls[1][1]).toBe(m.ask.mock.calls[0][1]);
  });

  it('no network: retry resends the same request_id', async () => {
    m.ask.mockResolvedValueOnce({ success: false, errorCode: 'NETWORK_ERROR' }).mockResolvedValueOnce(answered());
    await mount(<ProgramPlayerScreen locale="zh" programId="sotd_20261103" />);
    await openMenu(0);
    await click(q('radio-explain'));
    await click(q('radio-ask-failed')!.querySelector('button'));
    expect(m.ask.mock.calls[1][1]).toBe(m.ask.mock.calls[0][1]);
    expect(q('radio-ask-failed')).toBeNull();
  });

  it('409 request_consumed: back to the radio home with radio.home.refreshed', async () => {
    m.ask.mockResolvedValue({ success: false, status: 409, errorCode: 'request_consumed' });
    await mount(<ProgramPlayerScreen locale="zh" programId="sotd_20261103" />);
    await openMenu(0);
    await click(q('radio-explain'));
    expect(m.toast).toHaveBeenCalledWith('radio.home.refreshed');
    expect(m.push).toHaveBeenCalledWith('/zh/radio');
  });

  it('by voice: the microphone records and POST /ask/audio gets the request_id, position and voice.webm', async () => {
    m.askAudio.mockResolvedValue(answered());
    await mount(<ProgramPlayerScreen locale="zh" programId="sotd_20261103" />);
    await act(async () => FakeAudio.all[0].onended?.()); // now on sentence 2
    await click(q('radio-mic-button'));
    expect(m.mic.opens).toBe(1);
    expect(FakeAudio.all[0].paused).toBe(true);
    expect(q('radio-listening-indicator')).not.toBeNull();
    const blob = new Blob(['v'], { type: 'audio/webm' });
    await act(async () => {
      m.mic.setState?.('idle');
      m.mic.opts!.onRecorded(blob, 1800, 'audio/webm;codecs=opus');
    });
    const [programId, ask, audio, duration, name] = m.askAudio.mock.calls[0];
    expect(programId).toBe('sotd_20261103');
    expect(ask.requestId).toMatch(/^[A-Za-z0-9_-]{8,40}$/);
    expect(ask.positionMs).toBe(4000);
    expect([audio, duration, name]).toEqual([blob, 1800, 'voice.webm']);
  });

  it('ask another way (voice_unrecognized): the line stays and the program carries on; an answered question clears it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    m.askAudio.mockResolvedValue({ success: true, data: { request_id: 'x', notice: { kind: 'retry', code: 'voice_unrecognized', text: '长按句子来提问吧' }, ai_calls_used: 0 } });
    m.ask.mockResolvedValue(answered());
    await mount(<ProgramPlayerScreen locale="zh" programId="sotd_20261103" />);
    await click(q('radio-mic-button'));
    await act(async () => {
      m.mic.setState?.('idle');
      m.mic.opts!.onRecorded(new Blob(['v']), 900, 'audio/webm');
    });
    expect(FakeAudio.all[0].paused).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(q('radio-voice-line')?.textContent).toBe('长按句子来提问吧');
    await openMenu(0);
    await click(q('radio-explain'));
    expect(q('radio-voice-line')).toBeNull();
  });

  it('care (input_self_harm): the card stays and nothing resumes by itself', async () => {
    m.askAudio.mockResolvedValue({ success: true, data: { request_id: 'x', notice: { kind: 'paused', code: 'input_self_harm', text: '我们在这里。' }, ai_calls_used: 0 } });
    await mount(<ProgramPlayerScreen locale="zh" programId="sotd_20261103" />);
    await click(q('radio-mic-button'));
    await act(async () => {
      m.mic.setState?.('idle');
      m.mic.opts!.onRecorded(new Blob(['v']), 900, 'audio/webm');
    });
    expect(q('radio-care')?.textContent).toContain('我们在这里。');
    expect(q('radio-paused')).not.toBeNull();
    expect(FakeAudio.all[0].paused).toBe(true);
  });

  it('no voice input in the region (availability.asr false): no microphone in a program', async () => {
    m.home = { prefs: {}, availability: { tts: true, asr: false, new_render: true }, voices: [] };
    await mount(<ProgramPlayerScreen locale="zh" programId="sotd_20261103" />);
    expect(q('radio-mic')).toBeNull();
    expect(qa('radio-sentence')).toHaveLength(2); // long press still asks
  });

  it('503 feature_disabled_in_region on a spoken question: the microphone goes for the session', async () => {
    m.askAudio.mockResolvedValue({ success: false, status: 503, errorCode: 'feature_disabled_in_region' });
    await mount(<ProgramPlayerScreen locale="zh" programId="sotd_20261103" />);
    await click(q('radio-mic-button'));
    await act(async () => {
      m.mic.setState?.('idle');
      m.mic.opts!.onRecorded(new Blob(['v']), 900, 'audio/webm');
    });
    expect(m.toast).toHaveBeenCalledWith('radio.mic.regionDisabled');
    expect(q('radio-mic')).toBeNull();
  });

  it('a blocked microphone: the help on the tap, and the program carries on', async () => {
    m.mic.result = 'blocked';
    await mount(<ProgramPlayerScreen locale="zh" programId="sotd_20261103" />);
    await click(q('radio-mic-button'));
    expect(q('radio-blocked-help')).not.toBeNull();
    expect(FakeAudio.all[0].paused).toBe(false);
  });
});
