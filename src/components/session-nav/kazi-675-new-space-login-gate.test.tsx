/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const pushMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  usePathname: () => '/en/chat',
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/lib/telegram', () => ({
  isTelegramWebApp: () => false,
}));

vi.mock('@/lib/session-nav/load-session-nav-panels', () => ({
  loadSessionNavPanel: async () => ({ SessionNavPanel: MockSessionNavPanel }),
  loadSessionFileLibraryPanel: async () => ({ SessionFileLibraryPanel: () => null }),
  loadSessionGlobalSearchPanel: async () => ({ SessionGlobalSearchPanel: () => null }),
  loadSpaceTemplatePicker: async () => ({ SpaceTemplatePicker: MockSpaceTemplatePicker }),
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
  SessionIconRail: () => <div data-testid="icon-rail" />,
}));

vi.mock('@/components/session-nav/session-context-header', () => ({
  SessionContextHeader: () => <div data-testid="context-header" />,
}));

vi.mock('@/components/session-nav/confirm-abandon-session-dialog', () => ({
  ConfirmAbandonSessionDialog: () => null,
}));

// Exposes just enough of the real SessionNavPanel's props to exercise the
// "+ New Space" click -- the panel's own rendering is not under test here.
function MockSessionNavPanel({ onNewSpace }: { onNewSpace: () => void }) {
  return (
    <button type="button" data-testid="new-space-button" onClick={onNewSpace}>
      new space
    </button>
  );
}

function MockSpaceTemplatePicker({ open }: { open: boolean }) {
  return open ? <div data-testid="template-picker" /> : null;
}

import { SessionNavShell } from '@/components/session-nav/session-nav-shell';
import { useAuthStore } from '@/lib/store';

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

/**
 * Found via manual UI review, fix per Owen's explicit direction: guests
 * clicking "+ New Space" used to open the full template picker with no
 * login gate (unlike the sibling specialist cards on Clinic's first screen,
 * which show a lock + "Sign in to continue" for guests) -- createSpace
 * would only fail with an auth error toast after a guest had already picked
 * a template. Fixed by sending guests straight to /login via router.push
 * (a plain navigation, not a popup window -- Owen: browsers block those and
 * guests won't know how to unblock them), matching the rest of the app's
 * "requires auth" click handlers.
 */
describe('KAZI-675 "+ New Space" login gate', () => {
  let root: Root;
  let host: HTMLDivElement;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    pushMock.mockClear();
    installViewport({ desktop: true, innerWidth: 1280 });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    useAuthStore.setState({ isLoggedIn: false, user: null, token: null });
  });

  it('redirects a guest to /login instead of opening the template picker', async () => {
    useAuthStore.setState({ isLoggedIn: false, user: null, token: null });

    await act(async () => {
      root.render(
        <SessionNavShell locale="en">
          <main>chat</main>
        </SessionNavShell>
      );
    });
    // Let the dynamic SessionNavPanel/SpaceTemplatePicker imports resolve.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const button = host.querySelector<HTMLButtonElement>('[data-testid="new-space-button"]');
    expect(button).not.toBeNull();

    await act(async () => {
      button!.click();
    });

    expect(pushMock).toHaveBeenCalledWith('/en/login');
    expect(host.querySelector('[data-testid="template-picker"]')).toBeNull();
  });

  it('opens the template picker for a logged-in user', async () => {
    useAuthStore.setState({
      isLoggedIn: true,
      token: 'tok',
      user: { id: 'u1', displayName: 'Ada', createdAt: '', updatedAt: '' },
    });

    await act(async () => {
      root.render(
        <SessionNavShell locale="en">
          <main>chat</main>
        </SessionNavShell>
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const button = host.querySelector<HTMLButtonElement>('[data-testid="new-space-button"]');
    await act(async () => {
      button!.click();
    });

    expect(pushMock).not.toHaveBeenCalled();
    expect(host.querySelector('[data-testid="template-picker"]')).not.toBeNull();
  });
});
