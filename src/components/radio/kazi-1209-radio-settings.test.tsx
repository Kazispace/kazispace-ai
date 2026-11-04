/**
 * @vitest-environment jsdom
 *
 * KAZI-1209 part 4 — radio settings (kazispace-ui personal-radio.md, Radio settings · Clearing radio
 * memory · Data · Saving settings), the settings ways in, and the player's header.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EN_RATIOS, readDefaultSpeed, rememberPlace, shownEnRatio, takePlace, writeDefaultSpeed } from '@/lib/radio/settings';
import { radioSettingsHref } from '@/lib/radio/routes';
import type { RadioHome, RadioPlayerResponse } from '@/types/radio';

const m = vi.hoisted(() => ({
  prefs: vi.fn(),
  bgm: vi.fn(),
  memory: vi.fn(),
  save: vi.fn(),
  turn: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
  toast: vi.fn(),
  refresh: vi.fn(),
  setHome: vi.fn(),
  home: null as RadioHome | null,
  access: 'open' as 'open' | 'closed' | 'unknown' | null,
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
  useRadioHome: () => ({
    access: m.access,
    home: m.home,
    isLoading: false,
    refresh: m.refresh,
    setHome: m.setHome,
  }),
}));
vi.mock('@/lib/radio/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/radio/api')>()),
  patchRadioPrefs: m.prefs,
  getRadioSave: m.save,
  postRadioTurn: m.turn,
  getRadioRender: vi.fn(),
}));
vi.mock('@/lib/radio/player-api', () => ({
  postRadioEvents: vi.fn(async () => ({ success: true, data: { accepted: 0, duplicates: 0, rejected: [] } })),
  getRadioSaves: vi.fn(async () => ({ success: true, data: { saves: [] } })),
  getRadioBgm: m.bgm,
  deleteRadioMemory: m.memory,
  postRadioTurnAudio: vi.fn(),
}));

import { RadioSettingsScreen } from '@/components/radio/radio-settings';
import { StoryPlayerScreen } from '@/components/radio/story-player';

const profile = { band: 'B1', en_ratio: 0.4, voice_id: 'en_gb_f1', source: 'override' } as const;
const HOME: RadioHome = {
  continue_listening: [
    { save_id: 'sv1', story_id: 'st1', title: '雨夜来客', status: 'active', current_node_id: 'n1', save_version: 3, updated_at: '2026-11-03T10:00:00Z' },
  ],
  stories: [],
  programs: [],
  profile,
  prefs: { band_override: null, en_ratio_override: null, voice_id: null, bgm_on: null, bgm_level: null, listen_window_on: null },
  availability: { tts: true, asr: true, new_render: true },
  voices: ['en_us_f1', 'en_us_m1', 'en_gb_f1'],
};

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

let container: HTMLDivElement;
let root: Root;
const q = (id: string) => container.querySelector(`[data-testid="${id}"]`);
const opt = (group: string, value: string) =>
  container.querySelector(`[data-testid="radio-settings-${group}"] [data-value="${value}"]`) as HTMLButtonElement | null;
const checked = (group: string) =>
  container.querySelector(`[data-testid="radio-settings-${group}"] [aria-checked="true"]`)?.getAttribute('data-value');
const click = async (el: Element | null) => {
  expect(el).not.toBeNull();
  await act(async () => (el as HTMLElement).click());
};
async function mount(el: React.ReactElement) {
  await act(async () => root.render(el));
  await act(async () => {});
}
const settings = (props: { saveId?: string } = {}) => mount(<RadioSettingsScreen locale="zh" saveId={props.saveId ?? null} from="home" />);
const ok = (prefs: Record<string, unknown>, prof: Record<string, unknown> = {}) => ({
  success: true,
  data: { prefs: { ...HOME.prefs, ...prefs }, profile: { ...profile, ...prof } },
});

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  FakeAudio.all = [];
  vi.stubGlobal('Audio', FakeAudio);
  Element.prototype.scrollIntoView = vi.fn();
  window.localStorage.clear();
  window.sessionStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  Object.values(m).forEach((f) => typeof f === 'function' && 'mockReset' in f && (f as ReturnType<typeof vi.fn>).mockReset());
  m.home = HOME;
  m.access = 'open';
  m.bgm.mockResolvedValue({ success: true, data: { tracks: [] } });
  m.refresh.mockResolvedValue(undefined);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('the rules', () => {
  it('English shares per level, and the shown share falls back to the level default', () => {
    expect(EN_RATIOS.C1).toEqual([0.7, 0.8]);
    expect(shownEnRatio('B2', 0.6)).toBe(0.6);
    expect(shownEnRatio('B2', 0.3)).toBe(0.6); // not allowed at B2 → its default
    expect(shownEnRatio('A2', null)).toBe(0.3);
  });

  it('the default speed is kept by the app', () => {
    expect(readDefaultSpeed()).toBe(1);
    writeDefaultSpeed(0.75);
    expect(readDefaultSpeed()).toBe(0.75);
  });

  it('the place is remembered once, for the same part only', () => {
    rememberPlace('sv1', 'n1', 3);
    expect(takePlace('sv1', 'n2')).toBeNull();
    rememberPlace('sv1', 'n1', 3);
    expect(takePlace('sv1', 'n1')).toBe(3);
    expect(takePlace('sv1', 'n1')).toBeNull();
  });

  it('settings links carry the story when opened from the player', () => {
    expect(radioSettingsHref('zh')).toBe('/zh/radio/settings');
    expect(radioSettingsHref('zh', { saveId: 'sv1', from: 'studio' })).toBe('/zh/radio/settings?save=sv1&from=studio');
  });
});

describe('RadioSettingsScreen', () => {
  it('shows the stored settings, with defaults for what was never set', async () => {
    await settings();
    expect(checked('band')).toBe('B1');
    expect(checked('en-ratio')).toBe('0.4');
    expect(Array.from(container.querySelectorAll('[data-testid="radio-settings-en-ratio"] [role="radio"]')).map((b) => b.textContent)).toEqual(['30%', '40%', '50%']);
    expect(checked('voice')).toBe('en_gb_f1'); // profile.voice_id, not the first in the list
    expect(Array.from(container.querySelectorAll('[data-testid="radio-settings-voice"] [role="radio"]')).map((b) => b.getAttribute('data-value'))).toEqual(HOME.voices);
    expect(checked('speed')).toBe('1');
    expect(q('radio-listen')?.getAttribute('aria-checked')).toBe('false'); // off until the user turns it on
    expect(q('radio-bgm')).toBeNull(); // no music available → the whole group is hidden
  });

  it('changing the level sends only band_override; the answer shows the new default share', async () => {
    m.prefs.mockResolvedValue(ok({ band_override: 'B2' }, { band: 'B2', en_ratio: 0.6 }));
    await settings();
    await click(opt('band', 'B2'));
    expect(m.prefs).toHaveBeenCalledWith({ band_override: 'B2' });
    expect(checked('band')).toBe('B2');
    expect(checked('en-ratio')).toBe('0.6');
    expect(m.setHome).toHaveBeenCalled();
  });

  it('English share and voice: only that setting is sent', async () => {
    m.prefs.mockResolvedValueOnce(ok({ en_ratio_override: 0.5 }, { en_ratio: 0.5 })).mockResolvedValueOnce(ok({ voice_id: 'en_us_m1' }));
    await settings();
    await click(opt('en-ratio', '0.5'));
    expect(m.prefs).toHaveBeenLastCalledWith({ en_ratio_override: 0.5 });
    await click(opt('voice', 'en_us_m1'));
    expect(m.prefs).toHaveBeenLastCalledWith({ voice_id: 'en_us_m1' });
    expect(checked('voice')).toBe('en_us_m1');
  });

  it('a refused change (422): saveFailed, and the control goes back', async () => {
    m.prefs.mockResolvedValue({ success: false, status: 422, errorCode: 'invalid_request' });
    await settings();
    await click(opt('voice', 'en_us_m1'));
    expect(m.toast).toHaveBeenCalledWith('radio.settings.saveFailed');
    expect(checked('voice')).toBe('en_gb_f1');
  });

  it('busy: the same change is resent after Retry-After', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    m.prefs.mockResolvedValueOnce({ success: false, status: 503, errorCode: 'busy', retryAfter: 1 }).mockResolvedValueOnce(ok({ voice_id: 'en_us_m1' }));
    await settings();
    await click(opt('voice', 'en_us_m1'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(m.prefs).toHaveBeenCalledTimes(2);
    expect(m.prefs.mock.calls[1][0]).toEqual(m.prefs.mock.calls[0][0]);
    expect(checked('voice')).toBe('en_us_m1');
  });

  it('the default speed is saved on the device, not sent', async () => {
    await settings();
    await click(opt('speed', '0.75'));
    expect(readDefaultSpeed()).toBe(0.75);
    expect(m.prefs).not.toHaveBeenCalled();
  });

  it('background music shows when there is music: on by default; turning it off sends bgm_on false', async () => {
    m.bgm.mockResolvedValue({ success: true, data: { tracks: [{ track_id: 't1', title: 'Rain', audio_url: 'https://m/1.mp3' }] } });
    m.prefs.mockResolvedValue(ok({ bgm_on: false }));
    await settings();
    expect(q('radio-bgm')?.getAttribute('aria-checked')).toBe('true');
    expect((q('radio-bgm-level') as HTMLInputElement).value).toBe('-18');
    await click(q('radio-bgm'));
    expect(m.prefs).toHaveBeenCalledWith({ bgm_on: false });
  });

  it('"Listen at choices" on asks for the microphone, then saves true', async () => {
    const stop = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) },
    });
    m.prefs.mockResolvedValue(ok({ listen_window_on: true }));
    await settings();
    await click(q('radio-listen'));
    expect(stop).toHaveBeenCalled(); // asked, then released at once
    expect(m.prefs).toHaveBeenCalledWith({ listen_window_on: true });
    expect(q('radio-listen')?.getAttribute('aria-checked')).toBe('true');
  });

  it('"Listen at choices" with the microphone blocked: stays off, the help shows under it, nothing is saved', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'NotAllowedError' })) },
    });
    await settings();
    await click(q('radio-listen'));
    expect(q('radio-listen')?.getAttribute('aria-checked')).toBe('false');
    expect(q('radio-blocked-help')?.textContent).toContain('radio.mic.blockedHelp.desktop');
    expect(m.prefs).not.toHaveBeenCalled();
  });

  it('clear radio memory: confirmed first; Cancel changes nothing', async () => {
    await settings();
    await click(q('radio-clear-memory'));
    expect(q('radio-clear-dialog')?.textContent).toContain('radio.settings.clearMemoryConfirm');
    await click(Array.from(q('radio-clear-dialog')!.querySelectorAll('button')).find((b) => b.textContent === 'radio.cancel')!);
    expect(q('radio-clear-dialog')).toBeNull();
    expect(m.memory).not.toHaveBeenCalled();
  });

  it('clear radio memory: 204 → cleared toast, the home is read again, and the radio home opens', async () => {
    m.memory.mockResolvedValue({ success: true });
    await settings();
    await click(q('radio-clear-memory'));
    await click(q('radio-clear-confirm'));
    expect(m.memory).toHaveBeenCalledTimes(1);
    expect(m.toast).toHaveBeenCalledWith('radio.settings.cleared');
    expect(m.refresh).toHaveBeenCalled();
    expect(m.replace).toHaveBeenCalledWith('/zh/radio');
  });

  it('clear radio memory: any other failure → clearFailed', async () => {
    m.memory.mockResolvedValue({ success: false, errorCode: 'NETWORK_ERROR' });
    await settings();
    await click(q('radio-clear-memory'));
    await click(q('radio-clear-confirm'));
    expect(m.toast).toHaveBeenCalledWith('radio.settings.clearFailed');
    expect(q('radio-clear-dialog')).toBeNull();
  });

  it('back: to the player when opened from it, else to the radio home', async () => {
    await settings({ saveId: 'sv1' });
    expect(container.querySelector('a[href="/zh/radio/story/sv1"]')).not.toBeNull();
    act(() => root.unmount());
    root = createRoot(container);
    await settings();
    expect(container.querySelector('a[href="/zh/radio"]')).not.toBeNull();
  });

  it('the status cannot be read (deep link, network error): offline with retry, not an endless skeleton', async () => {
    m.access = 'unknown';
    m.home = null;
    await settings();
    expect(q('radio-settings-loading')).toBeNull();
    expect(q('radio-settings-error')?.textContent).toContain('radio.offline');
    await click(q('radio-settings-error')!.querySelector('button'));
    expect(m.refresh).toHaveBeenCalled();
  });

  it('not open to this user: goes to Studio', async () => {
    m.access = 'closed';
    m.home = null;
    await settings();
    expect(m.replace).toHaveBeenCalledWith('/zh/clinic/hub');
  });
});

describe('the player and settings', () => {
  const resp = (): RadioPlayerResponse => ({
    save_id: 'sv1',
    save_version: 3,
    status: 'active',
    profile,
    ai_calls_used: 0,
    listen_window_ms: null,
    node: {
      node_id: 'n1',
      node_type: 'narration',
      render_id: 'r1',
      source: 'cache',
      segments: [1, 2, 3].map((seq) => ({ seq, lang: 'en' as const, text: `s${seq}`, audio_url: `https://a/${seq}.mp3`, pending: false })),
      choices: [],
    },
  });

  it("the header shows the story's name; More → settings carries the story and remembers the sentence", async () => {
    m.save.mockResolvedValue({ success: true, data: resp() });
    await mount(<StoryPlayerScreen locale="zh" saveId="sv1" from="studio" />);
    expect(q('radio-title')?.textContent).toBe('雨夜来客');
    await act(async () => FakeAudio.all[0].onended?.()); // now on sentence 2
    await click(q('radio-player-more'));
    const link = q('radio-player-settings') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/zh/radio/settings?save=sv1&from=studio');
    await click(link);
    expect(takePlace('sv1', 'n1')).toBe(1);
  });

  it('back from settings: the part resumes from the sentence where it stopped', async () => {
    rememberPlace('sv1', 'n1', 2);
    m.save.mockResolvedValue({ success: true, data: resp() });
    await mount(<StoryPlayerScreen locale="zh" saveId="sv1" from="home" />);
    expect(FakeAudio.all[0].src).toBe('https://a/3.mp3');
  });

  it('the default speed from settings is used by the player', async () => {
    writeDefaultSpeed(0.75);
    m.save.mockResolvedValue({ success: true, data: resp() });
    await mount(<StoryPlayerScreen locale="zh" saveId="sv1" from="home" />);
    expect(FakeAudio.all[0].playbackRate).toBe(0.75);
  });

  it('More → Save sends the save command and says so, without restarting the sentence', async () => {
    m.save.mockResolvedValue({ success: true, data: resp() });
    m.turn.mockResolvedValue({ success: true, data: { ...resp(), node: null, parsed: { kind: 'command', command: 'save', via: 'tap' } } });
    await mount(<StoryPlayerScreen locale="zh" saveId="sv1" from="home" />);
    const before = FakeAudio.all[0].src;
    await click(q('radio-player-more'));
    await click(q('radio-player-save'));
    expect(m.turn.mock.calls[0][3]).toEqual({ kind: 'command', command: 'save' });
    expect(m.toast).toHaveBeenCalledWith('radio.player.saved');
    expect(FakeAudio.all[0].src).toBe(before);
    expect(FakeAudio.all[0].paused).toBe(false);
  });

  it('a story not in the cached home yet: the home is read again once; the title falls back meanwhile', async () => {
    m.home = { ...HOME, continue_listening: [] };
    m.save.mockResolvedValue({ success: true, data: resp() });
    await mount(<StoryPlayerScreen locale="zh" saveId="sv1" from="home" />);
    expect(q('radio-title')?.textContent).toBe('radio.player.title');
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });
});
