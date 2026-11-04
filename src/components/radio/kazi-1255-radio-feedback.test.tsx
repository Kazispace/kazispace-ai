/**
 * @vitest-environment jsdom
 *
 * KAZI-1255 — listener feedback: thumbs-up / thumbs-down on a whole story or program with optional reason
 * chips, and `player_left.listened_ms` (kazispace-ui personal-radio.md 0.15: Rating · Playback events).
 *
 * (The setup below is the one the KAZI-1209 part 5 tests use.)
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
  rate: vi.fn(),
  program: vi.fn(),
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
  getRadioProgram: m.program,
}));
vi.mock('@/lib/radio/player-api', () => ({
  postRadioEvents: m.events,
  getRadioSaves: m.saves,
  getRadioReplay: m.replay,
  deleteRadioSave: m.del,
  deleteRadioMemory: m.memory,
  getRadioBgm: vi.fn(async () => ({ success: true, data: { tracks: [] } })),
  postRadioTurnAudio: vi.fn(),
  putRadioRating: m.rate,
  askRadioProgram: vi.fn(),
  askRadioProgramAudio: vi.fn(),
}));

import * as EV from '@/lib/radio/events';
import { RadioReplayScreen } from '@/components/radio/radio-replay';
import { StoryPlayerScreen } from '@/components/radio/story-player';
import { ProgramPlayerScreen } from '@/components/radio/program-player';
import { RadioRating } from '@/components/radio/radio-rating';
import { useSentencePlayer } from '@/hooks/use-sentence-player';

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
  [m.events, m.saves, m.replay, m.del, m.memory, m.home, m.save, m.turn, m.start, m.replace, m.push, m.toast, m.refresh, m.rate, m.program].forEach((f) =>
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
const saved = (rating: 'up' | 'down' | null, reasons: string[] = []) => ({
  success: true,
  data: { target_kind: 'story', target_id: 'st1', rating, reasons },
});
const pressed = (id: string) => q(id)?.getAttribute('aria-pressed');
const chip = (r: string) => container.querySelector(`[data-reason="${r}"]`);

describe('the rating control', () => {
  it('starts from my_rating; a tap saves at once; tapping the selected one takes it back', async () => {
    m.rate.mockImplementation(async (_k: string, _id: string, rating: 'up' | 'down' | null, reasons: string[]) => saved(rating, reasons));
    await mount(<RadioRating kind="story" targetId="st1" initial={{ rating: 'up', reasons: [] }} />);
    expect(pressed('radio-rating-up')).toBe('true');
    expect(q('radio-rating-prompt')?.textContent).toBe('radio.rating.question');
    await click(q('radio-rating-up'));
    expect(m.rate).toHaveBeenLastCalledWith('story', 'st1', null, []);
    expect(pressed('radio-rating-up')).toBe('false');
    await click(q('radio-rating-up'));
    expect(m.rate).toHaveBeenLastCalledWith('story', 'st1', 'up', []);
    expect(q('radio-rating-prompt')?.textContent).toBe('radio.rating.thanks');
    expect(q('radio-rating-reasons')).toBeNull(); // chips only after a thumbs-down
  });

  it('a thumbs-down opens optional chips; each chip saves the whole state in the fixed order; up clears them', async () => {
    m.rate.mockImplementation(async (_k: string, _id: string, rating: 'up' | 'down' | null, reasons: string[]) => saved(rating, reasons));
    await mount(<RadioRating kind="program" targetId="pg1" initial={null} />);
    await click(q('radio-rating-down'));
    expect(m.rate).toHaveBeenLastCalledWith('program', 'pg1', 'down', []);
    expect(Array.from(container.querySelectorAll('[data-reason]')).map((b) => b.getAttribute('data-reason'))).toEqual([
      'too_hard', 'too_easy', 'boring', 'voice', 'en_ratio',
    ]);
    await click(chip('voice'));
    await click(chip('too_hard'));
    expect(m.rate).toHaveBeenLastCalledWith('program', 'pg1', 'down', ['too_hard', 'voice']);
    await click(chip('voice'));
    expect(m.rate).toHaveBeenLastCalledWith('program', 'pg1', 'down', ['too_hard']);
    await click(q('radio-rating-up'));
    expect(m.rate).toHaveBeenLastCalledWith('program', 'pg1', 'up', []);
    expect(q('radio-rating-reasons')).toBeNull();
  });

  it('a failed save puts the control back to what was saved and says so', async () => {
    m.rate.mockResolvedValue({ success: false, status: 503 });
    await mount(<RadioRating kind="story" targetId="st1" initial={{ rating: 'down', reasons: ['boring'] }} />);
    expect(chip('boring')?.getAttribute('aria-pressed')).toBe('true');
    await click(q('radio-rating-up'));
    expect(pressed('radio-rating-down')).toBe('true');
    expect(chip('boring')?.getAttribute('aria-pressed')).toBe('true');
    expect(q('radio-rating-prompt')?.textContent).toBe('radio.rating.question');
    expect(m.toast).toHaveBeenCalledWith('radio.rating.failed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('where the rating appears', () => {
  const ending = {
    save_id: 'sv1', save_version: 9, status: 'completed', profile, ai_calls_used: 0, listen_window_ms: null,
    node: {
      node_id: 'e1', node_type: 'ending', render_id: 'r_e1', source: 'cache',
      segments: [{ seq: 1, lang: 'en', text: 'The end.', audio_url: 'https://a/e.mp3', duration_ms: 900, pending: false }],
      choices: [], glossary: [], ending: { ending_key: 'ending_proof', title: null },
    },
  } as unknown as RadioPlayerResponse;
  const REPLAY = (my: unknown) => ({
    success: true,
    data: { save_id: 'sv1', story_id: 'st1', status: 'completed', my_rating: my,
      steps: [{ step: 1, node_id: 'n1', node_type: 'narration', undone: false, segments: [], glossary: [] }] },
  });

  it('the ending summary: the story rating, starting from the replay\'s my_rating', async () => {
    m.save.mockResolvedValue({ success: true, data: ending });
    m.replay.mockResolvedValue(REPLAY({ rating: 'down', reasons: ['too_hard'] }));
    await mount(<StoryPlayerScreen locale="zh" saveId="sv1" from="home" />);
    const rating = q('radio-ending')?.querySelector('[data-testid="radio-rating"]');
    expect(rating?.getAttribute('data-kind')).toBe('story');
    expect(pressed('radio-rating-down')).toBe('true');
    expect(chip('too_hard')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('the replay: the story rating at the end of the list', async () => {
    m.replay.mockResolvedValue(REPLAY(null));
    await mount(<RadioReplayScreen locale="zh" saveId="sv1" />);
    expect(q('radio-rating')?.getAttribute('data-kind')).toBe('story');
    expect(q('radio-replay')?.nextElementSibling?.getAttribute('data-testid')).toBe('radio-rating');
    m.rate.mockResolvedValue(saved('up'));
    await click(q('radio-rating-up'));
    expect(m.rate).toHaveBeenCalledWith('story', 'st1', 'up', []);
  });

  it('a program: the rating appears once it plays to its end, and stays', async () => {
    m.program.mockResolvedValue({
      success: true,
      data: { program_id: 'sotd_20261103', kind: 'column', title: 't', band: 'B1', voice_id: 'en_gb_f1', duration_ms: 3000,
        segments: [{ seq: 1, lang: 'en', text: 'Welcome.', audio_url: 'https://a/1.mp3', start_ms: 0, end_ms: 3000 }],
        my_rating: { rating: 'up', reasons: [] } },
    });
    await mount(<ProgramPlayerScreen locale="zh" programId="sotd_20261103" />);
    expect(q('radio-rating')).toBeNull();
    await act(async () => FakeAudio.all.at(-1)!.onended?.());
    expect(q('radio-rating')?.getAttribute('data-kind')).toBe('program');
    expect(pressed('radio-rating-up')).toBe('true');
    await click(q('radio-play-pause'));  // playing it again does not hide the rating
    expect(q('radio-rating')).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
type TimedAudio = FakeAudio & { ontimeupdate: (() => void) | null };

describe('listened_ms', () => {
  function Probe({ onPlayed }: { onPlayed: (ms: number) => void }) {
    const p = useSentencePlayer({
      sentences: [{ seq: 1, text: 'Hello.', audioUrl: 'https://a/1.mp3' }, { seq: 2, text: '没有声音的一句。', audioUrl: null }],
      speed: 1,
      autoplay: true,
      onPlayed,
    });
    return <span data-testid="probe">{p.index}</span>;
  }

  it('the sentence player reports audio that actually played: forward progress only, no jumps', async () => {
    const played: number[] = [];
    await mount(<Probe onPlayed={(ms) => played.push(ms)} />);
    const a = FakeAudio.all.at(-1) as TimedAudio;
    const tick = async (t: number) => {
      a.currentTime = t;
      await act(async () => a.ontimeupdate?.());
    };
    await tick(0.25);
    await tick(0.5);
    await tick(0.3); // seeking back adds nothing
    await tick(5.0); // a jump adds nothing
    await tick(5.25);
    expect(played.reduce((x, y) => x + y, 0)).toBeCloseTo(750, 0);
  });

  it('player_left carries listened_ms for a story', async () => {
    m.save.mockResolvedValue({ success: true, data: { ...ending1(), save_id: 'sv1' } });
    await mount(<StoryPlayerScreen locale="zh" saveId="sv1" from="home" />);
    const a = FakeAudio.all.at(-1) as TimedAudio;
    for (const t of [0.4, 0.8, 1.2]) {
      a.currentTime = t;
      await act(async () => a.ontimeupdate?.());
    }
    act(() => root.unmount());
    root = createRoot(container);
    await act(async () => {});
    const left = m.events.mock.calls.flatMap((c) => c[0]).find((e: { kind: string }) => e.kind === 'player_left');
    expect(left?.payload.listened_ms).toBe(1200);
  });

  it('the events queue lets listened_ms through for player_left', () => {
    const ev = EV.makeRadioEvent('player_left', { saveId: 'sv1' }, { listened_ms: 5000, story_id: 'forged' } as never);
    expect(ev.payload).toEqual({ listened_ms: 5000 }); // story_id is the server's to set
  });
});

function ending1() {
  return {
    save_version: 3, status: 'active', profile, ai_calls_used: 0, listen_window_ms: null,
    node: {
      node_id: 'n1', node_type: 'narration', render_id: 'r_n1', source: 'cache',
      segments: [{ seq: 1, lang: 'en', text: 'Hello there.', audio_url: 'https://a/1.mp3', duration_ms: 1500, pending: false }],
      choices: [], glossary: [],
    },
  } as unknown as RadioPlayerResponse;
}
