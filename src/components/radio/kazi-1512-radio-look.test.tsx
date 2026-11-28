/**
 * @vitest-environment jsdom
 *
 * KAZI-1512 — Radio's own dark look (kazispace-ui D48, Personal radio 0.35 "Look", tokens 0.4). Owen, 2026-11-28,
 * quoted as written: 「个人电台的UI设计。 是下一个重点任务。 请参照参考视频的设计，非常有吸引力。 看看能否借鉴」; he chose
 * "Radio always dark (Recommended)" and "Keep tap, new look (Recommended)".
 *
 * Pinned here: the resume bar (the most recent item in progress; it opens the player; Continue listening leaves it
 * out), covers by kind, the page gradient, the microphone's look (72px with its ring; working is not faded; tap
 * to talk), and the listening pill with its running time.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  home: vi.fn(),
  facets: vi.fn(),
  start: vi.fn(),
  band: vi.fn(),
  program: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
  toast: vi.fn(),
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
// KAZI-1287: Live Room off here (404 hides the Live section); the section has its own tests.
vi.mock('@/lib/radio/live-api', async (orig) => ({
  ...(await orig<typeof import('@/lib/radio/live-api')>()),
  getLiveHome: () => Promise.resolve({ success: false, status: 404, error: 'Not Found' }),
}));
vi.mock('@/lib/radio/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/radio/api')>()),
  getRadioHome: m.home,
  // KAZI-1257 E: no filter row in these tests (GET /facets unavailable ⇒ the library as before).
  getRadioFacets: m.facets,
  startRadioStory: m.start,
  setRadioBand: m.band,
  getRadioProgram: m.program,
}));

import { RadioHomeScreen } from '@/components/radio/radio-home';
import { ListeningIndicator, MicButton, formatElapsed } from '@/components/radio/voice-parts';
import { PlayerShell } from '@/components/radio/player-parts';
import { RadioCover } from '@/components/radio/radio-cover';
import { pickRadioResume } from '@/lib/radio/resume';
import { RADIO_PAGE } from '@/lib/radio/theme';
import tokens from '@/design-tokens/tokens.resolved.json';
import config from '../../../tailwind.config';

const SAVE = { save_id: 'sv1', title: 'Old story', status: 'active' as const, current_node_id: 'n3', save_version: 2, updated_at: '2026-11-03T12:00:00Z', choices_made: 1 };
const HOME = {
  continue_listening: [] as (typeof SAVE)[],
  stories: [{ story_id: 's1', slug: 'hotel', title: 'The Hotel Note', synopsis: 'A note under the door', tags: ['mystery'], base_cefr: 'B1', recommended: true }],
  programs: [{ program_id: 'sotd_20261103', kind: 'column', series: 'Sentence of the Day', title: "It's not my cup of tea", tags: ['daily'] }],
  profile: { band: 'B1', en_ratio: 0.4, voice_id: 'en_gb_f1', source: 'override' },
  prefs: { band_override: 'B1' },
  availability: { tts: true, asr: true, new_render: true },
  voices: ['en_us_f1', 'en_us_m1', 'en_gb_f1'],
  voice_samples: [],
};

let container: HTMLDivElement;
let root: Root;
const q = (id: string) => container.querySelector(`[data-testid="${id}"]`);
const qa = (id: string) => Array.from(container.querySelectorAll(`[data-testid="${id}"]`));

async function mount(el: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(<QueryClientProvider client={client}>{el}</QueryClientProvider>);
  });
  // let the react-query fetch settle
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}
const home = (locale = 'zh') => mount(<RadioHomeScreen locale={locale} />);

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('Audio', class { play() { return Promise.resolve(); } pause() {} });
  Element.prototype.scrollIntoView = vi.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  Object.values(m).forEach((f) => f.mockReset());
  m.facets.mockResolvedValue({ success: false, status: 503, error: 'x' });
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});


const LINE = {
  storyline_id: 'ln1',
  title: 'Letters from London',
  synopsis: 'A student and an old letter.',
  tags: [],
  episodes: 12,
  seasons: [1],
  progress: { program_id: 'ep3', season: 1, episode: 3, seq: 4, mode: 'balanced', band: 'B1', updated_at: '2026-11-05T09:00:00Z' },
};

describe('the resume bar', () => {
  it('picks the most recent item in progress, story or serial; nothing in progress ⇒ none', () => {
    expect(pickRadioResume({ continue_listening: [], continue_storylines: [] })).toBeNull();
    expect(pickRadioResume({ continue_listening: [SAVE], continue_storylines: [] })?.key).toBe('sv1');
    const serial = pickRadioResume({ continue_listening: [SAVE], continue_storylines: [LINE as never] });
    expect(serial?.kind).toBe('serial'); // 2026-11-05 is after the save's 2026-11-03
    // a started story line without progress is not "in progress"
    expect(pickRadioResume({ continue_listening: [], continue_storylines: [{ ...LINE, progress: null } as never] })).toBeNull();
  });

  it('shows the latest story at the top and opens its player; Continue listening lists the others', async () => {
    const OLDER = { ...SAVE, save_id: 'sv0', title: 'Older story', updated_at: '2026-11-01T12:00:00Z' };
    m.home.mockResolvedValue({ success: true, data: { ...HOME, continue_listening: [OLDER, SAVE] } });
    await home();
    const bar = q('radio-resume-bar');
    expect(bar?.getAttribute('href')).toBe('/zh/radio/story/sv1'); // opens the player: nothing plays on the home
    expect(bar?.textContent).toContain('Old story');
    expect(q('radio-resume-detail')?.textContent).toContain('radio.studio.progress');
    expect(qa('radio-continue-card').map((c) => c.querySelector('h3')?.textContent)).toEqual(['Older story']);
    expect(container.querySelector('audio')).toBeNull();
  });

  it('an episode in progress opens that episode and says which one', async () => {
    m.home.mockResolvedValue({ success: true, data: { ...HOME, continue_listening: [SAVE], storylines: [LINE], continue_storylines: [LINE] } });
    await home();
    expect(q('radio-resume-bar')?.getAttribute('data-kind')).toBe('serial');
    expect(q('radio-resume-bar')?.getAttribute('href')).toBe('/zh/radio/serial/ln1/ep3');
    expect(q('radio-resume-detail')?.textContent).toContain('radio.serial.episodeNumber');
    expect(qa('radio-continue-card')).toHaveLength(1); // the story is not in the bar, so it stays listed
  });

  it('nothing in progress ⇒ no bar', async () => {
    m.home.mockResolvedValue({ success: true, data: HOME });
    await home();
    expect(q('radio-resume-bar')).toBeNull();
  });
});

describe('covers and the page', () => {
  it('every card has a cover of its kind, hidden from assistive technology', async () => {
    m.home.mockResolvedValue({ success: true, data: { ...HOME, storylines: [{ ...LINE, progress: null }], continue_storylines: [] } });
    await home();
    const kindOf = (id: string) => q(id)?.querySelector('[data-testid="radio-cover"]')?.getAttribute('data-kind');
    expect(kindOf('radio-story')).toBe('story');
    expect(kindOf('radio-storyline')).toBe('serial');
    expect(kindOf('radio-program')).toBe('program');
    expect(container.querySelector('[data-testid="radio-cover"]')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('the home and the player use the Radio page gradient', async () => {
    m.home.mockResolvedValue({ success: true, data: HOME });
    await home();
    expect(q('radio-home')?.className).toContain('from-radio-bg-top');
    await act(async () => root.render(<PlayerShell back={null} title="T" nowPlaying={{ kind: 'program', detail: 'S1 · E3' }}>x</PlayerShell>));
    expect(q('radio-player')?.className).toContain(RADIO_PAGE);
    expect(q('radio-now-playing')?.querySelector('[data-testid="radio-cover"]')?.getAttribute('data-kind')).toBe('program');
    expect(q('radio-now-playing-detail')?.textContent).toBe('S1 · E3');
  });

  it('the cover falls back by kind (no image yet: KAZI-1513)', async () => {
    await act(async () => root.render(<>{(['story', 'serial', 'program'] as const).map((k) => <RadioCover key={k} kind={k} />)}</>));
    const classes = qa('radio-cover').map((c) => c.className);
    expect(classes[0]).toContain('from-radio-accent-start');
    expect(classes[1]).toContain('from-radio-now');
    expect(classes[2]).toContain('from-radio-accent-end');
  });

  it('the radio colours come from tokens 0.4', () => {
    const radio = ((config.theme?.extend?.colors ?? {}) as Record<string, Record<string, string>>).radio;
    const tk = tokens as unknown as Record<string, { value: string }>;
    expect(radio['bg-top']).toBe(tk['color.radio.bg-top'].value);
    expect(radio.ring).toBe(tk['color.radio.accent-ring'].value);
    expect(radio.recording).toBe(tk['color.radio.recording'].value);
  });
});

describe('the microphone and the listening pill', () => {
  const mic = (state: 'ready' | 'window' | 'recording' | 'working' | 'unavailable') =>
    act(async () =>
      root.render(
        <MicButton state={state} level={0.1} windowMs={state === 'window' ? 8000 : null} choiceCount={2} slow={false} onTap={() => {}} onDone={() => {}} onCancel={() => {}} />
      )
    );

  it('ready: a 72px accent button with its 2px ring; a tap, not a press and hold', async () => {
    await mic('ready');
    const b = q('radio-mic-button') as HTMLButtonElement;
    expect(b.className).toContain('h-[72px]');
    expect(b.className).toContain('ring-radio-ring');
    expect(b.className).toContain('from-radio-accent-start');
    expect(b.getAttribute('onpointerdown')).toBeNull();
  });

  it('window: the countdown ring and "listening" above the button', async () => {
    await mic('window');
    expect(container.querySelector('.radio-countdown')).not.toBeNull();
    expect(q('radio-mic-listening')).not.toBeNull();
  });

  it('recording: the recording colour with its ring, Cancel and Done beside it', async () => {
    await mic('recording');
    const box = q('radio-mic');
    expect(box?.innerHTML).toContain('bg-radio-recording');
    expect(box?.innerHTML).toContain('ring-radio-recording-ring');
    expect(q('radio-mic-done')).not.toBeNull();
    expect(q('radio-mic-cancel')).not.toBeNull();
  });

  it('working is not disabled-looking: full accent, spinner in on-accent', async () => {
    await mic('working');
    const span = container.querySelector('[aria-busy="true"]') as HTMLElement;
    expect(span.className).toContain('from-radio-accent-start');
    expect(span.className).not.toMatch(/opacity-/);
    expect(span.innerHTML).toContain('text-radio-on-accent');
  });

  it('the listening pill shows the time so far, counting up, and goes when the microphone turns off', async () => {
    vi.useFakeTimers();
    try {
      await act(async () => root.render(<ListeningIndicator on />));
      expect(q('radio-listening-elapsed')?.textContent).toBe('0:00');
      await act(async () => {
        vi.advanceTimersByTime(3100);
      });
      expect(q('radio-listening-elapsed')?.textContent).toBe('0:03');
      expect(q('radio-listening-indicator')?.className).toContain('bg-radio-recording');
      await act(async () => root.render(<ListeningIndicator on={false} />));
      expect(q('radio-listening-indicator')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
    expect(formatElapsed(65_000)).toBe('1:05');
  });
});
