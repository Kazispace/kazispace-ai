/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { SESSION_NAV_STORAGE_KEY } from '@/lib/session-nav';

const pathnameRef = vi.hoisted(() => ({ value: '/en/chat' }));

const panelLoad = vi.hoisted(() => {
  let resolveMod: ((value: { SessionNavPanel: unknown }) => void) | null = null;
  let promise = new Promise<{ SessionNavPanel: unknown }>((resolve) => {
    resolveMod = resolve;
  });
  const load = vi.fn(() => promise);
  return {
    load,
    reset() {
      load.mockClear();
      promise = new Promise<{ SessionNavPanel: unknown }>((resolve) => {
        resolveMod = resolve;
      });
    },
    resolve() {
      resolveMod?.({
        SessionNavPanel: ({
          open,
          mobileDrawer,
        }: {
          open: boolean;
          mobileDrawer: boolean;
        }) => (
          <aside
            data-testid="session-nav-panel"
            data-open={open ? '1' : '0'}
            data-mobile={mobileDrawer ? '1' : '0'}
            className={open || mobileDrawer ? 'w-[260px]' : 'w-0'}
          />
        ),
      });
      return promise;
    },
  };
});

const fileLoad = vi.hoisted(() => vi.fn(async () => ({ SessionFileLibraryPanel: () => null })));
const searchLoad = vi.hoisted(() => vi.fn(async () => ({ SessionGlobalSearchPanel: () => null })));
const pickerLoad = vi.hoisted(() => vi.fn(async () => ({ SpaceTemplatePicker: () => null })));

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameRef.value,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/lib/telegram', () => ({
  isTelegramWebApp: () => false,
}));

vi.mock('@/lib/session-nav/load-session-nav-panels', () => ({
  loadSessionNavPanel: () => panelLoad.load(),
  loadSessionFileLibraryPanel: () => fileLoad(),
  loadSessionGlobalSearchPanel: () => searchLoad(),
  loadSpaceTemplatePicker: () => pickerLoad(),
}));

vi.mock('@/hooks/use-active-agent-sessions', () => ({
  ActiveAgentSessionsProvider: ({ children }: { children: unknown }) => children,
  useActiveAgentSessions: () => ({
    sessionsByAgent: {},
    isLoading: false,
    error: null,
    refresh: async () => undefined,
  }),
}));

vi.mock('@/hooks/use-spaces', () => ({
  useSpaces: () => ({
    spaces: [],
    isLoading: false,
    error: null,
    refresh: async () => undefined,
  }),
}));

vi.mock('@/hooks/use-agent-session-actions', () => ({
  useAgentSessionActions: () => ({
    requestNewSession: async () => ({ ok: true }),
    confirmAbandonAndNew: async () => ({ ok: true }),
    cancelConfirmAbandon: () => undefined,
    exitSession: async () => ({ success: true }),
    confirmAgentId: null,
    isBusy: false,
  }),
}));

vi.mock('@/hooks/use-space-lifecycle', () => ({
  useSpaceLifecycle: () => ({
    run: async () => ({ ok: true }),
    pendingSpaceId: null,
  }),
}));

vi.mock('@/components/session-nav/session-icon-rail', () => ({
  SessionIconRail: ({
    onToggleAgentsPanel,
    onOpenMobileDrawer,
  }: {
    onToggleAgentsPanel: () => void;
    onOpenMobileDrawer: () => void;
  }) => (
    <div data-testid="icon-rail">
      <button type="button" data-testid="toggle-agents" onClick={onToggleAgentsPanel} />
      <button type="button" data-testid="open-mobile" onClick={onOpenMobileDrawer} />
    </div>
  ),
}));

vi.mock('@/components/session-nav/session-context-header', () => ({
  SessionContextHeader: () => <div data-testid="context-header" />,
}));

vi.mock('@/components/session-nav/confirm-abandon-session-dialog', () => ({
  ConfirmAbandonSessionDialog: () => null,
}));

import { SessionNavShell } from '@/components/session-nav/session-nav-shell';

function installViewport(opts: { desktop: boolean; innerWidth: number }) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: opts.innerWidth,
  });
  window.matchMedia = ((query: string) => {
    const matches = opts.desktop && query.includes('768');
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    };
  }) as typeof window.matchMedia;
}

