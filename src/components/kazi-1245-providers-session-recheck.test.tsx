/**
 * @vitest-environment jsdom
 */
/**
 * KAZI-1245 (review of kazispace-ai #281): while /me is unreachable, Providers re-checks
 * the session. Overlapping checks must not undo a session another check has resumed, and
 * "online" events during a check must not use up the re-check budget.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthHydrateResult } from '@/lib/auth';
import { useAuthStore } from '@/lib/store';
import type { User } from '@/types';

const hydrate = vi.hoisted(() => vi.fn());
const replace = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', async (orig) => ({
  ...(await orig<typeof import('@/lib/auth')>()),
  hydrateAuthFromSession: hydrate,
}));
vi.mock('@/lib/api-client', () => ({ getMe: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/zh/spaces',
}));
vi.mock('@/hooks/use-tma-init', () => ({ useTmaInit: () => undefined, reauthTelegramIfPossible: async () => false }));
vi.mock('@/lib/region', () => ({ ensureDirectoryLoaded: async () => undefined }));

import { Providers } from '@/components/providers';

const user: User = { id: 'u1', displayName: 'Ada', createdAt: '2026-11-04T00:00:00Z', updatedAt: '2026-11-04T00:00:00Z' };
const authenticated: AuthHydrateResult = { status: 'authenticated', token: 't', user };
const unreachable: AuthHydrateResult = { status: 'unreachable' };

function deferred() {
  let resolve!: (r: AuthHydrateResult) => void;
  const promise = new Promise<AuthHydrateResult>((r) => (resolve = r));
  return { promise, resolve };
}

describe('KAZI-1245 Providers session re-check', () => {
  let root: Root;
  let host: HTMLDivElement;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    hydrate.mockReset();
    replace.mockReset();
    useAuthStore.setState({ token: null, user: null, isLoggedIn: false, authReady: false });
    host = document.createElement('div');
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.useRealTimers();
  });

  const online = () => act(() => void window.dispatchEvent(new Event('online')));
  const settle = async () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

  it('an "online" during the first check starts no second check; the resumed session stays', async () => {
    const first = deferred();
    hydrate.mockReturnValueOnce(first.promise).mockResolvedValue(unreachable);
    act(() => root.render(<Providers><div /></Providers>));
    expect(hydrate).toHaveBeenCalledTimes(1);
    online();
    online();
    expect(hydrate).toHaveBeenCalledTimes(1);
    first.resolve(authenticated);
    await settle();
    expect(useAuthStore.getState().isLoggedIn).toBe(true);
    online();
    await act(async () => void vi.advanceTimersByTime(60_000));
    expect(hydrate).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isLoggedIn).toBe(true);
  });

  it('after "unreachable": "online" re-checks once even if it fires repeatedly, and a resumed session is kept', async () => {
    hydrate.mockResolvedValueOnce(unreachable);
    const second = deferred();
    hydrate.mockReturnValueOnce(second.promise);
    act(() => root.render(<Providers><div /></Providers>));
    await settle();
    expect(useAuthStore.getState()).toMatchObject({ authReady: true, isLoggedIn: false });
    expect(replace).not.toHaveBeenCalled(); // not sent to login
    online();
    online();
    online();
    expect(hydrate).toHaveBeenCalledTimes(2);
    second.resolve(authenticated);
    await settle();
    expect(useAuthStore.getState().isLoggedIn).toBe(true);
    await act(async () => void vi.advanceTimersByTime(60_000));
    expect(hydrate).toHaveBeenCalledTimes(2);
  });

  it('re-checks on a timer, up to the limit, while it stays unreachable', async () => {
    hydrate.mockResolvedValue(unreachable);
    act(() => root.render(<Providers><div /></Providers>));
    await settle();
    for (let i = 0; i < 6; i++) {
      await act(async () => void vi.advanceTimersByTime(15_000));
      await settle();
    }
    expect(hydrate).toHaveBeenCalledTimes(1 + 4);
    expect(replace).not.toHaveBeenCalled();
  });

  it('a late "unreachable" does not sign out a user who signed in meanwhile', async () => {
    hydrate.mockResolvedValueOnce(unreachable);
    const second = deferred();
    hydrate.mockReturnValueOnce(second.promise);
    act(() => root.render(<Providers><div /></Providers>));
    await settle();
    online();
    // The user enters a code on the login page while the re-check is still out.
    act(() => useAuthStore.setState({ token: 't2', user, isLoggedIn: true, authReady: true }));
    second.resolve(unreachable);
    await settle();
    expect(useAuthStore.getState()).toMatchObject({ isLoggedIn: true, token: 't2' });
    await act(async () => void vi.advanceTimersByTime(60_000));
    expect(hydrate).toHaveBeenCalledTimes(2);
  });

  it('a definite rejection still sends the user to sign in', async () => {
    hydrate.mockResolvedValue({ status: 'invalid' });
    act(() => root.render(<Providers><div /></Providers>));
    await settle();
    expect(replace).toHaveBeenCalledWith('/zh/login');
  });
});
