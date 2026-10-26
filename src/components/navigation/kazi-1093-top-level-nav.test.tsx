/**
 * @vitest-environment jsdom
 *
 * KAZI-1093 — top-level navigation (kazispace-ui decisions D2, D20).
 *
 * ❌ Former: Chat · Studio · Me, Chat opening the main chat.
 * ✅ KAZI-1171 (Owen 2026-10-26): Space · Studio · Me. Space opens the Space list (`/spaces`);
 * with Spaces off it falls back to the main chat, the only conversation there is.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  TOP_LEVEL_DESTINATIONS,
  isTopLevelScreen,
  resolveTopLevelDestination,
  subscriptionHref,
  topLevelHref,
} from '@/lib/top-level-nav';

const pathnameRef = vi.hoisted(() => ({ value: '/en/chat' }));

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameRef.value,
}));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => `nav.${key}`,
}));
vi.mock('@/lib/perf/nav-intent', () => ({ markNavIntent: () => {} }));
const uiRef = vi.hoisted(() => ({ isTelegramMiniApp: false }));
vi.mock('@/lib/store', () => ({
  useUIStore: (select: (s: { isTelegramMiniApp: boolean }) => unknown) => select(uiRef),
}));

import { BottomTabBar } from '@/components/navigation/bottom-tab-bar';

describe('resolveTopLevelDestination', () => {
  it.each([
    ['/en/chat', 'space'],
    ['/en/spaces/abc', 'space'],
    ['/en/interview', 'space'],
    ['/en/clinic/hub', 'studio'],
    ['/en/mine', 'me'],
    ['/en/profile', 'me'],
    ['/en/credits', 'me'],
    ['/en/subscription', 'me'],
  ])('%s → %s', (path, expected) => {
    expect(resolveTopLevelDestination(path, 'en')).toBe(expected);
  });

  it('keeps the D2 order and targets', () => {
    vi.stubEnv('NEXT_PUBLIC_SPACES_ENABLED', 'true');
    expect(TOP_LEVEL_DESTINATIONS).toEqual(['space', 'studio', 'me']);
    expect(TOP_LEVEL_DESTINATIONS.map((d) => topLevelHref('ru', d))).toEqual([
      '/ru/spaces',
      '/ru/clinic/hub',
      '/ru/mine',
    ]);
    vi.unstubAllEnvs();
  });

  it('Space falls back to the main chat when Spaces are off', () => {
    vi.stubEnv('NEXT_PUBLIC_SPACES_ENABLED', 'false');
    expect(topLevelHref('ru', 'space')).toBe('/ru/chat');
    vi.unstubAllEnvs();
  });
});

describe('subscriptionHref', () => {
  it('marks the Chat entry path so back returns to Chat (page header spec 0.2)', () => {
    expect(subscriptionHref('en')).toBe('/en/subscription');
    expect(subscriptionHref('en', { fromChat: true })).toBe('/en/subscription?return=chat');
    expect(isTopLevelScreen('/en/subscription', 'en')).toBe(false);
  });
});

describe('the Me destination has one name', () => {
  // Owen 2026-10-16: the chat header's "Profile" link is renamed to "Me", so every
  // entry to /mine uses the tab's own key and the old nav.profile key is gone.
  it('has no separate nav.profile label in any locale', async () => {
    for (const locale of ['en', 'ru', 'kk', 'uz', 'zh']) {
      const messages = (await import(`@/lib/i18n/${locale}.json`)).default as {
        nav: Record<string, string>;
      };
      expect(messages.nav).not.toHaveProperty('profile');
      expect(messages.nav.me).toBeTruthy();
    }
  });
});

describe('the first tab is Space (KAZI-1171)', () => {
  it('has nav.space in every locale', async () => {
    const expected: Record<string, string> = { en: 'Spaces', zh: '空间' };
    for (const locale of ['en', 'ru', 'kk', 'uz', 'zh']) {
      const messages = (await import(`@/lib/i18n/${locale}.json`)).default as {
        nav: Record<string, string>;
      };
      expect(messages.nav.space).toBeTruthy();
      if (expected[locale]) expect(messages.nav.space).toBe(expected[locale]);
    }
  });
});

describe('the middle tab is Studio (D20)', () => {
  it('has nav.studio and no nav.assets in every locale', async () => {
    const expected: Record<string, string> = { en: 'Studio', zh: '工作室' };
    for (const locale of ['en', 'ru', 'kk', 'uz', 'zh']) {
      const messages = (await import(`@/lib/i18n/${locale}.json`)).default as {
        nav: Record<string, string>;
      };
      expect(messages.nav).not.toHaveProperty('assets');
      expect(messages.nav.studio).toBeTruthy();
      if (expected[locale]) expect(messages.nav.studio).toBe(expected[locale]);
    }
  });
});

describe('isTopLevelScreen', () => {
  it.each([
    ['/en/chat', true],
    ['/en/spaces/abc', true],
    ['/en/clinic/hub', true],
    ['/en/mine', true],
    ['/en/profile', false],
    ['/en/credits', false],
    ['/en/ledger', false],
    ['/en/subscription', false],
    ['/en/jobs', false],
    ['/en/jobs/42', false],
  ])('%s → %s', (path, expected) => {
    expect(isTopLevelScreen(path, 'en')).toBe(expected);
  });
});

describe('BottomTabBar', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const tabs = () => Array.from(container.querySelectorAll('nav[data-testid="bottom-tab-bar"] a'));

  it('renders Space · Studio · Me with the current destination selected', () => {
    vi.stubEnv('NEXT_PUBLIC_SPACES_ENABLED', 'true');
    pathnameRef.value = '/en/clinic/hub';
    act(() => root.render(<BottomTabBar locale="en" />));
    expect(tabs().map((tab) => tab.textContent)).toEqual(['nav.space', 'nav.studio', 'nav.me']);
    expect(tabs().map((tab) => tab.getAttribute('aria-current'))).toEqual([null, 'page', null]);
    // Page navigation, not a tab widget (kazispace-ui tab bar spec 0.2).
    expect(container.querySelector('[role="tab"], [role="tablist"], [aria-selected]')).toBeNull();
    expect(tabs().map((tab) => tab.getAttribute('href'))).toEqual([
      '/en/spaces',
      '/en/clinic/hub',
      '/en/mine',
    ]);
    vi.unstubAllEnvs();
  });

  it('marks Space current in a Space and in the main chat', () => {
    for (const path of ['/en/spaces/sp_1', '/en/chat']) {
      pathnameRef.value = path;
      act(() => root.render(<BottomTabBar locale="en" />));
      expect(tabs().map((tab) => tab.getAttribute('aria-current'))).toEqual(['page', null, null]);
    }
  });

  it('is hidden on a sub-screen, which uses back navigation instead', () => {
    pathnameRef.value = '/en/credits';
    act(() => root.render(<BottomTabBar locale="en" />));
    expect(container.querySelector('[data-testid="bottom-tab-bar"]')).toBeNull();
  });

  it('is not shown inside the Telegram Mini App (D3)', () => {
    pathnameRef.value = '/en/chat';
    uiRef.isTelegramMiniApp = true;
    act(() => root.render(<BottomTabBar locale="en" />));
    expect(container.querySelector('[data-testid="bottom-tab-bar"]')).toBeNull();
    uiRef.isTelegramMiniApp = false;
  });

  it('hides while a text field has focus (on-screen keyboard) and returns on blur', () => {
    pathnameRef.value = '/en/chat';
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    act(() => root.render(<BottomTabBar locale="en" />));
    expect(container.querySelector('[data-testid="bottom-tab-bar"]')).not.toBeNull();

    act(() => textarea.focus());
    expect(container.querySelector('[data-testid="bottom-tab-bar"]')).toBeNull();

    act(() => textarea.blur());
    expect(container.querySelector('[data-testid="bottom-tab-bar"]')).not.toBeNull();
    textarea.remove();
  });

  it('has its own warm background and marks the current destination with a pill (D24)', () => {
    pathnameRef.value = '/en/clinic/hub';
    act(() => root.render(<BottomTabBar locale="en" />));
    const nav = container.querySelector('[data-testid="bottom-tab-bar"]')!;
    expect(nav.className).toContain('bg-tab-bar-bg');
    expect(nav.className).toContain('border-tab-bar-border');
    expect(nav.className).not.toContain('bg-white');
    const pills = container.querySelectorAll('[data-testid="tab-bar-pill"]');
    expect(pills.length).toBe(1);
    expect(pills[0].className).toContain('text-tab-bar-icon-active');
    expect(pills[0].closest('a')!.getAttribute('aria-current')).toBe('page');
    expect(pills[0].closest('a')!.textContent).toBe('nav.studio');
  });
});
