/**
 * @vitest-environment jsdom
 *
 * KAZI-1209 part 2 — voice in the story player (kazispace-ui personal-radio.md, Voice · Notices ·
 * Data · A spoken turn). The microphone hook is replaced by a controllable fake; its own rules are
 * tested in `kazi-1209-radio-mic.test.tsx`.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RadioPlayerResponse } from '@/types/radio';

type MicOpts = { onRecorded: (a: Blob, d: number, m: string) => void; onSilence: () => void };
const m = vi.hoisted(() => ({
  save: vi.fn(),
  turn: vi.fn(),
  turnAudio: vi.fn(),
  prefs: vi.fn(),
  render: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
  toast: vi.fn(),
  home: null as null | Record<string, unknown>,
  mic: {
    opts: null as null | MicOpts,
    setState: null as null | ((s: string) => void),
    result: 'ok' as 'ok' | 'blocked' | 'no_device',
    opens: [] as Array<{ windowMs?: number | null } | undefined>,
    cancels: 0,
    records: 0,
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
        open: async (o?: { windowMs?: number | null }) => {
          m.mic.opens.push(o);
          if (m.mic.result === 'ok') setState(o?.windowMs ? 'window' : 'recording');
          return m.mic.result;
        },
        record: () => {
          m.mic.records += 1;
          setState('recording');
        },
        done: () => undefined,
        cancel: () => {
          m.mic.cancels += 1;
          setState('idle');
        },
      };
    },
  };
});
vi.mock('@/lib/radio/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/radio/api')>()),
  getRadioSave: m.save,
  postRadioTurn: m.turn,
  patchRadioPrefs: m.prefs,
  getRadioRender: m.render,
}));

vi.mock('@/lib/radio/player-api', () => ({ postRadioTurnAudio: m.turnAudio }));

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
/** Lets the part (and the host reading the choices) play to the end. */
const finishAll = async () => {
  for (let i = 0; i < 20; i += 1) {
    const a = FakeAudio.all[0];
    if (!a || a.paused) break;
    await act(async () => a.onended?.());
  }
};
const srcs: string[] = [];

const profile = { band: 'B1', en_ratio: 0.4, voice_id: 'en_gb_f1', source: 'override' } as const;
function resp(over: Partial<RadioPlayerResponse> & { nodeType?: 'choice' | 'narration' | 'ending'; nodeId?: string } = {}): RadioPlayerResponse {
  const { nodeType = 'choice', nodeId = 'n1', ...rest } = over;
  return {
    save_id: 'sv1',
    save_version: 3,
    status: 'active',
    profile,
    ai_calls_used: 0,
    listen_window_ms: 8000,
    node: {
      node_id: nodeId,
      node_type: nodeType,
      render_id: `r_${nodeId}`,
      source: 'cache',
      segments: [
        { seq: 1, lang: 'en', text: `${nodeId} first`, audio_url: `https://a/${nodeId}-1.mp3`, pending: false },
        { seq: 2, lang: 'zh', text: `${nodeId} second`, audio_url: `https://a/${nodeId}-2.mp3`, pending: false },
      ],
      choices:
        nodeType === 'choice'
          ? [
              { key: 'A', choice_id: 'c_a', label: 'Knock', audio_url: `https://a/${nodeId}-ca.mp3` },
              { key: 'B', choice_id: 'c_b', label: 'Leave', audio_url: `https://a/${nodeId}-cb.mp3` },
            ]
          : [],
    },
    ...rest,
  };
}
/** An answer with no part: what the server sends for a command, a question or a "not understood". */
const bare = (over: Partial<RadioPlayerResponse>): RadioPlayerResponse => ({
  save_id: 'sv1',
  save_version: 3,
  status: 'active',
  profile,
  ai_calls_used: 0,
  listen_window_ms: 8000,
  node: null,
  ...over,
});

