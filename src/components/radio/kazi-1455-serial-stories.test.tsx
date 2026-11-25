/**
 * @vitest-environment jsdom
 *
 * KAZI-1455 — serial stories (kazispace-ui personal-radio.md, Serial stories): the section on the radio home,
 * a story line's page, and an episode in the player (carry on after the last line heard, progress, the three
 * commentary modes, skipping a commentary line, questions by sentence number, the next episode).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RadioEpisode, RadioStoryline } from '@/types/radio';

const m = vi.hoisted(() => ({
  home: vi.fn(),
  line: vi.fn(),
  episode: vi.fn(),
  progress: vi.fn(),
  ask: vi.fn(),
  askAudio: vi.fn(),
  track: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
  toast: vi.fn(),
  prefs: vi.fn(),
}));

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${ns}.${key}:${JSON.stringify(vars)}` : `${ns}.${key}`,
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
vi.mock('@/hooks/use-radio-mic', () => ({
  useRadioMic: () => ({ state: 'idle', level: 0, open: async () => 'ok', record: () => undefined, done: () => undefined, cancel: () => undefined }),
}));
vi.mock('@/hooks/use-radio-events', () => ({ useRadioEvents: () => undefined }));
vi.mock('@/lib/radio/events', () => ({ trackRadioEvent: m.track, sendPlayerLeft: vi.fn() }));
vi.mock('@/lib/radio/live-api', async (orig) => ({
  ...(await orig<typeof import('@/lib/radio/live-api')>()),
  getLiveHome: () => Promise.resolve({ success: false, status: 404, error: 'Not Found' }),
}));
vi.mock('@/lib/radio/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/radio/api')>()),
  getRadioHome: m.home,
  getRadioFacets: () => Promise.resolve({ success: false, status: 503, error: 'x' }),
  getRadioProgram: vi.fn(),
  patchRadioPrefs: m.prefs,
}));
vi.mock('@/lib/radio/serial-api', async (orig) => ({
  ...(await orig<typeof import('@/lib/radio/serial-api')>()),
  getRadioStoryline: m.line,
  getRadioEpisode: m.episode,
  putRadioProgress: m.progress,
  askRadioEpisode: m.ask,
  askRadioEpisodeAudio: m.askAudio,
}));

import { ProgramPlayerScreen } from '@/components/radio/program-player';
import { RadioHomeScreen } from '@/components/radio/radio-home';
import { SerialStorylineScreen } from '@/components/radio/serial-storyline';

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

const SUMMARY = { storyline_id: 'dee', title: 'Judge Dee', synopsis: 'A magistrate and three cases', tags: ['mystery'], episodes: 2, seasons: [1] };
const PROGRESS = { program_id: 'dee_s01e02', season: 1, episode: 2, seq: 3, mode: 'balanced', band: 'B1', updated_at: '2026-11-20T10:00:00Z' } as const;
const HOME = {
  continue_listening: [],
  stories: [],
  programs: [],
  profile: { band: 'B1', en_ratio: 0.4, voice_id: 'en_gb_f1', source: 'override' },
  prefs: { band_override: 'B1', bgm_on: false },
  availability: { tts: true, asr: true, new_render: true },
  voices: ['en_gb_f1'],
  voice_samples: [],
};
const LINE: RadioStoryline = {
  ...SUMMARY,
  progress: null,
  episode_list: [
    { program_id: 'dee_s01e01', season: 1, episode: 1, title: 'The Bell', band: 'B1', duration_ms: 600000 },
    { program_id: 'dee_s01e02', season: 1, episode: 2, title: 'The Pond', band: 'B1', duration_ms: 660000 },
  ],
};
/** seq is the line's place in the whole episode: a mode leaves lines out, it never renumbers them. */
const episode = (over: Partial<RadioEpisode> = {}): RadioEpisode => ({
  storyline_id: 'dee',
  program_id: 'dee_s01e01',
  season: 1,
  episode: 1,
  title: 'The Bell',
  band: 'B1',
  voice_id: 'en_gb_f1',
  mode: 'balanced',
  recap: false,
  resume_seq: 0,
  sentences: 5,
  segments: [
    { seq: 1, role: 'story', lang: 'en', text: 'The judge arrived.', audio_url: 'https://e/1.mp3', duration_ms: 2000 },
    { seq: 2, role: 'commentary', bp: 'vocab', lang: 'zh', text: '“magistrate” 是县令。', audio_url: 'https://e/2.mp3', duration_ms: 2000 },
    { seq: 3, role: 'commentary', bp: 'culture', lang: 'zh', text: '唐代的县衙。', audio_url: 'https://e/3.mp3', duration_ms: 2000 },
    { seq: 4, role: 'story', lang: 'en', text: 'He opened the file.', audio_url: 'https://e/4.mp3', duration_ms: 2000 },
    { seq: 5, role: 'story', lang: 'en', text: 'The bell rang.', audio_url: 'https://e/5.mp3', duration_ms: 2000 },
  ],
  next_program_id: 'dee_s01e02',
  ...over,
});
const ok = <T,>(data: T) => ({ success: true, data });

