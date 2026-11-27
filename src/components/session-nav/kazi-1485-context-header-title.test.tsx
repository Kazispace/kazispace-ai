/**
 * @vitest-environment jsdom
 *
 * KAZI-1485 — pins the chat header title (kazispace-ui D41, chat header 0.6): the title is the
 * open chat's readable name. A space shows the name the space list shows (D39), so a name nobody
 * chose reads as the type's name and its day, never "ET-44 …" and never a fixed 「考试」.
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
vi.mock('@/components/locale/locale-switcher', () => ({ LocaleSwitcher: () => null }));

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

function renderTitle(pathname: string, spaceId: string | null = null): string {
  pathnameRef.value = pathname;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      <SessionContextHeader locale="zh" sessionsByAgent={new Map()} spaceId={spaceId} />
    );
  });
  return host.querySelector('h1')?.textContent?.trim() ?? '';
}

function englishSpace(name: string): SpaceDetail {
  return {
    id: 'sp_1',
    template_id: 'ielts_prep',
    name,
    status: 'active',
    is_system: false,
    is_entry_point: false,
    last_active_at: '2026-11-27T03:00:00Z',
    space_state: {},
  } as unknown as SpaceDetail;
}

describe('KAZI-1485 chat header title (D41)', () => {
  it('a space with a generated name shows the type name and its day', () => {
    spaceRef.value = englishSpace('ET-44 04:36:41');
    const title = renderTitle('/zh/spaces/sp_1', 'sp_1');
    expect(title).toBe('雅思备考 · 11月27日');
    expect(title).not.toContain('ET-44');
    expect(title).not.toBe('考试');
  });

  it("a space's own name is shown as it is", () => {
    spaceRef.value = englishSpace('我的雅思计划');
    expect(renderTitle('/zh/spaces/sp_1', 'sp_1')).toBe('我的雅思计划');
  });

  it('the main chat shows Clinic', () => {
    expect(renderTitle('/zh/chat')).toBe('Clinic');
  });

  it("a specialist shows the specialist's name", () => {
    const agent = AGENT_REGISTRY.find((a) => a.agentId === MOCK_INTERVIEW_AGENT_ID)!;
    expect(renderTitle('/zh/interview')).toBe(getAgentLabel(agent, 'zh', 'name'));
  });
});