function reservedColumns(host: HTMLElement) {
  return host.querySelectorAll(
    '[data-testid="session-nav-panel-slot"], [data-testid="session-nav-panel"]'
  );
}

describe('KAZI-578 SessionNav first-paint mount timing', () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  beforeAll(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    localStorage.clear();
    pathnameRef.value = '/en/chat';
    panelLoad.reset();
    fileLoad.mockClear();
    searchLoad.mockClear();
    pickerLoad.mockClear();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    host?.remove();
    root = null;
    host = null;
    localStorage.clear();
  });

  it('does not load the side-list chunk on first paint when panelMode is agents', async () => {
    // Width says "would prefer open", but desktop media is still false (SSR snapshot).
    installViewport({ desktop: false, innerWidth: 1024 });

    await act(async () => {
      root!.render(
        <SessionNavShell locale="en">
          <main data-testid="main-col">chat</main>
        </SessionNavShell>
      );
    });

    expect(panelLoad.load).not.toHaveBeenCalled();
    expect(fileLoad).not.toHaveBeenCalled();
    expect(searchLoad).not.toHaveBeenCalled();
    expect(pickerLoad).not.toHaveBeenCalled();
    expect(reservedColumns(host!).length).toBe(0);
    expect(host!.querySelector('[data-testid="main-col"]')).not.toBeNull();
    expect(host!.querySelector('[data-testid="icon-rail"]')).not.toBeNull();
  });

  it('does not reserve 260px after hydrate when stored panel is closed', async () => {
    localStorage.setItem(SESSION_NAV_STORAGE_KEY, 'false');
    pathnameRef.value = '/en/mine';
    installViewport({ desktop: true, innerWidth: 1280 });

    await act(async () => {
      root!.render(
        <SessionNavShell locale="en">
          <main data-testid="main-col">mine</main>
        </SessionNavShell>
      );
    });

    expect(panelLoad.load).not.toHaveBeenCalled();
    expect(reservedColumns(host!).length).toBe(0);
  });

  it('desktop pinned/open reserves exactly one 260px column and loads the list once', async () => {
    installViewport({ desktop: true, innerWidth: 1280 });
    pathnameRef.value = '/en/chat';

    await act(async () => {
      root!.render(
        <SessionNavShell locale="en">
          <main data-testid="main-col">chat</main>
        </SessionNavShell>
      );
    });

    expect(panelLoad.load).toHaveBeenCalledTimes(1);
    expect(reservedColumns(host!).length).toBe(1);
    expect(host!.querySelector('[data-testid="session-nav-panel-slot"]')).not.toBeNull();

    await act(async () => {
      await panelLoad.resolve();
    });

    expect(reservedColumns(host!).length).toBe(1);
    expect(host!.querySelector('[data-testid="session-nav-panel-slot"]')).toBeNull();
    const panel = host!.querySelector('[data-testid="session-nav-panel"]');
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute('data-open')).toBe('1');
  });

  it('mobile drawer closed does not load the list; opening it does', async () => {
    installViewport({ desktop: false, innerWidth: 375 });
    pathnameRef.value = '/en/chat';

    await act(async () => {
      root!.render(
        <SessionNavShell locale="en">
          <main data-testid="main-col">chat</main>
        </SessionNavShell>
      );
    });

    expect(panelLoad.load).not.toHaveBeenCalled();
    expect(reservedColumns(host!).length).toBe(0);

    await act(async () => {
      const open =
        host!.querySelector<HTMLButtonElement>('[data-testid="open-mobile"]') ??
        host!.querySelector<HTMLButtonElement>('[aria-label="openPanel"]');
      expect(open).not.toBeNull();
      open!.click();
    });

    await act(async () => {
      await panelLoad.resolve();
    });

    expect(reservedColumns(host!).length).toBe(1);
    const panel = host!.querySelector('[data-testid="session-nav-panel"]');
    const slot = host!.querySelector('[data-testid="session-nav-panel-slot"]');
    expect(Boolean(panel) || Boolean(slot)).toBe(true);
    if (panel) {
      expect(panel.getAttribute('data-mobile')).toBe('1');
    }
  });
});
