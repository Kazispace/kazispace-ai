/**
 * @vitest-environment jsdom
 *
 * KAZIOP-3 (Owen, 2026-11-04): the web rail's three icons had no labels, no clear active
 * state, and Studio was a folder. kazispace-ui D31 / component "Navigation rail": each
 * destination shows its icon on a pill with its label below, the current one on a filled
 * pill; panel tools never look like a destination; the tab bar uses the same icons.
 * KAZI-1485 (D36): five destinations, Exam · Radio · Scenes · Messages · Me.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Drama, FolderOpen, GraduationCap, Inbox, LayoutGrid, Radio, User } from 'lucide-react';

const pathnameRef = vi.hoisted(() => ({ value: '/zh/clinic/hub' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathnameRef.value }));
vi.mock('next-intl', () => ({ useTranslations: (ns: string) => (key: string) => `${ns}.${key}` }));
vi.mock('@/lib/perf/nav-intent', () => ({ markNavIntent: () => {} }));
vi.mock('@/components/session-nav/session-nav-primary-chrome', () => ({ SessionIconRailCredits: () => null }));

import { SessionIconRail } from '@/components/session-nav/session-icon-rail';
import { TOP_LEVEL_ICONS } from '@/components/navigation/top-level-icons';

describe('KAZIOP-3 navigation rail', () => {
  let root: Root;
  let host: HTMLDivElement;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    root = createRoot(host);
  });
  afterEach(() => act(() => root.unmount()));

  const render = (pathname: string, panelOpen = true) => {
    pathnameRef.value = pathname;
    act(() =>
      root.render(
        <SessionIconRail
          locale="zh"
          panelOpen={panelOpen}
          panelMode="agents"
          onToggleAgentsPanel={() => {}}
          onOpenFilesPanel={() => {}}
          onOpenSearchPanel={() => {}}
          onOpenMobileDrawer={() => {}}
        />
      )
    );
  };

  it('is the main navigation landmark, named like the tab bar', () => {
    render('/zh/clinic/hub');
    expect(host.querySelector('nav')?.getAttribute('aria-label')).toBe('nav.primary');
  });

  it('shows a label under each destination, in D36 order', () => {
    render('/zh/clinic/hub');
    const links = Array.from(host.querySelectorAll('a[data-testid^="rail-"]'));
    expect(links.map((a) => a.getAttribute('data-testid'))).toEqual([
      'rail-exam',
      'rail-radio',
      'rail-scenes',
      'rail-messages',
      'rail-me',
    ]);
    expect(links.map((a) => a.textContent)).toEqual([
      'nav.exam',
      'nav.radio',
      'nav.scenes',
      'nav.messages',
      'nav.me',
    ]);
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      expect.stringMatching(/^\/zh\/(spaces|chat)$/),
      '/zh/radio',
      '/zh/scenes',
      '/zh/messages',
      '/zh/mine',
    ]);
  });

  it.each([
    ['/zh/chat', 'exam'],
    ['/zh/radio', 'radio'],
    ['/zh/scenes', 'scenes'],
    ['/zh/messages', 'messages'],
    ['/zh/mine', 'me'],
    // Studio is a sub-screen of Me (D36).
    ['/zh/clinic/hub', 'me'],
  ])('on %s only %s is current, on a filled pill', (pathname, current) => {
    render(pathname);
    const currentLinks = Array.from(host.querySelectorAll('a[aria-current="page"]'));
    expect(currentLinks.map((a) => a.getAttribute('data-testid'))).toEqual([`rail-${current}`]);
    const pills = host.querySelectorAll('[data-testid="rail-pill"]');
    expect(pills).toHaveLength(1);
    expect(currentLinks[0].contains(pills[0])).toBe(true);
    expect(pills[0].className).toContain('bg-primary');
  });

  it('an open panel tool is a neutral fill, never the pill or the old blue side bar', () => {
    render('/zh/chat', true);
    const tool = host.querySelector('button[aria-label="sessionNav.agents"]')!;
    expect(tool.className).toContain('bg-workspace-hover');
    expect(tool.className).not.toMatch(/bg-primary|before:bg-primary|text-primary/);
  });

  it('rail and tab bar share the icons: no folder, no grid', () => {
    expect(TOP_LEVEL_ICONS).toEqual({
      exam: GraduationCap,
      radio: Radio,
      scenes: Drama,
      messages: Inbox,
      me: User,
    });
    expect(Object.values(TOP_LEVEL_ICONS)).not.toContain(FolderOpen);
    expect(Object.values(TOP_LEVEL_ICONS)).not.toContain(LayoutGrid);
    for (const rel of ['../navigation/bottom-tab-bar.tsx', './session-icon-rail.tsx']) {
      const src = readFileSync(path.resolve(__dirname, rel), 'utf8');
      expect(src).toMatch(/TOP_LEVEL_ICONS/);
      expect(src).not.toMatch(/FolderOpen/);
    }
  });
});
