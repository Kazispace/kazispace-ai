/**
 * @vitest-environment jsdom
 *
 * KAZI-1442 — Live Room stays Chinese-only while the radio opens to English. Owen 2026-11-22 chose
 * "Live Room stays Chinese-only (Recommended)": open the stories and programs to English, keep Live Room
 * Chinese-only until the English disclaimer is approved (the option wording is the agent's, the choice is
 * Owen's). English interface: stories and programs, no Live section, no Live screen.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  home: vi.fn(),
  facets: vi.fn(),
  liveHome: vi.fn(),
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
vi.mock('@/lib/radio/live-api', async (orig) => ({
  ...(await orig<typeof import('@/lib/radio/live-api')>()),
  getLiveHome: m.liveHome,
}));
vi.mock('@/lib/radio/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/radio/api')>()),
  getRadioHome: m.home,
  getRadioFacets: m.facets,
}));

import { RadioHomeScreen } from '@/components/radio/radio-home';
import { LiveScreen } from '@/components/radio/live-screen';
import { isLiveRoomLocale, isRadioLocale } from '@/lib/radio/routes';
import { resetLiveSessionForTest, setStartedLiveSession, takeStartedLiveSession } from '@/lib/radio/live-session';

const HOME = {
  continue_listening: [],
  stories: [{ story_id: 's1', slug: 'hotel', title: 'The Hotel Note', synopsis: 'A note', tags: [], base_cefr: 'B1', recommended: true }],
  programs: [],
  profile: { band: 'B1', en_ratio: 0.4, voice_id: 'en_gb_f1', source: 'override' },
  prefs: { band_override: 'B1' },
  availability: { tts: true, asr: true, new_render: true },
  voices: ['en_gb_f1'],
  voice_samples: [],
};
const LIVE_HOME = { hosts: [], topics: [], open_session_id: null };

let container: HTMLDivElement;
let root: Root;
const q = (id: string) => container.querySelector(`[data-testid="${id}"]`);

async function mount(el: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(<QueryClientProvider client={client}>{el}</QueryClientProvider>);
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('Audio', class { play() { return Promise.resolve(); } pause() {} });
  Element.prototype.scrollIntoView = vi.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  Object.values(m).forEach((f) => f.mockReset());
  m.home.mockResolvedValue({ success: true, data: HOME });
  m.facets.mockResolvedValue({ success: false, status: 503, error: 'x' });
  m.liveHome.mockResolvedValue({ success: true, data: LIVE_HOME });
  resetLiveSessionForTest();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('Live Room is Chinese-only; the radio is Chinese or English (KAZI-1442)', () => {
  it.each([
    ['zh', true, true],
    ['zh-CN', true, true],
    ['en', true, false],
    ['en-US', true, false],
    ['EN_gb', true, false],
    ['ru', false, false],
    ['', false, false],
  ])('%s: radio %s, Live Room %s', (locale, radio, live) => {
    expect(isRadioLocale(locale)).toBe(radio);
    expect(isLiveRoomLocale(locale)).toBe(live);
  });

  it('English radio home: stories shown, Live Room never asked', async () => {
    await mount(<RadioHomeScreen locale="en" />);
    expect(q('radio-story')).not.toBeNull();
    expect(m.liveHome).not.toHaveBeenCalled();
  });

  it('Chinese radio home: Live Room is asked as before', async () => {
    await mount(<RadioHomeScreen locale="zh" />);
    expect(q('radio-story')).not.toBeNull();
    expect(m.liveHome).toHaveBeenCalled();
  });

  it('English Live screen: takes no session and goes back to the radio home', async () => {
    setStartedLiveSession({ session: { session_id: 'ls1' } } as unknown as Parameters<typeof setStartedLiveSession>[0]);
    await mount(<LiveScreen locale="en" />);
    expect(m.replace).toHaveBeenCalledWith('/en/radio');
    expect(container.textContent).toBe('');
    // the started session was left untouched, not consumed by the English screen
    expect(takeStartedLiveSession()).not.toBeNull();
  });
});