let container: HTMLDivElement;
let root: Root;
const q = (id: string) => container.querySelector(`[data-testid="${id}"]`);
const qa = (id: string) => Array.from(container.querySelectorAll(`[data-testid="${id}"]`));
const click = async (el: Element | null) => {
  expect(el).not.toBeNull();
  await act(async () => {
    el!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    (el as HTMLElement).click();
  });
};
/** A tap anywhere on the player: browsers need one before the page may record. */
const tapScreen = async () => {
  await act(async () => q('radio-captions')!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
};
const record = async (blob = new Blob(['x'], { type: 'audio/webm' })) => {
  await act(async () => {
    m.mic.setState?.('idle');
    m.mic.opts!.onRecorded(blob, 1500, 'audio/webm;codecs=opus');
  });
  await act(async () => {});
};
const silence = async () => {
  await act(async () => {
    m.mic.setState?.('idle');
    m.mic.opts!.onSilence();
  });
};

function setHome({ listen = true as boolean | null, asr = true } = {}) {
  m.home = { prefs: { listen_window_on: listen }, availability: { tts: true, asr, new_render: true }, voices: [] };
}

async function mount() {
  await act(async () => {
    root.render(<StoryPlayerScreen locale="zh" saveId="sv1" from="home" />);
  });
  await act(async () => {});
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  FakeAudio.all = [];
  srcs.length = 0;
  vi.stubGlobal('Audio', FakeAudio);
  const origPlay = FakeAudio.prototype.play;
  vi.spyOn(FakeAudio.prototype, 'play').mockImplementation(function (this: FakeAudio) {
    srcs.push(this.src);
    return origPlay.call(this);
  });
  Element.prototype.scrollIntoView = vi.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  [m.save, m.turn, m.turnAudio, m.prefs, m.render, m.replace, m.push, m.toast].forEach((f) => f.mockReset());
  m.prefs.mockResolvedValue({ success: true, data: { prefs: {}, profile } });
  m.mic.opts = null;
  m.mic.result = 'ok';
  m.mic.opens = [];
  m.mic.cancels = 0;
  m.mic.records = 0;
  setHome();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('the host reads the choices, then the listen window', () => {
  it('after the part, the choices are read (their audio), the card being read is highlighted', async () => {
    m.save.mockResolvedValue({ success: true, data: resp() });
    await mount();
    await act(async () => FakeAudio.all[0].onended?.()); // sentence 1
    await act(async () => FakeAudio.all[0].onended?.()); // sentence 2
    expect(srcs.at(-1)).toBe('https://a/n1-ca.mp3');
    expect(qa('radio-choice')[0].getAttribute('data-reading')).toBe('true');
  });

  it('opens with the server-given length once the user has tapped on this screen', async () => {
    m.save.mockResolvedValue({ success: true, data: resp() });
    await mount();
    await tapScreen();
    await finishAll();
    expect(m.mic.opens).toEqual([{ windowMs: 8000 }]);
    expect(q('radio-listening-indicator')?.textContent).toContain('radio.mic.recording');
    expect(q('radio-mic')?.getAttribute('data-state')).toBe('window');
    expect(q('radio-mic-listening')?.textContent).toContain('radio.mic.listening');
  });

  it('never opens before a tap on this screen (the page may not record yet): the player waits for a tap', async () => {
    m.save.mockResolvedValue({ success: true, data: resp() });
    await mount();
    await finishAll();
    expect(m.mic.opens).toEqual([]);
    expect(q('radio-listening-indicator')).toBeNull();
  });

  it('"Listen at choices" off on the server (listen_window_ms null): no window', async () => {
    m.save.mockResolvedValue({ success: true, data: resp({ listen_window_ms: null }) });
    await mount();
    await tapScreen();
    await finishAll();
    expect(m.mic.opens).toEqual([]);
  });

  it('voice off in the region: no consent card, no window; the crossed-out microphone says so when tapped', async () => {
    setHome({ listen: null, asr: false });
    m.save.mockResolvedValue({ success: true, data: resp() });
    await mount();
    await tapScreen();
    await finishAll();
    expect(q('radio-consent')).toBeNull();
    expect(m.mic.opens).toEqual([]);
    expect(q('radio-mic')?.getAttribute('data-state')).toBe('unavailable');
    await click(q('radio-mic-button'));
    expect(m.toast).toHaveBeenCalledWith('radio.mic.regionDisabled');
    expect(m.mic.opens).toEqual([]);
  });
});

describe('explain first, then ask (the consent card)', () => {
  it('appears once at the first choice point when the user has never chosen; allow saves and opens the window', async () => {
    setHome({ listen: null });
    m.save.mockResolvedValue({ success: true, data: resp() });
    await mount();
    await finishAll();
    expect(q('radio-consent')).not.toBeNull();
    expect(m.mic.opens).toEqual([]); // nothing is asked of the system before the user's choice
    await click(q('radio-consent-allow'));
    expect(m.prefs).toHaveBeenCalledWith({ listen_window_on: true });
    expect(m.mic.opens).toEqual([{ windowMs: 8000 }]);
    expect(q('radio-consent')).toBeNull();
  });

  it("I'll tap instead: saved off, the host's line, and nothing asks again by itself", async () => {
    setHome({ listen: null });
    m.save.mockResolvedValue({ success: true, data: resp() });
    await mount();
    await finishAll();
    await click(q('radio-consent-deny'));
    expect(m.prefs).toHaveBeenCalledWith({ listen_window_on: false });
    expect(q('radio-voice-line')?.textContent).toBe('radio.mic.denied');
    expect(m.mic.opens).toEqual([]);
    expect(q('radio-mic')?.getAttribute('data-state')).toBe('unavailable');
  });

  it('the two buttons have equal weight (neither is the primary style)', async () => {
    setHome({ listen: null });
    m.save.mockResolvedValue({ success: true, data: resp() });
    await mount();
    await finishAll();
    expect(q('radio-consent-allow')?.className).toBe(q('radio-consent-deny')?.className);
  });

  it('when saving the choice fails, the toast says so and the setting goes back', async () => {
    setHome({ listen: null });
    m.prefs.mockResolvedValue({ success: false, status: 422, errorCode: 'invalid_request' });
    m.save.mockResolvedValue({ success: true, data: resp() });
    await mount();
    await finishAll();
    await click(q('radio-consent-deny'));
    await act(async () => {});
    expect(m.toast).toHaveBeenCalledWith('radio.settings.saveFailed');
  });
});

describe('the two-strike rule', () => {
  it('first silence reads the choices again and reopens; the second pauses the story (pause, no_response)', async () => {
    m.save.mockResolvedValue({ success: true, data: resp() });
    m.turn.mockResolvedValue({ success: true, data: bare({ notice: { kind: 'paused', text: '先停在这里' } }) });
    await mount();
    await tapScreen();
    await finishAll();
    await silence();
    expect(srcs.at(-1)).toBe('https://a/n1-ca.mp3'); // the choices again, not the whole part
    await finishAll();
    expect(m.mic.opens).toHaveLength(2);
    await silence();
    expect(m.turn).toHaveBeenCalledTimes(1);
    expect(m.turn.mock.calls[0][3]).toEqual({ kind: 'command', command: 'pause', reason: 'no_response' });
    expect(q('radio-paused')?.textContent).toContain('radio.notice.paused');
    await click(q('radio-continue'));
    expect(q('radio-paused')).toBeNull();
    expect(srcs.at(-1)).toBe('https://a/n1-ca.mp3'); // resuming at a choice point reads the choices again
  });

  it('"not understood" twice at a choice point pauses the same way', async () => {
    m.save.mockResolvedValue({ success: true, data: resp() });
    m.turnAudio.mockResolvedValue({ success: true, data: bare({ notice: { kind: 'retry', code: null, text: '没听清' } }) });
    m.turn.mockResolvedValue({ success: true, data: bare({ notice: { kind: 'paused' } }) });
    await mount();
    await tapScreen();
    await finishAll();
    await record();
    expect(q('radio-voice-line')?.textContent).toBe('没听清');
    expect(m.turn).not.toHaveBeenCalled();
    await finishAll();
    await record();
    expect(m.turn.mock.calls[0][3]).toEqual({ kind: 'command', command: 'pause', reason: 'no_response' });
  });
});

describe('a spoken turn', () => {
  it('sends the recording with a fresh turn_id, the save version and voice.webm; a new part then plays', async () => {
    m.save.mockResolvedValue({ success: true, data: resp() });
    m.turnAudio.mockResolvedValue({ success: true, data: resp({ nodeId: 'n2', save_version: 4, parsed: { kind: 'choice', choice_id: 'c_b', via: 'grammar' } }) });
    await mount();
    await tapScreen();
    await finishAll();
    const blob = new Blob(['voice'], { type: 'audio/webm' });
    await record(blob);
    expect(m.turnAudio).toHaveBeenCalledTimes(1);
    const [saveId, turn, audio, duration, name] = m.turnAudio.mock.calls[0];
    expect(saveId).toBe('sv1');
    expect(turn.turnId).toMatch(/^[A-Za-z0-9_-]{8,40}$/);
    expect(turn.saveVersion).toBe(3);
    expect(turn.position).toBeNull(); // from the listen window: the part was heard to its end
    expect(audio).toBe(blob);
    expect(duration).toBe(1500);
    expect(name).toBe('voice.webm');
    expect(q('radio-captions')?.textContent).toContain('n2 first');
  });

  it('a tap on the microphone while the host talks stops the voice and records at once, with the sentence playing', async () => {
    m.save.mockResolvedValue({ success: true, data: resp() });
    m.turnAudio.mockResolvedValue({ success: true, data: bare({ parsed: { kind: 'command', command: 'save' } }) });
    await mount();
    await act(async () => FakeAudio.all[0].onended?.()); // now on sentence 2
    await click(q('radio-mic-button'));
    expect(FakeAudio.all[0].paused).toBe(true);
    expect(m.mic.opens).toEqual([undefined]);
    expect(q('radio-mic')?.getAttribute('data-state')).toBe('recording');
    await record();
    expect(m.turnAudio.mock.calls[0][1].position).toEqual({ seq: 2 });
    expect(m.toast).toHaveBeenCalledWith('radio.player.saved');
  });

  it('busy: the same recording is resent with the same turn_id', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    m.save.mockResolvedValue({ success: true, data: resp() });
    m.turnAudio
      .mockResolvedValueOnce({ success: false, status: 503, errorCode: 'busy', retryAfter: 1 })
      .mockResolvedValueOnce({ success: true, data: resp({ nodeId: 'n2', save_version: 4 }) });
    await mount();
    await tapScreen();
    await finishAll();
    await record();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(m.turnAudio).toHaveBeenCalledTimes(2);
    expect(m.turnAudio.mock.calls[1][1].turnId).toBe(m.turnAudio.mock.calls[0][1].turnId);
    expect(m.turnAudio.mock.calls[1][2]).toBe(m.turnAudio.mock.calls[0][2]);
  });

  it('503 feature_disabled_in_region: voice is off for the rest of the session', async () => {
    m.save.mockResolvedValue({ success: true, data: resp() });
    m.turnAudio.mockResolvedValue({ success: false, status: 503, errorCode: 'feature_disabled_in_region' });
    await mount();
    await tapScreen();
    await finishAll();
    await record();
    expect(m.toast).toHaveBeenCalledWith('radio.mic.regionDisabled');
    expect(q('radio-mic')?.getAttribute('data-state')).toBe('unavailable');
    expect(q('radio-turn-failed')).toBeNull();
  });

  it('a recording that could not be sent offers retry with the same turn', async () => {
    m.save.mockResolvedValue({ success: true, data: resp() });
    m.turnAudio
      .mockResolvedValueOnce({ success: false, errorCode: 'NETWORK_ERROR' })
      .mockResolvedValueOnce({ success: true, data: resp({ nodeId: 'n2', save_version: 4 }) });
    await mount();
    await tapScreen();
    await finishAll();
    await record();
    await click(q('radio-turn-failed')!.querySelector('button'));
    expect(m.turnAudio.mock.calls[1][1].turnId).toBe(m.turnAudio.mock.calls[0][1].turnId);
  });

  it('tapping a choice while the window is open discards the recording and sends the tap', async () => {
    m.save.mockResolvedValue({ success: true, data: resp() });
    m.turn.mockResolvedValue({ success: true, data: resp({ nodeId: 'n2', save_version: 4 }) });
    await mount();
    await tapScreen();
    await finishAll();
    await click(qa('radio-choice')[1]);
    expect(m.mic.cancels).toBeGreaterThan(0);
    expect(m.turn.mock.calls[0][3]).toEqual({ kind: 'choice', choice_id: 'c_b' });
    expect(m.turnAudio).not.toHaveBeenCalled();
  });

  it('a tap on the microphone during the window starts recording at once', async () => {
    m.save.mockResolvedValue({ success: true, data: resp() });
    await mount();
    await tapScreen();
    await finishAll();
    await click(q('radio-mic-button'));
    expect(m.mic.records).toBe(1);
    expect(q('radio-mic-done')).not.toBeNull();
    expect(q('radio-mic-cancel')).not.toBeNull();
  });
});

describe('notices on a spoken turn', () => {
  it("can't take that (input_blocked): the line, and the window reopens without reading again or a strike", async () => {
    m.save.mockResolvedValue({ success: true, data: resp() });
    m.turnAudio.mockResolvedValue({ success: true, data: bare({ notice: { kind: 'retry', code: 'input_blocked', text: '这个我接不了' } }) });
    await mount();
    await tapScreen();
    await finishAll();
    const before = srcs.length;
    await record();
    expect(q('radio-voice-line')?.textContent).toBe('这个我接不了');
    expect(srcs.length).toBe(before);
    expect(m.mic.opens).toHaveLength(2);
    await record();
    await record();
    expect(m.turn).not.toHaveBeenCalled(); // never counts as a strike
  });

  it('tap instead (voice_unrecognized): the line stays, and the window does not reopen here', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    m.save.mockResolvedValue({ success: true, data: resp() });
    m.turnAudio.mockResolvedValue({ success: true, data: bare({ notice: { kind: 'retry', code: 'voice_unrecognized', text: '点一下选项吧' } }) });
    await mount();
    await tapScreen();
    await finishAll();
    await record();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(q('radio-voice-line')?.textContent).toBe('点一下选项吧');
    expect(m.mic.opens).toHaveLength(1);
  });

  it('"not understood" goes after 3 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    m.save.mockResolvedValue({ success: true, data: resp() });
    m.turnAudio.mockResolvedValue({ success: true, data: bare({ notice: { kind: 'retry', text: '没听清' } }) });
    await mount();
    await tapScreen();
    await finishAll();
    await record();
    expect(q('radio-voice-line')).not.toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    expect(q('radio-voice-line')).toBeNull();
  });

  it('care (input_self_harm): a card that stays, paused, no continue in the banner; keep listening resumes', async () => {
    m.save.mockResolvedValue({ success: true, data: resp() });
    m.turnAudio.mockResolvedValue({ success: true, data: bare({ notice: { kind: 'paused', code: 'input_self_harm', text: '我们在这里。' } }) });
    await mount();
    await tapScreen();
    await finishAll();
    await record();
    expect(q('radio-care')?.textContent).toContain('我们在这里。');
    expect(q('radio-paused')).not.toBeNull();
    expect(q('radio-continue')).toBeNull();
    expect(q('radio-notice')).toBeNull();
    expect(m.mic.opens).toHaveLength(1);
    await click(Array.from(q('radio-care')!.querySelectorAll('button'))[0]);
    expect(q('radio-care')).toBeNull();
    expect(q('radio-paused')).toBeNull();
  });
});

