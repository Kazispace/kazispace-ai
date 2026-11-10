/**
 * @vitest-environment jsdom
 *
 * KAZI-1209 part 5 — replay, deleting, the listened list, the ending summary, phrases, the daily greeting,
 * clearing radio data from Me, and playback events (kazispace-ui personal-radio.md: Replay · Deleting a
 * story · Radio home · Ending summary · Player · Clearing radio data from Me · Data · Playback events).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RadioHome, RadioPlayerResponse } from '@/types/radio';

const m = vi.hoisted(() => ({
  events: vi.fn(),
  saves: vi.fn(),
  replay: vi.fn(),
  del: vi.fn(),
  memory: vi.fn(),
  home: vi.fn(),
  save: vi.fn(),
  turn: vi.fn(),
  start: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
  toast: vi.fn(),
  refresh: vi.fn(),
  homeState: null as RadioHome | null,
}));

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string, vals?: Record<string, unknown>) =>
    vals ? `${ns}.${key}(${Object.entries(vals).map(([k, v]) => `${k}=${v}`).join(',')})` : `${ns}.${key}`,
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
// KAZI-1257 E: these tests are about saves; the story filter row is covered in kazi-1257-radio-filters.test.tsx.
vi.mock('@/components/radio/story-filters', () => ({
  StoryFilterBar: () => null,
  storyGenreLabel: () => null,
  useStoryFilters: () => ({ bar: null, active: false, stories: null, loading: false, failed: false }),
}));
// KAZI-1287: the Live section reads its own endpoint; it has its own tests (kazi-1287-live-section).
vi.mock('@/components/radio/live-section', () => ({ LiveSection: () => null }));
vi.mock('@/hooks/use-radio-home', () => ({
  useRadioHome: () => ({
    access: m.homeState ? 'open' : null,
    home: m.homeState,
    isLoading: false,
    refresh: m.refresh,
    setHome: vi.fn(),
  }),
}));
vi.mock('@/lib/radio/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/radio/api')>()),
  getRadioHome: m.home,
  getRadioSave: m.save,
  postRadioTurn: m.turn,
  startRadioStory: m.start,
  getRadioRender: vi.fn(),
}));
vi.mock('@/lib/radio/player-api', () => ({
  postRadioEvents: m.events,
  getRadioSaves: m.saves,
  getRadioReplay: m.replay,
  deleteRadioSave: m.del,
  deleteRadioMemory: m.memory,
  getRadioBgm: vi.fn(async () => ({ success: true, data: { tracks: [] } })),
  postRadioTurnAudio: vi.fn(),
}));

import * as EV from '@/lib/radio/events';
import { splitPhrases } from '@/components/radio/player-parts';
import { ClearRadioDataRow } from '@/components/radio/clear-radio-data-row';
import { RadioHomeScreen } from '@/components/radio/radio-home';
import { RadioReplayScreen } from '@/components/radio/radio-replay';
import { StoryPlayerScreen } from '@/components/radio/story-player';
import { nextStory, replayPhrases } from '@/components/radio/radio-summary';
import { radioChoiceNumber, radioMinutes } from '@/lib/radio/format';

class FakeAudio {
  static all: FakeAudio[] = [];
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
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

const profile = { band: 'B1', en_ratio: 0.4, voice_id: 'en_gb_f1', source: 'override' } as const;
const HOME: RadioHome = {
  continue_listening: [
    { save_id: 'sv1', story_id: 'st1', title: '雨夜来客', status: 'active', current_node_id: 'n1', save_version: 3, updated_at: '2026-11-03T10:00:00Z', choices_made: 1 },
  ],
  stories: [
    { story_id: 'st1', slug: 's1', title: '雨夜来客', tags: [], base_cefr: 'B1', recommended: true },
    { story_id: 'st2', slug: 's2', title: '旧照片', tags: [], base_cefr: 'B1', recommended: true },
    { story_id: 'st3', slug: 's3', title: 'Hard', tags: [], base_cefr: 'C1', recommended: false },
  ],
  programs: [],
  profile,
  prefs: {},
  availability: { tts: true, asr: true, new_render: true },
  voices: ['en_gb_f1'],
  voice_samples: [],
};
const ok = { success: true, data: { accepted: 1, duplicates: 0, rejected: [] } };

let container: HTMLDivElement;
let root: Root;
const q = (id: string) => container.querySelector(`[data-testid="${id}"]`);
const qa = (id: string) => Array.from(container.querySelectorAll(`[data-testid="${id}"]`));
const click = async (el: Element | null) => {
  expect(el).not.toBeNull();
  await act(async () => (el as HTMLElement).click());
};
async function mount(el: React.ReactElement) {
  await act(async () => root.render(el));
  await act(async () => {});
  await act(async () => {});
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  FakeAudio.all = [];
  vi.stubGlobal('Audio', FakeAudio);
  Element.prototype.scrollIntoView = vi.fn();
  window.localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  [m.events, m.saves, m.replay, m.del, m.memory, m.home, m.save, m.turn, m.start, m.replace, m.push, m.toast, m.refresh].forEach((f) =>
    f.mockReset()
  );
  m.events.mockResolvedValue(ok);
  m.saves.mockResolvedValue({ success: true, data: { saves: [] } });
  m.refresh.mockResolvedValue(undefined);
  m.replay.mockResolvedValue({ success: false, status: 500 });
  m.homeState = HOME;
  EV.resetRadioEventsForTest();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('playback events', () => {
  it('only the keys listed for the kind go out; a client_event_id the server accepts', () => {
    EV.trackRadioEvent('speed_changed', { saveId: 'sv1' }, { from: 1, to: 0.75, said: 'slower please' } as never);
    const [ev] = EV.radioEventQueue();
    expect(ev.payload).toEqual({ from: 1, to: 0.75 });
    expect(ev.client_event_id).toMatch(/^[A-Za-z0-9_-]{8,40}$/);
    expect(ev.save_id).toBe('sv1');
    expect(ev.program_id).toBeNull();
  });

  it('batches of at most 50; 200 drops them, rejected ones included', async () => {
    for (let i = 0; i < 120; i += 1) EV.trackRadioEvent('node_finished', { saveId: 'sv1' }, { node_id: `n${i}` });
    m.events.mockResolvedValue({ success: true, data: { accepted: 49, duplicates: 0, rejected: [{ index: 0, reason: 'save_not_found' }] } });
    await EV.flushRadioEvents();
    expect(m.events.mock.calls.map((c) => c[0].length)).toEqual([50, 50, 20]);
    expect(EV.radioEventQueue()).toHaveLength(0);
  });

  it('422 drops the batch; 403 / 404 drop the whole queue', async () => {
    EV.trackRadioEvent('replay', { saveId: 'sv1' }, { node_id: 'n1', seq: 1 });
    m.events.mockResolvedValueOnce({ success: false, status: 422 });
    await EV.flushRadioEvents();
    expect(EV.radioEventQueue()).toHaveLength(0);
    for (let i = 0; i < 60; i += 1) EV.trackRadioEvent('replay', { saveId: 'sv1' }, { seq: i });
    m.events.mockResolvedValueOnce({ success: false, status: 404 });
    await EV.flushRadioEvents();
    expect(EV.radioEventQueue()).toHaveLength(0);
    expect(m.events).toHaveBeenCalledTimes(2);
  });

  it('401 keeps the queue until the user is signed in again', async () => {
    EV.trackRadioEvent('replay', { saveId: 'sv1' }, { seq: 1 });
    m.events.mockResolvedValueOnce({ success: false, status: 401 });
    await EV.flushRadioEvents();
    await EV.flushRadioEvents();
    expect(m.events).toHaveBeenCalledTimes(1);
    expect(EV.radioEventQueue()).toHaveLength(1);
    EV.resumeRadioEventsAfterSignIn();
    await act(async () => {});
    expect(m.events).toHaveBeenCalledTimes(2);
    expect(m.events.mock.calls[1][0][0].client_event_id).toBe(m.events.mock.calls[0][0][0].client_event_id);
  });

  it('503 or no network keeps the batch and sends it again later, with the same ids', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    EV.trackRadioEvent('replay', { saveId: 'sv1' }, { seq: 1 });
    m.events.mockResolvedValueOnce({ success: false, status: 503 }).mockResolvedValueOnce(ok);
    await EV.flushRadioEvents();
    expect(EV.radioEventQueue()).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(EV.EVENTS_RETRY_FIRST_MS + 100);
    });
    expect(m.events).toHaveBeenCalledTimes(2);
    expect(m.events.mock.calls[1][0][0].client_event_id).toBe(m.events.mock.calls[0][0][0].client_event_id);
    expect(EV.radioEventQueue()).toHaveLength(0);
  });

  it('player_left is sent at once and never kept for a retry', async () => {
    m.events.mockResolvedValue({ success: false, status: 503 });
    EV.sendPlayerLeft({ saveId: 'sv1' }, { node_id: 'n1', seq: 2, offset_ms: 800 });
    await act(async () => {});
    expect(m.events.mock.calls[0][0][0]).toMatchObject({ kind: 'player_left', payload: { node_id: 'n1', seq: 2, offset_ms: 800 } });
    expect(EV.radioEventQueue()).toHaveLength(0);
  });

  it('clearing radio memory drops every unsent event', () => {
    EV.trackRadioEvent('replay', { saveId: 'sv1' }, { seq: 1 });
    EV.dropRadioEvents();
    expect(EV.radioEventQueue()).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('replay', () => {
  const REPLAY = {
    save_id: 'sv1',
    title: '雨夜来客',
    status: 'active',
    steps: [
      { step: 1, node_id: 'n1', node_type: 'choice', undone: false,
        segments: [{ seq: 1, text: 'Knock knock.', audio_url: 'https://a/1.mp3' }, { seq: 2, text: '没有声音。', audio_url: null }],
        chosen: { choice_id: 'c_a', label: 'Open the door', via: 'voice' } },
      { step: 2, node_id: 'n2', node_type: 'narration', undone: true, segments: [{ seq: 1, text: 'Taken back.', audio_url: null }], chosen: null },
    ],
  };

  it('every step as heard: captions, a play button per voiced sentence, the choice and how, undone greyed', async () => {
    m.replay.mockResolvedValue({ success: true, data: REPLAY });
    await mount(<RadioReplayScreen locale="zh" saveId="sv1" />);
    expect(qa('radio-replay-step')).toHaveLength(2);
    expect(qa('radio-replay-play')).toHaveLength(1); // the sentence with no audio has no play button
    expect(q('radio-replay-chosen')?.textContent).toContain('label=Open the door');
    expect(q('radio-replay-chosen')?.textContent).toContain('radio.replay.viaVoice');
    expect(qa('radio-replay-step')[1].getAttribute('data-undone')).toBe('true');
    expect(q('radio-replay-undone')?.textContent).toBe('radio.replay.undone');
  });

  it('a play button plays that sentence and reports a replay event; nothing else is sent', async () => {
    m.replay.mockResolvedValue({ success: true, data: REPLAY });
    await mount(<RadioReplayScreen locale="zh" saveId="sv1" />);
    await click(q('radio-replay-play'));
    expect(FakeAudio.all[0].src).toBe('https://a/1.mp3');
    expect(EV.radioEventQueue()[0]).toMatchObject({ kind: 'replay', save_id: 'sv1', payload: { node_id: 'n1', seq: 1 } });
    expect(m.turn).not.toHaveBeenCalled(); // replay never changes the story
  });

  it('the replay events it queues are sent when the screen is left', async () => {
    m.replay.mockResolvedValue({ success: true, data: REPLAY });
    await mount(<RadioReplayScreen locale="zh" saveId="sv1" />);
    await click(q('radio-replay-play'));
    act(() => root.unmount());
    root = createRoot(container);
    await act(async () => {});
    expect(m.events.mock.calls.flatMap((c) => c[0]).some((e: { kind: string }) => e.kind === 'replay')).toBe(true);
  });

  it('409 save_not_found: content cannot be found; closed: Studio', async () => {
    m.replay.mockResolvedValue({ success: false, status: 409, errorCode: 'save_not_found' });
    await mount(<RadioReplayScreen locale="zh" saveId="gone" />);
    expect(q('radio-replay-missing')?.textContent).toContain('radio.contentMissing');
    act(() => root.unmount());
    root = createRoot(container);
    m.replay.mockResolvedValue({ success: false, status: 403, errorCode: 'radio_pro_required' });
    await mount(<RadioReplayScreen locale="zh" saveId="sv1" />);
    expect(m.replace).toHaveBeenCalledWith('/zh/clinic/hub');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the radio home: more menu, deleting, listened, greeting', () => {
  it('a continue card has More with Replay and Delete', async () => {
    await mount(<RadioHomeScreen locale="zh" />);
    await click(q('radio-save-more'));
    expect(q('radio-save-replay')?.getAttribute('href')).toBe('/zh/radio/replay/sv1');
    expect(q('radio-save-delete')).not.toBeNull();
  });

  it('delete asks first; Cancel changes nothing; confirming deletes and reads the home again', async () => {
    m.del.mockResolvedValue({ success: true });
    await mount(<RadioHomeScreen locale="zh" />);
    await click(q('radio-save-more'));
    await click(q('radio-save-delete'));
    expect(q('radio-delete-dialog')?.textContent).toContain('radio.home.deleteConfirm(title=雨夜来客)');
    await click(Array.from(q('radio-delete-dialog')!.querySelectorAll('button'))[0]);
    expect(m.del).not.toHaveBeenCalled();
    await click(q('radio-save-more'));
    await click(q('radio-save-delete'));
    await click(q('radio-delete-confirm'));
    expect(m.del).toHaveBeenCalledWith('sv1');
    expect(m.refresh).toHaveBeenCalled();
    expect(q('radio-delete-dialog')).toBeNull();
  });

  it('delete busy: the same delete is sent again after Retry-After', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    m.del.mockResolvedValueOnce({ success: false, status: 503, errorCode: 'busy', retryAfter: 1 }).mockResolvedValueOnce({ success: true });
    await mount(<RadioHomeScreen locale="zh" />);
    await click(q('radio-save-more'));
    await click(q('radio-save-delete'));
    await click(q('radio-delete-confirm'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(m.del).toHaveBeenCalledTimes(2);
    expect(m.refresh).toHaveBeenCalled();
  });

  it('Listened is collapsed; opened, it lists finished and replaced stories (replaced marked), never in progress', async () => {
    m.saves.mockResolvedValue({
      success: true,
      data: {
        saves: [
          { ...HOME.continue_listening[0] },
          { save_id: 'sv8', story_id: 'st8', title: 'Done', status: 'completed', current_node_id: 'e', save_version: 9, updated_at: 'x', choices_made: 1 },
          { save_id: 'sv9', story_id: 'st9', title: 'Replaced', status: 'overwritten', current_node_id: 'n', save_version: 2, updated_at: 'x', choices_made: 1 },
        ],
      },
    });
    await mount(<RadioHomeScreen locale="zh" />);
    expect(qa('radio-history-item')).toHaveLength(0);
    expect(m.saves).not.toHaveBeenCalled();
    await click(q('radio-history-toggle'));
    await act(async () => {});
    expect(qa('radio-history-item').map((x) => x.querySelector('h3')?.textContent)).toEqual(['Done', 'Replaced']);
    expect(qa('radio-history-overwritten')).toHaveLength(1);
    expect(container.querySelector('[data-testid="radio-home-history"] a[href^="/zh/radio/story/"]')).toBeNull();
  });

  it('the greeting shows once a day', async () => {
    await mount(<RadioHomeScreen locale="zh" />);
    expect(q('radio-greeting')?.textContent).toBe('radio.home.greeting');
    act(() => root.unmount());
    root = createRoot(container);
    await mount(<RadioHomeScreen locale="zh" />);
    expect(q('radio-greeting')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Me: clear personal radio data (D29)', () => {
  it.each([
    [{ success: true, data: HOME }, true],
    [{ success: false, status: 403, errorCode: 'radio_not_in_audience' }, true],
    [{ success: false, status: 403, errorCode: 'radio_pro_required' }, true],
    [{ success: false, status: 404, errorCode: 'REGION_ACCOUNT_NOT_FOUND' }, false],
    [{ success: false, errorCode: 'NETWORK_ERROR' }, false],
  ])('GET home %j ⇒ row shown %s', async (res, shown) => {
    m.home.mockResolvedValue(res);
    await mount(<ClearRadioDataRow authenticated />);
    expect(!!q('me-clear-radio-data')).toBe(shown);
  });

  it('confirmed: 204 ⇒ cleared toast, unsent events dropped; the row never opens the radio', async () => {
    m.home.mockResolvedValue({ success: false, status: 403, errorCode: 'radio_not_in_audience' });
    m.memory.mockResolvedValue({ success: true });
    EV.trackRadioEvent('replay', { saveId: 'sv1' }, { seq: 1 });
    await mount(<ClearRadioDataRow authenticated />);
    await click(q('me-clear-radio-data'));
    expect(q('me-clear-radio-dialog')?.textContent).toContain('radio.settings.clearMemoryConfirm');
    await click(q('me-clear-radio-confirm'));
    expect(m.toast).toHaveBeenCalledWith('radio.settings.cleared');
    expect(EV.radioEventQueue()).toHaveLength(0);
    expect(m.push).not.toHaveBeenCalled();
    expect(m.replace).not.toHaveBeenCalled();
  });

  it('404 after Me opened: the dialog closes and the row disappears, no toast; other failures: clearFailed', async () => {
    m.home.mockResolvedValue({ success: true, data: HOME });
    m.memory.mockResolvedValueOnce({ success: false, status: 404 });
    await mount(<ClearRadioDataRow authenticated />);
    await click(q('me-clear-radio-data'));
    await click(q('me-clear-radio-confirm'));
    expect(q('me-clear-radio-data')).toBeNull();
    expect(m.toast).not.toHaveBeenCalled();
    act(() => root.unmount());
    root = createRoot(container);
    m.memory.mockResolvedValueOnce({ success: false, errorCode: 'NETWORK_ERROR' });
    await mount(<ClearRadioDataRow authenticated />);
    await click(q('me-clear-radio-data'));
    await click(q('me-clear-radio-confirm'));
    expect(m.toast).toHaveBeenCalledWith('radio.settings.clearFailed');
  });

  it('signed out: nothing is read and no row', async () => {
    await mount(<ClearRadioDataRow authenticated={false} />);
    expect(m.home).not.toHaveBeenCalled();
    expect(q('me-clear-radio-data')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('phrases', () => {
  it('each phrase marked at its first appearance in a sentence; a longer phrase wins; case ignored', () => {
    const pieces = splitPhrases('Break a leg! Break a leg tonight.', [
      { term: 'break a leg' },
      { term: 'leg' },
      { term: 'tonight' },
    ]);
    expect(pieces.filter((p) => p.term).map((p) => p.text)).toEqual(['Break a leg', 'tonight']);
    expect(pieces.map((p) => p.text).join('')).toBe('Break a leg! Break a leg tonight.');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the story player: phrases, events, the ending summary', () => {
  const resp = (over: Partial<RadioPlayerResponse> & { nodeType?: 'choice' | 'narration' | 'ending'; nodeId?: string } = {}) => {
    const { nodeType = 'narration', nodeId = 'n1', ...rest } = over;
    return {
      save_id: 'sv1',
      save_version: 3,
      status: 'active',
      profile,
      ai_calls_used: 0,
      listen_window_ms: null,
      node: {
        node_id: nodeId,
        node_type: nodeType,
        render_id: `r_${nodeId}`,
        source: 'cache',
        segments: [
          { seq: 1, lang: 'en', text: 'Break a leg, she said.', audio_url: 'https://a/1.mp3', duration_ms: 1500, pending: false },
          { seq: 2, lang: 'zh', text: '祝你好运。', audio_url: 'https://a/2.mp3', duration_ms: 1000, pending: false },
        ],
        choices: [],
        glossary: [{ term: 'break a leg', gloss: '祝你好运', cefr: 'B2' }],
      },
      ...rest,
    } as RadioPlayerResponse;
  };

  it('a phrase opens its bubble: meaning and level; "explain this sentence" from it asks the question', async () => {
    m.save.mockResolvedValue({ success: true, data: resp() });
    m.turn.mockResolvedValue({ success: true, data: { ...resp(), node: null, answer: { segments: [{ seq: 1, text: '答' }] } } });
    await mount(<StoryPlayerScreen locale="zh" saveId="sv1" from="home" />);
    await click(q('radio-phrase'));
    expect(q('radio-phrase-bubble')?.textContent).toContain('祝你好运');
    expect(q('radio-phrase-bubble')?.textContent).toContain('B2');
    await click(q('radio-phrase-explain'));
    expect(m.turn.mock.calls[0][3]).toMatchObject({ kind: 'text', position: { seq: 1 } });
  });

  it('a part played to its end ⇒ node_finished; a speed change ⇒ speed_changed; leaving ⇒ player_left', async () => {
    m.save.mockResolvedValue({ success: true, data: resp() });
    m.turn.mockResolvedValue({ success: true, data: resp({ nodeId: 'n2', save_version: 4 }) });
    await mount(<StoryPlayerScreen locale="zh" saveId="sv1" from="home" />);
    await click(q('radio-speed'));
    expect(EV.radioEventQueue().find((e) => e.kind === 'speed_changed')?.payload).toEqual({ from: 1, to: 0.75 });
    await act(async () => FakeAudio.all[0].onended?.());
    FakeAudio.all[0].currentTime = 0.4;
    act(() => root.unmount());
    root = createRoot(container);
    await act(async () => {});
    const left = m.events.mock.calls.flatMap((c) => c[0]).find((e: { kind: string }) => e.kind === 'player_left');
    expect(left).toMatchObject({ save_id: 'sv1', payload: { node_id: 'n1', seq: 2, offset_ms: 400 } });
  });

  it('closing the tab (pagehide) sends player_left once, and leaving afterwards does not send it again', async () => {
    m.save.mockResolvedValue({ success: true, data: resp() });
    await mount(<StoryPlayerScreen locale="zh" saveId="sv1" from="home" />);
    await act(async () => window.dispatchEvent(new Event('pagehide')));
    // Sent at pagehide itself: closing a tab never unmounts the player.
    expect(m.events.mock.calls.flatMap((c) => c[0]).filter((e: { kind: string }) => e.kind === 'player_left')).toHaveLength(1);
    act(() => root.unmount());
    root = createRoot(container);
    await act(async () => {});
    const left = m.events.mock.calls.flatMap((c) => c[0]).filter((e: { kind: string }) => e.kind === 'player_left');
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({ save_id: 'sv1', payload: { node_id: 'n1', seq: 1 } });
  });

  it('the ending: the summary card with the phrases heard, a next story at the same level not heard, and summary_shown', async () => {
    m.saves.mockResolvedValue({ success: true, data: { saves: [{ ...HOME.continue_listening[0] }] } });
    m.save.mockResolvedValue({ success: true, data: resp({ nodeType: 'ending', nodeId: 'end' }) });
    m.start.mockResolvedValue({ success: true, data: { save_id: 'sv5', save_version: 1, profile, ai_calls_used: 0 } });
    await mount(<StoryPlayerScreen locale="zh" saveId="sv1" from="home" />);
    expect(q('radio-summary-phrases')?.textContent).toContain('break a leg');
    expect(q('radio-summary-replay')?.getAttribute('href')).toBe('/zh/radio/replay/sv1');
    await click(q('radio-summary-next'));
    expect(m.start.mock.calls[0][0]).toBe('st2'); // B1, not heard (st1 is the one just played; st3 is C1)
    expect(m.push).toHaveBeenCalledWith('/zh/radio/story/sv5');
    expect(EV.radioEventQueue().concat(m.events.mock.calls.flatMap((c) => c[0])).find((e) => e.kind === 'radio_summary_shown')?.payload)
      .toEqual({ glossary_count: 1, recommended_story_id: 'st2' });
    expect(container.textContent).not.toMatch(/%|score|quiz/i);
  });

  it('nextStory: same level, not heard; none ⇒ no next', () => {
    expect(nextStory(HOME, new Set(['st1']))?.story_id).toBe('st2');
    expect(nextStory(HOME, new Set(['st1', 'st2']))).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the fields the screens were missing (personal-radio.md 0.13 / 0.14)', () => {
  it('"Choice n" is the choice the listener is heading to; lengths round up to whole minutes, at least 1', () => {
    expect(radioChoiceNumber(0)).toBe(1);
    expect(radioChoiceNumber(2)).toBe(3);
    expect(radioMinutes(61_000)).toBe(2);
    expect(radioMinutes(60_000)).toBe(1);
    expect(radioMinutes(5_000)).toBe(1);
  });

  it('the continue card shows its progress; a program row shows length and level only when it has them', async () => {
    m.homeState = {
      ...HOME,
      continue_listening: [{ ...HOME.continue_listening[0], choices_made: 2 }],
      programs: [
        { program_id: 'p1', kind: 'column', title: 'With a version', band: 'B2', duration_ms: 125_000 },
        { program_id: 'p2', kind: 'column', title: 'No version here', band: null, duration_ms: null },
      ],
    };
    m.home.mockResolvedValue({ success: true, data: m.homeState });
    await mount(<RadioHomeScreen locale="zh" />);
    expect(q('radio-continue-progress')?.textContent).toBe('radio.studio.progress(n=3)');
    const rows = qa('radio-program');
    expect(rows).toHaveLength(2); // a program with no version is still listed
    expect(rows[0].querySelector('[data-testid="radio-program-meta"]')?.textContent).toBe('radio.home.minutes(n=3)B2');
    expect(rows[1].querySelector('[data-testid="radio-program-meta"]')).toBeNull();
  });

  it('replay: the letter heard; no letter ⇒ the label alone', async () => {
    m.replay.mockResolvedValue({
      success: true,
      data: {
        save_id: 'sv1', title: 't', status: 'active',
        steps: [
          { step: 1, node_id: 'n1', node_type: 'choice', undone: false, segments: [], chosen: { choice_id: 'c2', key: 'B', label: 'Call the desk', via: 'tap' } },
          { step: 2, node_id: 'n2', node_type: 'choice', undone: false, segments: [], chosen: { choice_id: 'c1', key: null, label: 'Wait', via: 'voice' } },
        ],
      },
    });
    await mount(<RadioReplayScreen locale="zh" saveId="sv1" />);
    const chosen = qa('radio-replay-chosen');
    expect(chosen[0].textContent).toContain('radio.replay.youChose(key=B,label=Call the desk)');
    expect(chosen[1].textContent).toContain('radio.replay.youChose(key=,label=Wait)');
  });

  it("replayPhrases: every step's phrases in the order heard, the first of each term kept", () => {
    const g = (term: string) => ({ term, gloss: term.toUpperCase() });
    expect(
      replayPhrases({
        save_id: 's', status: 'completed',
        steps: [
          { step: 1, node_id: 'a', segments: [], undone: false, glossary: [g('knock'), g('lobby')] },
          { step: 2, node_id: 'b', segments: [], undone: false },
          { step: 3, node_id: 'c', segments: [], undone: false, glossary: [g('Lobby'), g('the real thief')] },
        ],
      }).map((x) => x.term)
    ).toEqual(['knock', 'lobby', 'the real thief']);
    expect(replayPhrases(null)).toEqual([]);
  });

  const ending = (title: string | null) =>
    ({
      save_id: 'sv1', save_version: 9, status: 'completed', profile, ai_calls_used: 0, listen_window_ms: null,
      node: {
        node_id: 'e1', node_type: 'ending', render_id: 'r_e1', source: 'cache',
        segments: [{ seq: 1, lang: 'en', text: 'The end.', audio_url: 'https://a/e.mp3', duration_ms: 900, pending: false }],
        choices: [], glossary: [{ term: 'the end', gloss: '结束' }],
        ending: { ending_key: 'ending_proof', title },
      },
    }) as RadioPlayerResponse;

  it("the ending summary: the ending's name; the whole story's phrases from the replay; no questions part", async () => {
    m.save.mockResolvedValue({ success: true, data: ending('真相大白') });
    m.replay.mockResolvedValue({
      success: true,
      data: { save_id: 'sv1', status: 'completed', steps: [
        { step: 1, node_id: 'n1', segments: [], undone: false, glossary: [{ term: 'heard before resuming', gloss: '早先' }] },
        { step: 2, node_id: 'e1', segments: [], undone: false, glossary: [{ term: 'the end', gloss: '结束' }] },
      ] },
    });
    await mount(<StoryPlayerScreen locale="zh" saveId="sv1" from="home" />);
    expect(q('radio-summary-ending')?.textContent).toBe('radio.summary.ending(name=真相大白)');
    expect(q('radio-summary-phrases')?.textContent).toContain('heard before resuming');
    expect(container.textContent).not.toContain('radio.summary.asked');
    expect(EV.radioEventQueue().concat(m.events.mock.calls.flatMap((c) => c[0])).find((e) => e.kind === 'radio_summary_shown')?.payload)
      .toMatchObject({ glossary_count: 2 });
  });

  it('no name ⇒ no ending line; the replay cannot be read ⇒ the phrases heard on this visit', async () => {
    m.save.mockResolvedValue({ success: true, data: ending(null) });
    await mount(<StoryPlayerScreen locale="zh" saveId="sv1" from="home" />);
    expect(q('radio-summary-ending')).toBeNull();
    expect(q('radio-summary-phrases')?.textContent).toContain('the end');
  });
});
