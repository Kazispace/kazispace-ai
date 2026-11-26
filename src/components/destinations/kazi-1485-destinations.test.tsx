/**
 * @vitest-environment jsdom
 *
 * KAZI-1485 (Owen 2026-11-26, kazispace-ui D36): the two new destinations.
 * Messages: two sections, My messages then Forum, each with its empty line (no endpoint yet).
 * Scenes: a placeholder, `studio.comingSoon`, nothing to tap.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));

import { MessagesPage } from '@/components/destinations/messages-page';
import { ScenesPage } from '@/components/destinations/scenes-page';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('Messages', () => {
  it('shows My messages then Forum, each with a heading and its empty line', () => {
    act(() => root.render(<MessagesPage />));
    expect(container.querySelector('h1')?.textContent).toBe('nav.messages');
    const sections = Array.from(container.querySelectorAll('section'));
    expect(sections.map((el) => el.querySelector('h2')?.textContent)).toEqual([
      'messages.personal',
      'messages.forum',
    ]);
    expect(sections[0].textContent).toContain('messages.personalEmpty');
    expect(sections[1].textContent).toContain('messages.forumEmpty');
    // Each section is named by its heading.
    for (const el of sections) {
      const id = el.getAttribute('aria-labelledby');
      expect(id && container.querySelector(`#${id}`)?.tagName).toBe('H2');
    }
  });
});

describe('Scenes', () => {
  it('is a placeholder with nothing to tap', () => {
    act(() => root.render(<ScenesPage />));
    expect(container.querySelector('h1')?.textContent).toBe('nav.scenes');
    expect(container.querySelector('[data-testid="scenes-coming-soon"]')?.textContent).toBe('studio.comingSoon');
    expect(container.querySelector('a, button')).toBeNull();
  });
});

describe('copy', () => {
  it('has the Messages and Exam keys in every locale', async () => {
    for (const locale of ['en', 'ru', 'kk', 'uz', 'zh']) {
      const messages = (await import(`@/lib/i18n/${locale}.json`)).default as Record<
        string,
        Record<string, unknown>
      >;
      for (const key of ['personal', 'forum', 'personalEmpty', 'forumEmpty', 'unread']) {
        expect(messages.messages[key], `${locale} messages.${key}`).toBeTruthy();
      }
      expect((messages.exam.mode as Record<string, string>).chat).toBeTruthy();
      expect((messages.exam.mode as Record<string, string>).form).toBeTruthy();
    }
  });
});