describe('commands the app carries out itself', () => {
  async function say(parsed: { kind: string; command: string }) {
    m.save.mockResolvedValue({ success: true, data: resp() });
    m.turnAudio.mockResolvedValue({ success: true, data: bare({ parsed }) });
    await mount();
    await tapScreen();
    await finishAll();
    await record();
  }

  it('slower: 0.75×', async () => {
    await say({ kind: 'command', command: 'slower' });
    expect(FakeAudio.all[0].playbackRate).toBe(0.75);
  });

  it('repeat at a choice point: the choices are read again', async () => {
    await say({ kind: 'command', command: 'repeat' });
    expect(srcs.at(-1)).toBe('https://a/n1-ca.mp3');
  });

  it('exit: leaves the player', async () => {
    await say({ kind: 'command', command: 'exit' });
    expect(m.push).toHaveBeenCalledWith('/zh/radio');
  });

  it('who are you: the host caption, then the window opens again without reading the choices', async () => {
    m.save.mockResolvedValue({ success: true, data: resp() });
    m.turnAudio.mockResolvedValue({
      success: true,
      data: bare({ parsed: { kind: 'command', command: 'identity' }, answer: { segments: [{ seq: 1, lang: 'zh', text: '我是 KaziSpace 的 AI 电台主播。' }] } }),
    });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await mount();
    await tapScreen();
    await finishAll();
    const before = srcs.length;
    await record();
    expect(q('radio-answer')?.textContent).toContain('AI 电台主播');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100); // the caption's reading pause
    });
    expect(q('radio-answer')).toBeNull();
    expect(srcs.length).toBe(before);
    expect(m.mic.opens).toHaveLength(2);
  });
});

