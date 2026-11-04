/**
 * @vitest-environment jsdom
 *
 * KAZI-1209 — the radio home and a program (kazispace-ui personal-radio.md, Radio home · First visit ·
 * Starting a new story · States · A program).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  home: vi.fn(),
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
vi.mock('@/lib/radio/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/radio/api')>()),
  getRadioHome: m.home,
  startRadioStory: m.start,
  setRadioBand: m.band,
  getRadioProgram: m.program,
}));

import { RadioHomeScreen } from '@/components/radio/radio-home';
import { ProgramPlayerScreen } from '@/components/radio/program-player';

const SAVE = { save_id: 'sv1', title: 'Old story', status: 'active', current_node_id: 'n3', save_version: 2, updated_at: '2026-11-03T12:00:00Z', choices_made: 1 };
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
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('Radio home', () => {
  it('lists the story library and the programs (KAZIOP-2), back to Studio', async () => {
    m.home.mockResolvedValue({ success: true, data: HOME });
    await home();
    expect(qa('radio-story').map((s) => s.querySelector('h3')?.textContent)).toEqual(['The Hotel Note']);
    expect(q('radio-story')?.textContent).toContain('A note under the door');
    expect(qa('radio-program')[0]?.getAttribute('href')).toBe('/zh/radio/program/sotd_20261103');
    expect(container.querySelector('a[href="/zh/clinic/hub"]')).not.toBeNull();
    expect(q('radio-level-question')).toBeNull();
    expect(q('radio-home-continue')).toBeNull(); // hidden when there are none
  });

  it('stories in progress are listed under Continue listening, each opening its player', async () => {
    m.home.mockResolvedValue({ success: true, data: { ...HOME, continue_listening: [SAVE] } });
    await home();
    const card = q('radio-continue-card');
    expect(card?.textContent).toContain('Old story');
    expect(card?.querySelector('a')?.getAttribute('href')).toBe('/zh/radio/story/sv1');
  });

  it('first visit with no level: asks once, saves the tapped level and shows the home', async () => {
    m.home.mockResolvedValue({ success: true, data: { ...HOME, profile: { ...HOME.profile, source: 'none' }, prefs: {} } });
    m.band.mockResolvedValue({ success: true, data: { prefs: { band_override: 'B2' }, profile: { ...HOME.profile, band: 'B2', source: 'override' } } });
    await home();
    expect(q('radio-level-question')).not.toBeNull();
    await act(async () => (q('radio-level-B2') as HTMLButtonElement).click());
    expect(m.band).toHaveBeenCalledWith('B2');
    expect(q('radio-level-question')).toBeNull();
  });

  it('starting a story opens its player', async () => {
    m.home.mockResolvedValue({ success: true, data: HOME });
    m.start.mockResolvedValue({ success: true, data: { save_id: 'sv9', save_version: 1, profile: HOME.profile, ai_calls_used: 1 } });
    await home();
    await act(async () => (q('radio-story-start') as HTMLButtonElement).click());
    expect(m.start).toHaveBeenCalledTimes(1);
    expect(m.start.mock.calls[0][0]).toBe('s1');
    expect(m.start.mock.calls[0][1]).toMatch(/^[A-Za-z0-9_-]{8,40}$/);
    expect(m.push).toHaveBeenCalledWith('/zh/radio/story/sv9');
  });

  it('a network error keeps the request id, so the retry is the same request', async () => {
    m.home.mockResolvedValue({ success: true, data: HOME });
    m.start
      .mockResolvedValueOnce({ success: false, errorCode: 'NETWORK_ERROR' })
      .mockResolvedValueOnce({ success: true, data: { save_id: 'sv9', save_version: 1, profile: HOME.profile, ai_calls_used: 1 } });
    await home();
    await act(async () => (q('radio-story-start') as HTMLButtonElement).click());
    await act(async () => (q('radio-story-start') as HTMLButtonElement).click());
    expect(m.start.mock.calls[1][1]).toBe(m.start.mock.calls[0][1]);
  });

  it('3 stories in progress (409 save_limit): the sheet, then the chosen one is replaced', async () => {
    const three = [SAVE, { ...SAVE, save_id: 'sv2', title: 'Second' }, { ...SAVE, save_id: 'sv3', title: 'Third' }];
    m.home.mockResolvedValue({ success: true, data: { ...HOME, continue_listening: three } });
    m.start
      .mockResolvedValueOnce({ success: false, status: 409, errorCode: 'save_limit' })
      .mockResolvedValueOnce({ success: true, data: { save_id: 'sv9', save_version: 1, profile: HOME.profile, ai_calls_used: 1 } });
    await home();
    await act(async () => (q('radio-story-start') as HTMLButtonElement).click());
    const sheet = q('radio-save-limit');
    expect(sheet).not.toBeNull();
    expect((q('radio-save-limit-replace') as HTMLButtonElement).disabled).toBe(true); // nothing preselected
    const second = Array.from(sheet!.querySelectorAll('button')).find((b) => b.textContent === 'Second') as HTMLButtonElement;
    await act(async () => second.click());
    await act(async () => (q('radio-save-limit-replace') as HTMLButtonElement).click());
    expect(m.start.mock.calls[1][2]).toBe('sv2');
    // Save limit step 3: the replace uses the same request id as the first attempt.
    expect(m.start.mock.calls[1][1]).toBe(m.start.mock.calls[0][1]);
    expect(m.push).toHaveBeenCalledWith('/zh/radio/story/sv9');
  });

  it('save-limit sheet cancelled: a later start is a new attempt with a new request id', async () => {
    const three = [SAVE, { ...SAVE, save_id: 'sv2', title: 'Second' }, { ...SAVE, save_id: 'sv3', title: 'Third' }];
    m.home.mockResolvedValue({ success: true, data: { ...HOME, continue_listening: three } });
    m.start.mockResolvedValue({ success: false, status: 409, errorCode: 'save_limit' });
    await home();
    await act(async () => (q('radio-story-start') as HTMLButtonElement).click());
    const cancel = Array.from(q('radio-save-limit')!.querySelectorAll('button')).find((b) => b.textContent === 'radio.cancel') as HTMLButtonElement;
    await act(async () => cancel.click());
    expect(q('radio-save-limit')).toBeNull();
    await act(async () => (q('radio-story-start') as HTMLButtonElement).click());
    expect(m.start.mock.calls[1][1]).not.toBe(m.start.mock.calls[0][1]);
  });

  it('the header has the settings gear, named radio.settings.title', async () => {
    m.home.mockResolvedValue({ success: true, data: HOME });
    await home();
    const gear = q('radio-settings-open');
    expect(gear?.getAttribute('href')).toBe('/zh/radio/settings');
    expect(gear?.getAttribute('aria-label')).toBe('radio.settings.title');
  });

  it('a story just taken down: toast, and the home reloads', async () => {
    m.home.mockResolvedValue({ success: true, data: HOME });
    m.start.mockResolvedValue({ success: false, status: 409, errorCode: 'story_unavailable' });
    await home();
    await act(async () => (q('radio-story-start') as HTMLButtonElement).click());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(m.toast).toHaveBeenCalledWith('radio.home.storyUnavailable');
    expect(m.home).toHaveBeenCalledTimes(2);
  });

  it('new stories not available in the region: one line, start disabled, programs still open', async () => {
    m.home.mockResolvedValue({ success: true, data: { ...HOME, availability: { tts: false, asr: false, new_render: false } } });
    await home();
    expect(q('radio-tts-disabled')?.textContent).toBe('radio.region.ttsDisabled');
    expect((q('radio-story-start') as HTMLButtonElement).disabled).toBe(true);
    expect(qa('radio-program')).toHaveLength(1);
  });

  it('a 200 with no save shows the server notice (e.g. not available here)', async () => {
    m.home.mockResolvedValue({ success: true, data: HOME });
    m.start.mockResolvedValue({ success: true, data: { profile: HOME.profile, ai_calls_used: 0, notice: { kind: 'unavailable', code: 'tts_unavailable', text: '这里暂时不能开新故事' } } });
    await home();
    await act(async () => (q('radio-story-start') as HTMLButtonElement).click());
    expect(q('radio-home-notice')?.textContent).toContain('这里暂时不能开新故事');
    expect(m.push).not.toHaveBeenCalled();
  });

  it('empty library and no programs: each says so in one line', async () => {
    m.home.mockResolvedValue({ success: true, data: { ...HOME, stories: [], programs: [] } });
    await home();
    expect(q('radio-home-stories')?.textContent).toContain('radio.home.storiesEmpty');
    expect(q('radio-home-programs')?.textContent).toContain('radio.home.programsEmpty');
  });

  it.each([
    ['radio off', { success: false, status: 404, errorCode: 'REGION_ACCOUNT_NOT_FOUND' }],
    ['not Pro', { success: false, status: 403, errorCode: 'radio_pro_required' }],
  ])('%s: a link here goes to Studio', async (_n, res) => {
    m.home.mockResolvedValue(res);
    await home();
    expect(m.replace).toHaveBeenCalledWith('/zh/clinic/hub');
  });

  it('a non-Chinese interface goes to Studio without asking the server', async () => {
    await home('en');
    expect(m.replace).toHaveBeenCalledWith('/en/clinic/hub');
    expect(m.home).not.toHaveBeenCalled();
  });
});

describe('A program', () => {
  it('plays the program in captions, back to the radio home', async () => {
    m.program.mockResolvedValue({
      success: true,
      data: {
        program_id: 'sotd_20261103', kind: 'column', series: 'Sentence of the Day', title: "It's not my cup of tea",
        band: 'B1', voice_id: 'en_gb_f1', duration_ms: 30000,
        segments: [
          { seq: 1, lang: 'en', text: 'Welcome to Sentence of the Day.', audio_url: 'https://a/1.mp3' },
          { seq: 2, lang: 'zh', text: '今天这句话是一个很常见的英语习语。', audio_url: null },
        ],
      },
    });
    await mount(<ProgramPlayerScreen locale="zh" programId="sotd_20261103" />);
    expect(m.program).toHaveBeenCalledWith('sotd_20261103');
    expect(q('radio-captions')?.textContent).toContain('Welcome to Sentence of the Day.');
    expect(q('radio-captions')?.textContent).toContain('今天这句话');
    expect(container.querySelector('a[href="/zh/radio"]')).not.toBeNull();
  });

  it('409 program_not_found / program_unavailable: "content cannot be found"', async () => {
    m.program.mockResolvedValue({ success: false, status: 409, errorCode: 'program_unavailable' });
    await mount(<ProgramPlayerScreen locale="zh" programId="nope" />);
    expect(q('radio-program-missing')?.textContent).toContain('radio.contentMissing');
  });
});
