/**
 * @vitest-environment jsdom
 *
 * KAZI-1093 — top-level navigation Chat · Assets · Me (kazispace-ui decisions D2).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  TOP_LEVEL_DESTINATIONS,
  resolveTopLevelDestination,
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
    ['/en/chat', 'chat'],
    ['/en/spaces/abc', 'chat'],
    ['/en/interview', 'chat'],
    ['/en/english/passport', 'chat'],
    ['/en/clinic/hub', 'assets'],
    ['/en/mine', 'me'],
    ['/en/profile', 'me'],
    ['/en/credits', 'me'],
    ['/en/subscription', 'me'],
  ])('%s → %s', (path, expected) => {
    expect(resolveTopLevelDestination(path, 'en')).toBe(expected);
  });

  it('keeps the D2 order and targets', () => {
    expect(TOP_LEVEL_DESTINATIONS).toEqual(['chat', 'assets', 'me']);
    expect(TOP_LEVEL_DESTINATIONS.map((d) => topLevelHref('ru', d))).toEqual([
      '/ru/chat',
      '/ru/clinic/hub',
      '/ru/mine',
    ]);
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

  const tabs = () => Array.from(container.querySelectorAll('[role="tab"]'));

  it('renders Chat · Assets · Me with the current destination selected', () => {
    pathnameRef.value = '/en/clinic/hub';
    act(() => root.render(<BottomTabBar locale="en" />));
    expect(tabs().map((tab) => tab.textContent)).toEqual(['nav.chat', 'nav.assets', 'nav.me']);
    expect(tabs().map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect(tabs().map((tab) => tab.getAttribute('href'))).toEqual([
      '/en/chat',
      '/en/clinic/hub',
      '/en/mine',
    ]);
  });

  it('is not shown inside the Telegram Mini App (D3)', () => {
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
});