describe('microphone access', () => {
  it('a tap when the system blocks the microphone opens the help with the platform steps', async () => {
    m.mic.result = 'blocked';
    m.save.mockResolvedValue({ success: true, data: resp() });
    await mount();
    await click(q('radio-mic-button'));
    expect(q('radio-blocked-help')).not.toBeNull();
    expect(q('radio-blocked-steps')?.textContent).toBe('radio.mic.blockedHelp.desktop');
  });

  it('the help never opens on its own (a window that cannot open stays quiet)', async () => {
    m.mic.result = 'blocked';
    m.save.mockResolvedValue({ success: true, data: resp() });
    await mount();
    await tapScreen();
    await finishAll();
    expect(m.mic.opens).toHaveLength(1);
    expect(q('radio-blocked-help')).toBeNull();
    expect(q('radio-mic')?.getAttribute('data-state')).toBe('unavailable');
  });

  it('no microphone: a toast on tap, not a refusal (the choice is left as it is)', async () => {
    m.mic.result = 'no_device';
    m.save.mockResolvedValue({ success: true, data: resp() });
    await mount();
    await click(q('radio-mic-button'));
    expect(m.toast).toHaveBeenCalledWith('radio.mic.noDevice');
    expect(m.prefs).not.toHaveBeenCalled();
  });

  it('the screen going out of sight turns the microphone off', async () => {
    m.save.mockResolvedValue({ success: true, data: resp() });
    await mount();
    await tapScreen();
    await finishAll();
    const before = m.mic.cancels;
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    expect(m.mic.cancels).toBeGreaterThan(before);
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  });
});
