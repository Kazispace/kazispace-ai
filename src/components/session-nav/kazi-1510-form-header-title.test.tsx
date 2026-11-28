/**
 * @vitest-environment jsdom
 *
 * KAZI-1510 — Exam's Form mode has a fixed header title. Owen, 2026-11-28, quoted as written: "标题可以固定".
 * With `fixedTitle` the header shows that title (the Form tab's name, 「表单」), not the open chat's name, and
 * none of the chat's own controls (status, subtitle, workspace rail, files / search / more); the locale switcher
 * stays. Without it, the header is the chat header of KAZI-1485 (pinned in kazi-1485-context-header-title.test).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { AGENT_REGISTRY, getAgentLabel } from '@/lib/agents/registry';
import { MOCK_INTERVIEW_AGENT_ID } from '@/lib/mock-interview-config';
import type { SpaceDetail } from '@/types/spaces';

const pathnameRef = vi.hoisted(() => ({ value: '/zh/chat' }));
const spaceRef = vi.hoisted(() => ({ value: null as unknown }));

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameRef.value,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// Real-looking strings for the keys the title reads; every other key echoes itself.
vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => {
    if (ns === 'spaces' && key === 'templateIelts') return '雅思备考';
    if (ns === 'sessionNav' && key === 'clinic') return 'Clinic';
    if (ns === 'nav' && key === 'exam') return '考试';
    return key;
  },
}));

vi.mock('@/hooks/use-space-detail', () => ({
  useSpaceDetail: () => ({ space: spaceRef.value, refresh: vi.fn() }),
}));
vi.mock('@/hooks/use-space-lifecycle', () => ({
  useSpaceLifecycle: () => ({ run: vi.fn(), pendingAction: null }),
}));
vi.mock('@/hooks/use-session-library', () => ({
  useSessionFiles: () => ({ files: [], isLoading: false }),
  useSessionMessageSearch: () => ({ hits: [], isLoading: false, error: null }),
}));
vi.mock('@/components/session-nav/session-header-drawer', () => ({ SessionHeaderDrawer: () => null }));
vi.mock('@/components/ui/confirm-dialog', () => ({ ConfirmDialog: () => null }));
vi.mock('@/components/locale/locale-switcher', () => ({ LocaleSwitcher: () => <span data-testid="locale-switcher" /> }));

let SessionContextHeader: typeof import('./session-context-header').SessionContextHeader;

beforeAll(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  ({ SessionContextHeader } = await import('./session-context-header'));
});

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  spaceRef.value = null;
});

function render(pathname: string, spaceId: string | null, fixedTitle: string | null) {
  pathnameRef.value = pathname;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      <SessionContextHeader locale="zh" sessionsByAgent={new Map()} spaceId={spaceId} fixedTitle={fixedTitle} />
    );
  });
  return host;
}

const SPACE = {
  id: 'sp_1',
  template_id: 'ielts_prep',
  name: '雅思备考 · 11月27日',
  status: 'active',
  is_system: false,
  is_entry_point: false,
  last_active_at: '2026-11-27T12:00:00Z',
  space_state: {},
} as unknown as SpaceDetail;

describe('Form mode header title (KAZI-1510)', () => {
  it('shows the fixed title instead of the open space\'s name, with none of the chat\'s controls', () => {
    spaceRef.value = SPACE;
    const el = render('/zh/spaces/sp_1', 'sp_1', '表单');
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('表单');
    expect(el.textContent).not.toContain('雅思备考');
    expect(el.querySelector('[data-testid="context-header-subtitle"]')).toBeNull();
    expect(el.querySelectorAll('header button').length).toBe(0); // no rail / files / search / more
    expect(el.querySelector('[data-testid="locale-switcher"]')).not.toBeNull();
  });

  it('the clinic header too: fixed title, no subtitle', () => {
    const el = render('/zh/chat', null, '表单');
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('表单');
    expect(el.querySelector('[data-testid="context-header-subtitle"]')).toBeNull();
  });

  it('without it, the header still shows the open chat\'s name (Chat mode)', () => {
    spaceRef.value = SPACE;
    const el = render('/zh/spaces/sp_1', 'sp_1', null);
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('雅思备考 · 11月27日');
  });
});
