/**
 * @vitest-environment jsdom
 *
 * KAZI-1257 E — filtering and sorting the story library on the radio home
 * (kazispace-ui personal-radio.md, Filtering and sorting stories).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  home: vi.fn(),
  facets: vi.fn(),
  stories: vi.fn(),
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
  getRadioFacets: m.facets,
  getRadioStories: m.stories,
}));

import { RadioHomeScreen } from '@/components/radio/radio-home';

const HOTEL = {
  story_id: 's1', slug: 's_hotel_note', title: 'The Hotel Note', tags: [], base_cefr: 'B1', recommended: true,
  attrs: { suspense: 2, age_range: ['teens', 'adults'], genre: 'mystery', duration_s_est: 280 },
};
const DEAL = {
  story_id: 's2', slug: 's_fake_plus_one_r2', title: 'The Deal Next Door', tags: [], base_cefr: 'B1', recommended: true,
  attrs: { suspense: 1, age_range: ['adults'], genre: 'comedy', duration_s_est: 282 },
};
const HOME = {
  continue_listening: [],
  stories: [HOTEL, DEAL],
  programs: [],
  profile: { band: 'B1', en_ratio: 0.4, voice_id: 'en_gb_f1', source: 'override' },
  prefs: { band_override: 'B1' },
  availability: { tts: true, asr: true, new_render: true },
  voices: ['en_us_f1'],
  voice_samples: [],
};
const FACETS = {
  vocab_version: 1,
  source: 'chengdu',
  filters: [
    { key: 'suspense', type: 'int_range', values: { min: 0, max: 3 }, params: ['suspense_min', 'suspense_max'] },
    { key: 'age_range', type: 'enum_multi', values: ['kids', 'teens', 'adults'], params: ['age_range'] },
    { key: 'genre', type: 'enum', values: ['mystery', 'adventure', 'comedy', 'daily_life', 'scifi', 'history'], params: ['genre'] },
    { key: 'base_cefr', type: 'enum', values: ['A2', 'B1', 'B2', 'C1'], params: ['cefr'] },
    { key: 'duration_s_est', type: 'int', values: { min: 0 }, params: ['duration_max_s'] },
  ],
  sorts: ['suspense', 'popularity', 'novelty', 'completion_rate', 'updated'],
};
const ok = <T,>(data: T) => ({ success: true, data });
const fail = (status: number, errorCode?: string) => ({ success: false, status, errorCode, error: 'x' });

let container: HTMLDivElement;
let root: Root;
const q = (id: string) => container.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const titles = () => Array.from(container.querySelectorAll('[data-testid="radio-story"] h3')).map((h) => h.textContent);
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const sent = () => m.stories.mock.calls.map(([qs]) => (qs as URLSearchParams).toString());

async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(<QueryClientProvider client={client}><RadioHomeScreen locale="zh" /></QueryClientProvider>);
  });
  await settle();
  await settle();
}
async function click(id: string) {
  await act(async () => { q(id)!.click(); });
  await settle();
  await settle();
}
async function choose(id: string, value: string) {
  const el = q(id) as HTMLSelectElement;
  await act(async () => {
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await settle();
  await settle();
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('Audio', class { play() { return Promise.resolve(); } pause() {} });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  Object.values(m).forEach((f) => f.mockReset());
  m.home.mockResolvedValue(ok(HOME));
  m.facets.mockResolvedValue(ok(FACETS));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('Filtering and sorting stories', () => {
  it('the row comes from GET /facets; with nothing chosen the list is the home\'s and GET /stories is not called', async () => {
    await mount();
    expect(q('radio-story-filters')).not.toBeNull();
    expect(q('radio-filter-genre-daily_life')?.textContent).toBe('radio.genre.dailyLife');
    expect(q('radio-filter-base_cefr-B1')?.textContent).toBe('B1');
    expect(Array.from((q('radio-sort') as HTMLSelectElement).options).map((o) => o.textContent)).toEqual([
      'radio.home.sort.default', 'radio.home.sort.suspense', 'radio.home.sort.popularity',
      'radio.home.sort.novelty', 'radio.home.sort.completionRate', 'radio.home.sort.updated',
    ]);
    expect(Array.from((q('radio-filter-suspense') as HTMLSelectElement).options).map((o) => o.value)).toEqual(['', '1', '2', '3']);
    expect(container.textContent).not.toContain('duration');
    expect(titles()).toEqual(['The Hotel Note', 'The Deal Next Door']);
    expect(m.stories).not.toHaveBeenCalled();
    expect(q('radio-filter-clear')).toBeNull();
  });

  it('a card shows its genre; a genre filter replaces the list with GET /stories; clear goes back without a call', async () => {
    await mount();
    expect(container.querySelector('[data-testid="radio-story"]')!.textContent).toContain('radio.genre.mystery');
    m.stories.mockResolvedValue(ok({ stories: [DEAL] }));
    await click('radio-filter-genre-comedy');
    expect(sent()).toEqual(['genre=comedy']);
    expect(q('radio-filter-genre-comedy')!.getAttribute('aria-pressed')).toBe('true');
    expect(titles()).toEqual(['The Deal Next Door']);
    await click('radio-filter-clear');
    expect(titles()).toEqual(['The Hotel Note', 'The Deal Next Door']);
    expect(m.stories).toHaveBeenCalledTimes(1);
  });

  it('suspense "at least" and sort go into the same query', async () => {
    await mount();
    m.stories.mockResolvedValue(ok({ stories: [HOTEL, DEAL] }));
    await choose('radio-filter-suspense', '1');
    await choose('radio-sort', 'suspense');
    expect(sent()).toEqual(['suspense_min=1', 'suspense_min=1&sort=suspense']);
  });

  it('no result: the filter-empty line with clear, not "no stories yet"', async () => {
    await mount();
    m.stories.mockResolvedValue(ok({ stories: [] }));
    await click('radio-filter-age_range-kids');
    expect(q('radio-filter-empty')?.textContent).toContain('radio.home.filter.empty');
    expect(container.textContent).not.toContain('radio.home.storiesEmpty');
  });

  it('400: re-reads the filters; when nothing chosen is left, clears them with the reset toast', async () => {
    await mount();
    m.stories.mockResolvedValueOnce(fail(400, 'bad_facet_value'));
    m.facets.mockResolvedValue(ok({ ...FACETS, sorts: ['updated'] }));
    await choose('radio-sort', 'popularity');
    // sort=popularity ⇒ 400; the server no longer offers it and nothing else was chosen ⇒ cleared, nothing resent
    expect(sent()).toEqual(['sort=popularity']);
    expect(m.toast).toHaveBeenCalledWith('radio.home.filter.reset', 'info');
    expect(titles()).toEqual(['The Hotel Note', 'The Deal Next Door']);
  });

  it('400 then a pruned query that answers: the pruned choices stay, no second request for them', async () => {
    await mount();
    m.stories.mockResolvedValueOnce(ok({ stories: [HOTEL] }));
    await click('radio-filter-genre-mystery');
    m.stories.mockResolvedValueOnce(fail(400, 'unknown_facet')).mockResolvedValueOnce(ok({ stories: [HOTEL] }));
    m.facets.mockResolvedValue(ok({ ...FACETS, sorts: ['updated'] }));
    await choose('radio-sort', 'popularity');
    expect(sent()).toEqual(['genre=mystery', 'genre=mystery&sort=popularity', 'genre=mystery']);
    expect(m.toast).not.toHaveBeenCalled();
    expect((q('radio-sort') as HTMLSelectElement).value).toBe('');
    expect(q('radio-filter-genre-mystery')!.getAttribute('aria-pressed')).toBe('true');
    expect(titles()).toEqual(['The Hotel Note']);
  });

  it('a second 400 clears the filters, with the reset toast', async () => {
    await mount();
    m.stories.mockResolvedValue(fail(400, 'bad_facet_value'));
    await click('radio-filter-genre-mystery');
    expect(sent()).toEqual(['genre=mystery', 'genre=mystery']);
    expect(m.toast).toHaveBeenCalledWith('radio.home.filter.reset', 'info');
    expect(q('radio-filter-genre-mystery')!.getAttribute('aria-pressed')).toBe('false');
    expect(titles()).toEqual(['The Hotel Note', 'The Deal Next Door']);
  });

  it('another failure: the section error with retry, which sends the same query', async () => {
    await mount();
    m.stories.mockResolvedValueOnce(fail(503)).mockResolvedValueOnce(ok({ stories: [DEAL] }));
    await click('radio-filter-genre-comedy');
    expect(q('radio-stories-error')).not.toBeNull();
    await act(async () => { (q('radio-stories-error')!.querySelector('button') as HTMLButtonElement).click(); });
    await settle();
    await settle();
    expect(sent()).toEqual(['genre=comedy', 'genre=comedy']);
    expect(titles()).toEqual(['The Deal Next Door']);
  });

  it('GET /facets fails: no filter row, the library as before', async () => {
    m.facets.mockResolvedValue(fail(503));
    await mount();
    expect(q('radio-story-filters')).toBeNull();
    expect(titles()).toEqual(['The Hotel Note', 'The Deal Next Door']);
  });

  it('403 on GET /stories is read as Who sees it: the home is asked again', async () => {
    await mount();
    expect(m.home).toHaveBeenCalledTimes(1);
    m.stories.mockResolvedValue(fail(403, 'radio_pro_required'));
    await click('radio-filter-genre-comedy');
    expect(q('radio-stories-error')).toBeNull();
    expect(m.home).toHaveBeenCalledTimes(2);
  });
});
