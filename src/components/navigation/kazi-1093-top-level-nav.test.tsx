/**
 * @vitest-environment jsdom
 *
 * KAZI-1093 — top-level navigation (kazispace-ui decisions D2, D20).
 *
 * ❌ Former: Chat · Studio · Me, Chat opening the main chat.
 * ❌ KAZI-1171 (Owen 2026-10-26): Space · Studio · Me.
 * ✅ KAZI-1485 (Owen 2026-11-26, kazispace-ui D36): Exam · Radio · Scenes · Messages · Me. Exam
 * opens the English Space (`/spaces?template=ielts_prep`); with Spaces off it falls back to the
 * main chat. Studio is a sub-screen of Me.
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
    ['/en/chat', 'exam'],
    ['/en/spaces/abc', 'exam'],
    ['/en/interview', 'exam'],
    ['/en/clinic/hub', 'me'],
    ['/en/radio', 'radio'],
    ['/en/radio/story/s1', 'radio'],
    ['/en/scenes', 'scenes'],
    ['/en/messages', 'messages'],
    ['/en/mine', 'me'],
    ['/en/profile', 'me'],
    ['/en/credits', 'me'],
    ['/en/subscription', 'me'],
  ])('%s → %s', (path, expected) => {
    expect(resolveTopLevelDestination(path, 'en')).toBe(expected);
  });

  it('keeps the D36 order and targets', () => {
    vi.stubEnv('NEXT_PUBLIC_SPACES_ENABLED', 'true');
    expect(TOP_LEVEL_DESTINATIONS).toEqual(['exam', 'radio', 'scenes', 'messages', 'me']);
    expect(TOP_LEVEL_DESTINATIONS.map((d) => topLevelHref('ru', d))).toEqual([
      '/ru/spaces?template=ielts_prep',
      '/ru/radio',
      '/ru/scenes',
      '/ru/messages',
      '/ru/mine',
    ]);
    vi.unstubAllEnvs();
  });

  it('Exam falls back to the main chat when Spaces are off', () => {
    vi.stubEnv('NEXT_PUBLIC_SPACES_ENABLED', 'false');
    expect(topLevelHref('ru', 'exam')).toBe('/ru/chat');
    vi.unstubAllEnvs();
  });
});

describe('subscriptionHref', () => {
  it('marks the Chat entry path so back returns to Chat (page header spec 0.2)', () => {
    expect(subscriptionHref('en')).toBe('/en/subscription');
    expect(subscriptionHref('en', { fromChat: true })).toBe('/en/subscription?return=chat');
    expect(subscriptionHref('en', { fromRadio: true })).toBe('/en/subscription?return=radio');
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

describe('the five tab labels (D36)', () => {
  it('has every destination label, one line of 10 characters or fewer, in every locale', async () => {
    // Owen's own tab names (KAZI-1485): 考试， 电台， 场景， 消息， 我的.
    const zh = { exam: '考试', radio: '电台', scenes: '场景', messages: '消息', me: '我的' };
    for (const locale of ['en', 'ru', 'kk', 'uz', 'zh']) {
      const messages = (await import(`@/lib/i18n/${locale}.json`)).default as {
        nav: Record<string, string>;
      };
      for (const destination of TOP_LEVEL_DESTINATIONS) {
        const label = messages.nav[destination];
        expect(label, `${locale} nav.${destination}`).toBeTruthy();
        expect(label.length, `${locale} nav.${destination}`).toBeLessThanOrEqual(10);
      }
      if (locale === 'zh') {
        for (const [key, value] of Object.entries(zh)) expect(messages.nav[key]).toBe(value);
      }
      // Studio keeps its key: Me's Studio row and Studio's own name use it.
      expect(messages.nav).not.toHaveProperty('assets');
      expect(messages.nav.studio).toBeTruthy();
    }
  });
});

describe('isTopLevelScreen', () => {
  it.each([
    ['/en/chat', true],
    ['/en/spaces/abc', true],
    ['/en/clinic/hub', false],
    ['/en/radio', true],
    ['/en/radio/story/s1', false],
    ['/en/radio/settings', false],
    ['/en/scenes', true],
    ['/en/messages', true],
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

  it('renders Exam · Radio · Scenes · Messages · Me with the current destination selected', () => {
    vi.stubEnv('NEXT_PUBLIC_SPACES_ENABLED', 'true');
    pathnameRef.value = '/en/radio';
    act(() => root.render(<BottomTabBar locale="en" />));
    expect(tabs().map((tab) => tab.textContent)).toEqual([
      'nav.exam',
      'nav.radio',
      'nav.scenes',
      'nav.messages',
      'nav.me',
    ]);
    expect(tabs().map((tab) => tab.getAttribute('aria-current'))).toEqual([
      null,
      'page',
      null,
      null,
      null,
    ]);
    // Page navigation, not a tab widget (kazispace-ui tab bar spec 0.2).
    expect(container.querySelector('[role="tab"], [role="tablist"], [aria-selected]')).toBeNull();
    expect(tabs().map((tab) => tab.getAttribute('href'))).toEqual([
      '/en/spaces?template=ielts_prep',
      '/en/radio',
      '/en/scenes',
      '/en/messages',
      '/en/mine',
    ]);
    vi.unstubAllEnvs();
  });

  it('marks Exam current in a Space and in the main chat', () => {
    for (const path of ['/en/spaces/sp_1', '/en/chat']) {
      pathnameRef.value = path;
      act(() => root.render(<BottomTabBar locale="en" />));
      expect(tabs().map((tab) => tab.getAttribute('aria-current'))).toEqual(['page', null, null, null, null]);
    }
  });

  // #312 review 🟡3: five cells are 64px each at 320px; ru "Сообщения" is 68.8px at 12px Inter.
  // Labels stay on one line, uncut; below 360px they are 11px with tight tracking (60.6px).
  it('keeps each label on one line, smaller below 360px, never truncated', () => {
    pathnameRef.value = '/en/chat';
    act(() => root.render(<BottomTabBar locale="en" />));
    for (const tab of tabs()) {
      expect(tab.className).toContain('whitespace-nowrap');
      expect(tab.className).toContain('text-[11px]');
      expect(tab.className).toContain('min-[360px]:text-xs');
      expect(tab.className).not.toContain('truncate');
      expect(tab.parentElement!.className).toContain('min-w-0');
    }
  });

  it('is hidden on Studio, a sub-screen of Me (D36)', () => {
    pathnameRef.value = '/en/clinic/hub';
    act(() => root.render(<BottomTabBar locale="en" />));
    expect(container.querySelector('[data-testid="bottom-tab-bar"]')).toBeNull();
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
    pathnameRef.value = '/en/messages';
    act(() => root.render(<BottomTabBar locale="en" />));
    const nav = container.querySelector('[data-testid="bottom-tab-bar"]')!;
    expect(nav.className).toContain('bg-tab-bar-bg');
    expect(nav.className).toContain('border-tab-bar-border');
    expect(nav.className).not.toContain('bg-white');
    const pills = container.querySelectorAll('[data-testid="tab-bar-pill"]');
    expect(pills.length).toBe(1);
    expect(pills[0].className).toContain('text-tab-bar-icon-active');
    expect(pills[0].closest('a')!.getAttribute('aria-current')).toBe('page');
    expect(pills[0].closest('a')!.textContent).toBe('nav.messages');
  });
});