let container: HTMLDivElement;
let root: Root;
const q = (id: string) => container.querySelector(`[data-testid="${id}"]`);
const qa = (id: string) => Array.from(container.querySelectorAll(`[data-testid="${id}"]`));
/** Drag the speed slider to `v` and let go. */
const drag = async (el: Element | null, v: number) => {
  const input = el as HTMLInputElement;
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    set.call(input, String(v));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => {
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  });
};
const click = async (el: Element | null) => {
  expect(el).not.toBeNull();
  await act(async () => (el as HTMLElement).click());
};
async function mount(el: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(<QueryClientProvider client={client}>{el}</QueryClientProvider>);
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}
const player = () => mount(<ProgramPlayerScreen locale="zh" programId="dee_s01e01" serial={{ storylineId: 'dee' }} />);
const audio = () => FakeAudio.all[0];
/** The sentence playing ends: the player moves on. */
const endSentence = async () => {
  await act(async () => audio().onended?.());
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
  m.home.mockResolvedValue(ok(HOME));
  m.progress.mockResolvedValue(ok({ storyline_id: 'dee', applied: true, progress: null }));
  m.prefs.mockResolvedValue({ success: false, status: 503, error: 'x' });
});
afterEach(() => {
  window.localStorage.removeItem('kazi.radio.defaultSpeed');
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('serial stories on the radio home', () => {
  it('no section while the server lists none (storylines null or absent)', async () => {
    await mount(<RadioHomeScreen locale="zh" />);
    expect(q('radio-home-serial')).toBeNull();
    act(() => root.unmount());
    root = createRoot(container);
    m.home.mockResolvedValue(ok({ ...HOME, storylines: null, continue_storylines: null }));
    await mount(<RadioHomeScreen locale="zh" />);
    expect(q('radio-home-programs')).not.toBeNull();
    expect(q('radio-home-serial')).toBeNull();
  });

  it('lists each story line once, started ones first with "continue" to the episode they were in', async () => {
    const other = { ...SUMMARY, storyline_id: 'other', title: 'Another', progress: null };
    m.home.mockResolvedValue(
      ok({ ...HOME, storylines: [other, { ...SUMMARY, progress: PROGRESS }], continue_storylines: [{ ...SUMMARY, progress: PROGRESS }] })
    );
    await mount(<RadioHomeScreen locale="zh" />);
    const cards = qa('radio-storyline');
    expect(cards.map((c) => c.querySelector('h3')?.textContent)).toEqual(['Judge Dee', 'Another']);
    expect(cards[0].querySelector('a')?.getAttribute('href')).toBe('/zh/radio/serial/dee');
    expect(qa('radio-storyline-continue').map((a) => a.getAttribute('href'))).toEqual(['/zh/radio/serial/dee/dee_s01e02']);
  });

  it('an empty list still shows the section, saying there are none yet', async () => {
    m.home.mockResolvedValue(ok({ ...HOME, storylines: [], continue_storylines: [] }));
    await mount(<RadioHomeScreen locale="zh" />);
    expect(q('radio-home-serial')?.textContent).toContain('radio.serial.empty');
  });
});

describe('a story line page', () => {
  it('not started: "start" opens the first episode; every episode is listed in order', async () => {
    m.line.mockResolvedValue(ok(LINE));
    await mount(<SerialStorylineScreen locale="zh" storylineId="dee" />);
    expect(m.line).toHaveBeenCalledWith('dee');
    expect(q('radio-title')?.textContent).toBe('Judge Dee');
    expect(q('radio-storyline-start')?.getAttribute('href')).toBe('/zh/radio/serial/dee/dee_s01e01');
    expect(qa('radio-episode').map((a) => a.getAttribute('href'))).toEqual([
      '/zh/radio/serial/dee/dee_s01e01',
      '/zh/radio/serial/dee/dee_s01e02',
    ]);
  });

  it('started: "continue" opens the episode the listener is in, which is marked', async () => {
    m.line.mockResolvedValue(ok({ ...LINE, progress: PROGRESS }));
    await mount(<SerialStorylineScreen locale="zh" storylineId="dee" />);
    expect(q('radio-storyline-start')).toBeNull();
    expect(q('radio-storyline-continue')?.getAttribute('href')).toBe('/zh/radio/serial/dee/dee_s01e02');
    expect(qa('radio-episode').map((a) => a.getAttribute('aria-current'))).toEqual([null, 'true']);
  });

  it('progress on an episode no longer listed: the story line starts again from its first episode', async () => {
    m.line.mockResolvedValue(ok({ ...LINE, progress: { ...PROGRESS, program_id: 'gone' } }));
    await mount(<SerialStorylineScreen locale="zh" storylineId="dee" />);
    expect(q('radio-storyline-continue')).toBeNull();
    expect(q('radio-storyline-start')).not.toBeNull();
  });

  it('a story line that is not there: a message, not the "radio is off" redirect', async () => {
    m.line.mockResolvedValue({ success: false, status: 404, errorCode: 'serial_not_found', error: 'x' });
    await mount(<SerialStorylineScreen locale="zh" storylineId="nope" />);
    expect(q('radio-storyline-missing')?.textContent).toContain('radio.serial.missing');
    expect(m.replace).not.toHaveBeenCalled();
  });

  it('serial stories switched off (404 with no code): leaves the radio', async () => {
    m.line.mockResolvedValue({ success: false, status: 404, error: 'Not Found' });
    await mount(<SerialStorylineScreen locale="zh" storylineId="dee" />);
    expect(m.replace).toHaveBeenCalledTimes(1);
  });
});

describe('an episode in the player', () => {
  it('reads the episode in the server\'s mode and starts from the top; commentary is set apart', async () => {
    m.episode.mockResolvedValue(ok(episode()));
    await player();
    expect(m.episode).toHaveBeenCalledWith('dee', 'dee_s01e01', null);
    expect(audio().src).toBe('https://e/1.mp3');
    expect(qa('radio-sentence').map((li) => li.getAttribute('data-tone'))).toEqual([null, 'commentary', 'commentary', null, null]);
    expect(q('radio-serial-mode-balanced')?.getAttribute('aria-checked')).toBe('true');
    expect(q('radio-skip-commentary')).toBeNull(); // a story sentence is playing
  });

  it('starts at the saved speed; with none saved, at the position for the listener\'s level', async () => {
    m.episode.mockResolvedValue(ok(episode()));
    window.localStorage.setItem('kazi.radio.defaultSpeed', '0.75');
    await player();
    expect(q('radio-speed-label')?.textContent).toContain('0.75×');
    expect(audio().playbackRate).toBe(0.75);
    window.localStorage.removeItem('kazi.radio.defaultSpeed');
    act(() => root.unmount());
    root = createRoot(container);
    FakeAudio.all = [];
    await player();
    expect(q('radio-speed-label')?.textContent).toContain('0.8×'); // HOME.profile.band is B1
    expect(audio().playbackRate).toBe(0.8);
  });

  it('a save that succeeds leaves no copy on the device (so clearing memory, or another account, starts from the level)', async () => {
    m.episode.mockResolvedValue(ok(episode()));
    m.prefs.mockResolvedValue(ok({ prefs: { ...HOME.prefs, speed: 0.6 }, profile: HOME.profile }));
    await player();
    await click(q('radio-play-pause'));
    await drag(q('radio-speed'), 0.6);
    await act(async () => {
      await Promise.resolve();
    });
    expect(m.prefs.mock.calls).toEqual([[{ speed: 0.6 }]]);
    expect(window.localStorage.getItem('kazi.radio.defaultSpeed')).toBeNull();
  });

  it('let go where the drag started ⇒ nothing is sent or reported', async () => {
    m.episode.mockResolvedValue(ok(episode()));
    await player();
    await click(q('radio-play-pause'));
    await drag(q('radio-speed'), 0.8);
    expect(m.prefs).not.toHaveBeenCalled();
    expect(m.track.mock.calls.filter((c) => c[0] === 'speed_changed')).toEqual([]);
  });

  it('once the listener has moved the slider, a home answer arriving later does not move it back', async () => {
    m.episode.mockResolvedValue(ok(episode()));
    let answer: (v: unknown) => void = () => undefined;
    m.home.mockReturnValue(new Promise((r) => (answer = r)));
    await player();
    await click(q('radio-play-pause'));
    await drag(q('radio-speed'), 0.6);
    await act(async () => {
      answer(ok({ ...HOME, prefs: { ...HOME.prefs, speed: 1.1 } }));
      await new Promise((r) => setTimeout(r, 0));
    });
    expect((q('radio-speed') as HTMLInputElement).value).toBe('0.6');
  });

  it('the position saved on the account wins over the copy on this device and over the level', async () => {
    m.episode.mockResolvedValue(ok(episode()));
    m.home.mockResolvedValue(ok({ ...HOME, prefs: { ...HOME.prefs, speed: 0.95 } }));
    window.localStorage.setItem('kazi.radio.defaultSpeed', '0.6');
    await player();
    expect(q('radio-speed-label')?.textContent).toContain('0.95×');
    expect(audio().playbackRate).toBe(0.95);
    expect(m.prefs).not.toHaveBeenCalled(); // starting at a position saves nothing
  });

  it('the slider marks the position for the listener\'s level; the mark stays put and says which side the thumb is on', async () => {
    m.episode.mockResolvedValue(ok(episode()));
    await player();
    const mark = () => q('radio-speed-level') as HTMLElement;
    expect(mark().getAttribute('data-level')).toBe('0.8'); // HOME.profile.band is B1
    expect(mark().textContent).toContain('0.8×');
    expect(mark().getAttribute('data-side')).toBe('at');
    const left = mark().style.left;
    await click(q('radio-play-pause'));
    await drag(q('radio-speed'), 0.6);
    expect(mark().getAttribute('data-side')).toBe('below');
    await drag(q('radio-speed'), 1.1);
    expect(mark().getAttribute('data-side')).toBe('above');
    expect(mark().getAttribute('data-level')).toBe('0.8');
    expect(mark().style.left).toBe(left);
  });

  it('the speed slider: locked while a sentence plays; paused, a drag is saved and reported once', async () => {
    m.episode.mockResolvedValue(ok(episode()));
    await player();
    const slider = () => q('radio-speed') as HTMLInputElement;
    expect(slider().disabled).toBe(true);
    expect(q('radio-speed-hint')).not.toBeNull();
    await click(q('radio-play-pause'));
    expect(slider().disabled).toBe(false);
    expect(q('radio-speed-hint')).toBeNull();
    await drag(slider(), 0.6);
    expect(m.prefs.mock.calls).toEqual([[{ speed: 0.6 }]]); // sent to the account, once, when the listener lets go
    expect(window.localStorage.getItem('kazi.radio.defaultSpeed')).toBe('0.6'); // the send failed: the copy holds it
    expect(m.track.mock.calls.filter((c) => c[0] === 'speed_changed').map((c) => c[2])).toEqual([{ from: 0.8, to: 0.6 }]);
    await click(q('radio-play-pause'));
    expect(audio().playbackRate).toBe(0.6);
  });

  it('carries on after the last line heard', async () => {
    m.episode.mockResolvedValue(ok(episode({ resume_seq: 3 })));
    await player();
    expect(audio().src).toBe('https://e/4.mp3');
  });

  it('a finished episode (nothing after the last line heard) starts from the top', async () => {
    m.episode.mockResolvedValue(ok(episode({ resume_seq: 5 })));
    await player();
    expect(audio().src).toBe('https://e/1.mp3');
  });

  it('skip on a commentary line: on to the next story sentence, with the event', async () => {
    m.episode.mockResolvedValue(ok(episode()));
    await player();
    await endSentence(); // now on seq 2, commentary
    expect(audio().src).toBe('https://e/2.mp3');
    await click(q('radio-skip-commentary'));
    expect(audio().src).toBe('https://e/4.mp3');
    expect(m.track).toHaveBeenCalledWith('commentary_skipped', { programId: 'dee_s01e01' }, { seq: 2, bp: 'vocab', mode: 'balanced' });
    expect(q('radio-skip-commentary')).toBeNull();
  });

  it('pausing saves where the listener is: the last line heard, with the band and the mode', async () => {
    m.episode.mockResolvedValue(ok(episode()));
    await player();
    m.progress.mockClear();
    await endSentence();
    await endSentence(); // seq 1 and 2 heard, seq 3 playing
    await click(q('radio-play-pause'));
    expect(m.progress).toHaveBeenLastCalledWith('dee', { programId: 'dee_s01e01', seq: 2, band: 'B1', mode: 'balanced' });
  });

  it('a save names the text its line numbers are in, when the episode answer said which (KAZI-1476)', async () => {
    m.episode.mockResolvedValue(ok({ ...episode(), script_checksum: 'sha256:abc' }));
    await player();
    m.progress.mockClear();
    await endSentence();
    await click(q('radio-play-pause'));
    expect(m.progress).toHaveBeenLastCalledWith(
      'dee',
      expect.objectContaining({ programId: 'dee_s01e01', seq: 1, scriptChecksum: 'sha256:abc' })
    );
  });

  it('an answer without it ⇒ the save names no text (a server that does not send the field yet)', async () => {
    m.episode.mockResolvedValue(ok(episode()));
    await player();
    m.progress.mockClear();
    await endSentence();
    await click(q('radio-play-pause'));
    expect(m.progress.mock.calls.at(-1)?.[1].scriptChecksum).toBeUndefined();
  });

  it('a save the server kept out (the episode was rewritten) changes nothing on screen and playing goes on', async () => {
    m.episode.mockResolvedValue(ok({ ...episode(), script_checksum: 'sha256:old' }));
    m.progress.mockResolvedValue(
      ok({ storyline_id: 'dee', applied: false, progress: { program_id: 'dee_s01e01', season: 1, episode: 1, seq: 1, mode: 'balanced', band: 'B1', updated_at: '2026-11-25T00:00:00Z' } })
    );
    await player();
    await endSentence();
    await endSentence();
    await click(q('radio-play-pause'));
    expect(m.progress).toHaveBeenLastCalledWith('dee', expect.objectContaining({ seq: 2, scriptChecksum: 'sha256:old' }));
    expect(q('radio-play-pause')).not.toBeNull();
  });

  it('nothing heard yet ⇒ nothing is saved (opening an episode does not move the listener)', async () => {
    m.episode.mockResolvedValue(ok(episode()));
    await player();
    await click(q('radio-play-pause'));
    expect(m.progress).not.toHaveBeenCalled();
  });

  it('changing the mode reads the episode again in that mode and carries on from the same place', async () => {
    m.episode.mockResolvedValueOnce(ok(episode()));
    await player();
    await endSentence(); // seq 1 heard
    const immersive = episode({ mode: 'immersive', segments: episode().segments.filter((s) => s.role === 'story') });
    m.episode.mockResolvedValueOnce(ok(immersive));
    await click(q('radio-serial-mode-immersive'));
    await act(async () => {});
    expect(m.episode).toHaveBeenLastCalledWith('dee', 'dee_s01e01', 'immersive');
    expect(m.track).toHaveBeenCalledWith('commentary_mode_changed', { programId: 'dee_s01e01' }, { from: 'balanced', to: 'immersive' });
    expect(q('radio-serial-mode-immersive')?.getAttribute('aria-checked')).toBe('true');
    expect(audio().src).toBe('https://e/4.mp3'); // after seq 1, the next line this mode plays
  });

  it('"explain this sentence" asks with the sentence number and the mode, not a position', async () => {
    m.episode.mockResolvedValue(ok(episode()));
    m.ask.mockResolvedValue(ok({ request_id: 'x', answer: { segments: [{ seq: 1, lang: 'zh', text: '答' }] }, ai_calls_used: 1 }));
    await player();
    await act(async () => {
      qa('radio-sentence')[3].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    });
    await click(q('radio-explain'));
    expect(m.ask).toHaveBeenCalledTimes(1);
    const [line, programId, ask] = m.ask.mock.calls[0];
    expect([line, programId]).toEqual(['dee', 'dee_s01e01']);
    expect(ask).toMatchObject({ seq: 4, mode: 'balanced', text: 'radio.player.explain：He opened the file.' });
    expect(ask.requestId).toMatch(/^[A-Za-z0-9_-]{8,40}$/);
    expect(q('radio-answer')?.textContent).toContain('答');
  });

  it('the recap, when the episode has one, is reported once as it plays', async () => {
    const withRecap = episode({
      recap: true,
      segments: [{ seq: 1, role: 'recap', lang: 'zh', text: '上一集……', audio_url: 'https://e/r.mp3', duration_ms: 1000 }, ...episode().segments.slice(3)],
    });
    m.episode.mockResolvedValue(ok(withRecap));
    await player();
    expect(qa('radio-sentence')[0].getAttribute('data-tone')).toBe('recap');
    expect(m.track.mock.calls.filter((c) => c[0] === 'recap_played')).toEqual([['recap_played', { programId: 'dee_s01e01' }, { mode: 'balanced' }]]);
  });

  it('back in the middle of an episode with a recap: the recap plays first, then on from where the listener was', async () => {
    const recap = { seq: 1, role: 'recap' as const, lang: 'zh' as const, text: '上一集……', audio_url: 'https://e/r.mp3', duration_ms: 1000 };
    const rest = episode().segments.map((s) => ({ ...s, seq: s.seq + 1, audio_url: `https://e/${s.seq + 1}.mp3` }));
    m.episode.mockResolvedValue(ok(episode({ recap: true, resume_seq: 4, sentences: 6, segments: [recap, ...rest] })));
    await player();
    expect(audio().src).toBe('https://e/r.mp3');
    await endSentence();
    expect(audio().src).toBe('https://e/5.mp3'); // the first line after seq 4, not the line after the recap
    // Hearing the recap never moved the listener back.
    await click(q('radio-play-pause'));
    expect(m.progress).not.toHaveBeenCalled();
  });

  it('played to its end: saved at its last line, the next episode is offered, and there is no rating', async () => {
    m.episode.mockResolvedValue(ok(episode({ resume_seq: 4 })));
    await player();
    expect(audio().src).toBe('https://e/5.mp3');
    await endSentence();
    expect(m.progress).toHaveBeenLastCalledWith('dee', { programId: 'dee_s01e01', seq: 5, band: 'B1', mode: 'balanced' });
    expect(q('radio-next-episode')?.getAttribute('href')).toBe('/zh/radio/serial/dee/dee_s01e02');
    expect(q('radio-rating')).toBeNull();
    expect(container.querySelector('a[href="/zh/radio/serial/dee"]')).not.toBeNull();
  });

  it('listening again from the top never moves the saved place back', async () => {
    m.episode.mockResolvedValue(ok(episode()));
    await player();
    for (let i = 0; i < 5; i += 1) await endSentence(); // played to its end: saved at seq 5
    expect(m.progress).toHaveBeenLastCalledWith('dee', expect.objectContaining({ seq: 5 }));
    m.progress.mockClear();
    await click(q('radio-play-pause')); // play again, from the top
    expect(audio().src).toBe('https://e/1.mp3');
    await endSentence(); // seq 1 heard again
    await click(q('radio-play-pause')); // pause: a save is attempted
    expect(m.progress).not.toHaveBeenCalled(); // seq 1 is behind the place: nothing to save
  });

  it('the last episode offers no next episode', async () => {
    m.episode.mockResolvedValue(ok(episode({ resume_seq: 4, next_program_id: null })));
    await player();
    await endSentence();
    expect(q('radio-program-done')).not.toBeNull();
    expect(q('radio-next-episode')).toBeNull();
  });

  it('an episode that is not there shows "content cannot be found" with the way back to the episodes', async () => {
    m.episode.mockResolvedValue({ success: false, status: 404, errorCode: 'serial_not_found', error: 'x' });
    await player();
    expect(q('radio-program-missing')?.textContent).toContain('radio.contentMissing');
    expect(q('radio-program-missing')?.querySelector('a')?.getAttribute('href')).toBe('/zh/radio/serial/dee');
    expect(m.replace).not.toHaveBeenCalled();
  });
});
