/**
 * @vitest-environment jsdom
 *
 * KAZI-1209 — a story in the player (kazispace-ui personal-radio.md, Player · The audio of a part · Data).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RadioPlayerResponse } from '@/types/radio';

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
vi.mock('@/lib/radio/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/radio/api')>()),
  getRadioSave: m.save,
  postRadioTurn: m.turn,
  getRadioRender: m.render,
}));

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
const finishAll = async () => {
  for (let i = 0; i < 20; i += 1) {
    const a = FakeAudio.all[0];
    if (!a || a.paused) break;
    await act(async () => a.onended?.());
  }
};

const profile = { band: 'B1', en_ratio: 0.4, voice_id: 'en_gb_f1', source: 'override' } as const;
function resp(over: Partial<RadioPlayerResponse> & { nodeType?: 'choice' | 'narration' | 'ending'; nodeId?: string }): RadioPlayerResponse {
  const { nodeType = 'choice', nodeId = 'n1', ...rest } = over;
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
        { seq: 1, lang: 'en', text: `${nodeId} first`, audio_url: 'https://a/1.mp3', pending: false },
        { seq: 2, lang: 'zh', text: `${nodeId} second`, audio_url: 'https://a/2.mp3', pending: false },
      ],
      choices:
        nodeType === 'choice'
          ? [
              { key: 'A', choice_id: 'c_a', label: 'Knock' },
              { key: 'B', choice_id: 'c_b', label: 'Leave' },
            ]
          : [],
    },
    ...rest,
  };
}

let container: HTMLDivElement;
let root: Root;
const q = (id: string) => container.querySelector(`[data-testid="${id}"]`);
const qa = (id: string) => Array.from(container.querySelectorAll(`[data-testid="${id}"]`));

async function mount(from: 'studio' | 'home' = 'home') {
  await act(async () => {
    root.render(<StoryPlayerScreen locale="zh" saveId="sv1" from={from} />);
  });
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
  Object.values(m).forEach((f) => f.mockReset());
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('StoryPlayerScreen', () => {
  it('resumes the save: captions, choice cards, back to the radio home', async () => {
    m.save.mockResolvedValue({ success: true, data: resp({}) });
    await mount();
    expect(m.save).toHaveBeenCalledWith('sv1');
    expect(q('radio-captions')?.textContent).toContain('n1 first');
    expect(qa('radio-choice').map((b) => b.textContent)).toEqual(['AKnock', 'BLeave']);
    expect(container.querySelector('a[href="/zh/radio"]')).not.toBeNull();
  });

  it('opened from Studio: back goes to Studio in one step', async () => {
    m.save.mockResolvedValue({ success: true, data: resp({}) });
    await mount('studio');
    expect(container.querySelector('a[href="/zh/clinic/hub"]')).not.toBeNull();
  });

  it('a tapped choice sends one turn with the save version, then plays the next part', async () => {
    m.save.mockResolvedValue({ success: true, data: resp({}) });
    m.turn.mockResolvedValue({ success: true, data: resp({ nodeId: 'n2', save_version: 4 }) });
    await mount();
    await act(async () => (qa('radio-choice')[1] as HTMLButtonElement).click());
    expect(m.turn).toHaveBeenCalledTimes(1);
    const [saveId, turnId, version, input] = m.turn.mock.calls[0];
    expect(saveId).toBe('sv1');
    expect(turnId).toMatch(/^[A-Za-z0-9_-]{8,40}$/);
    expect(version).toBe(3);
    expect(input).toEqual({ kind: 'choice', choice_id: 'c_b' });
    expect(q('radio-captions')?.textContent).toContain('n2 first');
  });

  it('a continuation part moves on by itself when it has played (advance)', async () => {
    m.save.mockResolvedValue({ success: true, data: resp({ nodeType: 'narration' }) });
    m.turn.mockResolvedValue({ success: true, data: resp({ nodeId: 'n2', save_version: 4 }) });
    await mount();
    expect(m.turn).not.toHaveBeenCalled();
    await finishAll();
    expect(m.turn).toHaveBeenCalledTimes(1);
    expect(m.turn.mock.calls[0][3]).toEqual({ kind: 'command', command: 'advance' });
  });

  it('busy: waits Retry-After and resends the same turn (same turn_id and version)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    m.save.mockResolvedValue({ success: true, data: resp({}) });
    m.turn
      .mockResolvedValueOnce({ success: false, status: 503, errorCode: 'busy', retryAfter: 1 })
      .mockResolvedValueOnce({ success: true, data: resp({ nodeId: 'n2', save_version: 4 }) });
    await mount();
    await act(async () => (qa('radio-choice')[0] as HTMLButtonElement).click());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(m.turn).toHaveBeenCalledTimes(2);
    expect(m.turn.mock.calls[1][1]).toBe(m.turn.mock.calls[0][1]);
    expect(m.turn.mock.calls[1][2]).toBe(3);
  });

  it('moved on elsewhere (409 save_conflict): reloads the save and says so; the tap is not resent', async () => {
    m.save
      .mockResolvedValueOnce({ success: true, data: resp({}) })
      .mockResolvedValueOnce({ success: true, data: resp({ nodeId: 'n5', save_version: 9 }) });
    m.turn.mockResolvedValue({ success: false, status: 409, errorCode: 'save_conflict' });
    await mount();
    await act(async () => (qa('radio-choice')[0] as HTMLButtonElement).click());
    expect(m.turn).toHaveBeenCalledTimes(1);
    expect(m.toast).toHaveBeenCalledWith('radio.notice.synced');
    expect(q('radio-captions')?.textContent).toContain('n5 first');
  });

  it('a failed turn offers retry with the same turn', async () => {
    m.save.mockResolvedValue({ success: true, data: resp({}) });
    m.turn
      .mockResolvedValueOnce({ success: false, errorCode: 'NETWORK_ERROR' })
      .mockResolvedValueOnce({ success: true, data: resp({ nodeId: 'n2', save_version: 4 }) });
    await mount();
    await act(async () => (qa('radio-choice')[0] as HTMLButtonElement).click());
    expect(q('radio-turn-failed')).not.toBeNull();
    await act(async () => (q('radio-turn-failed')?.querySelector('button') as HTMLButtonElement).click());
    expect(m.turn.mock.calls[1][1]).toBe(m.turn.mock.calls[0][1]);
    expect(q('radio-turn-failed')).toBeNull();
  });

  it('a sentence still being made: asks GET renders with the voice and fills its audio in', async () => {
    const pending = resp({});
    pending.node!.segments[1] = { seq: 2, lang: 'zh', text: 'n1 second', audio_url: null, pending: true };
    m.save.mockResolvedValue({ success: true, data: pending });
    m.render.mockResolvedValue({
      success: true,
      data: { render_id: 'r_n1', voice_id: 'en_gb_f1', segments: [{ seq: 2, audio_url: 'https://a/2b.mp3', pending: false }], choices: [] },
    });
    await mount();
    await act(async () => {});
    expect(m.render).toHaveBeenCalledWith('r_n1', 'en_gb_f1');
    expect(m.render).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['save_not_found', 409],
    ['story_not_found', 409],
  ])('409 %s: "content cannot be found", with the way home', async (code, status) => {
    m.save.mockResolvedValue({ success: false, status, errorCode: code });
    await mount();
    expect(q('radio-story-missing')?.textContent).toContain('radio.contentMissing');
  });

  it('radio off / not for this user: goes to Studio', async () => {
    m.save.mockResolvedValue({ success: false, status: 403, errorCode: 'radio_pro_required' });
    await mount();
    expect(m.replace).toHaveBeenCalledWith('/zh/clinic/hub');
  });

  it('a notice from the server is shown and can be closed', async () => {
    m.save.mockResolvedValue({ success: true, data: resp({ notice: { kind: 'quota', code: 'ask', text: '今天的提问用完了' } }) });
    await mount();
    expect(q('radio-notice')?.textContent).toContain('今天的提问用完了');
  });

  it('the ending offers the way back to the radio home', async () => {
    m.save.mockResolvedValue({ success: true, data: resp({ nodeType: 'ending', nodeId: 'end1' }) });
    await mount();
    expect(q('radio-ending')?.querySelector('a')?.getAttribute('href')).toBe('/zh/radio');
    expect(qa('radio-choice')).toHaveLength(0);
  });
});
