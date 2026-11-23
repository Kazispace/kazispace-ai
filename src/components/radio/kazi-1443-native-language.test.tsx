/**
 * @vitest-environment jsdom
 *
 * KAZI-1443 — the profile's native language (kazispace-ui personal-radio.md, "Story list by native
 * language"): one seven-item single-choice list, the same on Me → Profile and in radio settings, read and
 * written as `native_language` on `/me`; Not set sends `null`.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mapUserFromApi } from '@/lib/api-mappers';
import {
  NATIVE_LANGUAGES,
  nativeLanguageFromApi,
  nativeLanguageOptions,
  nativeLanguageToApi,
} from '@/lib/native-language';
import type { RadioHome } from '@/types/radio';

const m = vi.hoisted(() => ({
  getMe: vi.fn(),
  patchMe: vi.fn(),
  prefs: vi.fn(),
  bgm: vi.fn(),
  replace: vi.fn(),
  toast: vi.fn(),
  refresh: vi.fn(),
  setHome: vi.fn(),
  home: null as RadioHome | null,
}));

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: m.replace, push: vi.fn() }) }));
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
  useRadioHome: () => ({ access: 'open', home: m.home, isLoading: false, refresh: m.refresh, setHome: m.setHome }),
}));
vi.mock('@/lib/api-client', async (orig) => ({
  ...(await orig<typeof import('@/lib/api-client')>()),
  getMe: m.getMe,
  patchMe: m.patchMe,
}));
vi.mock('@/lib/radio/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/radio/api')>()),
  patchRadioPrefs: m.prefs,
}));
vi.mock('@/lib/radio/player-api', () => ({
  getRadioBgm: m.bgm,
  deleteRadioMemory: vi.fn(),
}));

import { RadioSettingsScreen } from '@/components/radio/radio-settings';

const HOME: RadioHome = {
  continue_listening: [],
  stories: [],
  programs: [],
  profile: { band: 'B1', en_ratio: 0.4, voice_id: 'en_gb_f1', source: 'override' },
  prefs: { band_override: null, en_ratio_override: null, voice_id: null, bgm_on: null, bgm_level: null, listen_window_on: null },
  availability: { tts: true, asr: true, new_render: true },
  voices: ['en_gb_f1'],
  voice_samples: [],
} as RadioHome;

const user = (nativeLanguage: string | null) => ({
  success: true,
  data: { id: 'u1', displayName: 'A', createdAt: '', updatedAt: '', nativeLanguage },
});

let container: HTMLDivElement;
let root: Root;
const group = () => container.querySelector('[data-testid="radio-settings-native-language"]');
const checked = () => group()?.querySelector('[aria-checked="true"]')?.getAttribute('data-value');
const option = (v: string) => group()?.querySelector(`[data-value="${v}"]`) as HTMLButtonElement | null;
async function mount() {
  await act(async () => root.render(<RadioSettingsScreen locale="zh" saveId={null} from="home" />));
  await act(async () => {});
}
async function click(el: Element | null | undefined) {
  expect(el).toBeTruthy();
  await act(async () => (el as HTMLElement).click());
  await act(async () => {});
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  Object.values(m).forEach((f) => typeof f === 'function' && 'mockReset' in f && (f as ReturnType<typeof vi.fn>).mockReset());
  m.home = HOME;
  m.bgm.mockResolvedValue({ success: true, data: { tracks: [] } });
  m.refresh.mockResolvedValue(undefined);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('the value', () => {
  it('is a closed set; anything else reads as Not set', () => {
    expect(NATIVE_LANGUAGES).toEqual(['zh', 'ru', 'kk', 'uz', 'en', 'other']);
    expect(nativeLanguageFromApi('ru')).toBe('ru');
    expect(nativeLanguageFromApi('fr')).toBeNull();
    expect(nativeLanguageFromApi(undefined)).toBeNull();
    expect(nativeLanguageToApi('')).toBeNull();
    expect(nativeLanguageToApi('kk')).toBe('kk');
  });

  it('comes from the top-level `native_language` of /me', () => {
    expect(mapUserFromApi({ user_id: 1, native_language: 'uz' }).nativeLanguage).toBe('uz');
    expect(mapUserFromApi({ user_id: 1, native_language: null }).nativeLanguage).toBeNull();
    expect(mapUserFromApi({ user_id: 1 }).nativeLanguage).toBeNull();
  });

  it('the list has seven items in spec order, Not set last', () => {
    const opts = nativeLanguageOptions((k) => k);
    expect(opts.map((o) => o.value)).toEqual(['zh', 'ru', 'kk', 'uz', 'en', 'other', '']);
    expect(opts.map((o) => o.label)).toEqual([
      'nativeLanguageOptions.zh',
      'nativeLanguageOptions.ru',
      'nativeLanguageOptions.kk',
      'nativeLanguageOptions.uz',
      'nativeLanguageOptions.en',
      'nativeLanguageOptions.other',
      'nativeLanguageUnset',
    ]);
  });
});

describe('radio settings: Native language row', () => {
  it('is first, shows the stored value, and lists the seven items', async () => {
    m.getMe.mockResolvedValue(user('ru'));
    await mount();
    const first = container.querySelector('[data-testid="radio-settings"] section');
    expect(first?.querySelector('h2')?.textContent).toBe('profile.nativeLanguageLabel');
    expect(checked()).toBe('ru');
    expect(Array.from(group()!.querySelectorAll('[role="radio"]')).map((b) => b.getAttribute('data-value'))).toEqual([
      'zh', 'ru', 'kk', 'uz', 'en', 'other', '',
    ]);
  });

  it('Not set is checked when the profile has none', async () => {
    m.getMe.mockResolvedValue(user(null));
    await mount();
    expect(checked()).toBe('');
  });

  it('picking a language sends it to /me and reads the radio home again (the server orders the lists)', async () => {
    m.getMe.mockResolvedValue(user(null));
    m.patchMe.mockResolvedValue(user('kk'));
    await mount();
    await click(option('kk'));
    expect(m.patchMe).toHaveBeenCalledWith({ native_language: 'kk' });
    expect(m.prefs).not.toHaveBeenCalled(); // not a radio pref
    expect(checked()).toBe('kk');
    expect(m.refresh).toHaveBeenCalled();
  });

  it('Not set sends null, which clears it', async () => {
    m.getMe.mockResolvedValue(user('en'));
    m.patchMe.mockResolvedValue(user(null));
    await mount();
    await click(option(''));
    expect(m.patchMe).toHaveBeenCalledWith({ native_language: null });
    expect(checked()).toBe('');
  });

  it('picking the current value sends nothing', async () => {
    m.getMe.mockResolvedValue(user('zh'));
    await mount();
    await click(option('zh'));
    expect(m.patchMe).not.toHaveBeenCalled();
  });

  it('a failed save puts the control back and says so', async () => {
    m.getMe.mockResolvedValue(user('ru'));
    m.patchMe.mockResolvedValue({ success: false, error: 'x' });
    await mount();
    await click(option('uz'));
    expect(checked()).toBe('ru');
    expect(m.toast).toHaveBeenCalledWith('radio.settings.saveFailed');
    expect(m.refresh).not.toHaveBeenCalled();
  });

  it('is hidden when /me could not be read (no value to show)', async () => {
    m.getMe.mockResolvedValue({ success: false });
    await mount();
    expect(container.querySelector('[data-testid="radio-settings"]')).not.toBeNull();
    expect(group()).toBeNull();
  });
});
