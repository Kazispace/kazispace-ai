/**
 * @vitest-environment jsdom
 *
 * KAZI-660 review (PR #210): the effect that loads `/profile` was fixed to
 * include `applyLoadedUser` in its deps. The reviewer's architectural
 * argument was that this is safe because `updateUser` (the only reactive
 * value `applyLoadedUser` itself depends on) is a useAuthStore action
 * defined once in create() — stable for the store's lifetime — so the
 * effect's dep array doesn't churn on ordinary re-renders. The reviewer
 * explicitly asked for that to be checked against real behavior rather than
 * asserted from reading the store, since this sandbox has no live backend
 * to open real DevTools Network tab against. This test mounts the actual
 * page component (not a re-implementation) against the real
 * useAuthStore/useUIStore, and asserts getMe fires exactly once across
 * several forced re-renders — the regression this would need to catch is a
 * future change that makes `updateUser` (or anything else in the effect's
 * deps) an inline closure instead of a stable store action.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/lib/store';

const getMe = vi.fn();

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/profile',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/components/layout/header', () => ({
  Header: () => null,
}));

vi.mock('@/components/layout/bottom-nav', () => ({
  BottomNav: () => null,
}));

vi.mock('@/lib/api-client', () => ({
  getMe: (...args: unknown[]) => getMe(...args),
  patchMe: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  setUserInfo: vi.fn(),
}));

import ProfilePage from '@/app/[locale]/profile/page';

describe('KAZI-660 /profile getMe effect fires exactly once', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
  });

  beforeEach(() => {
    getMe.mockReset();
    getMe.mockResolvedValue({ success: false });
    useAuthStore.setState({
      isLoggedIn: true,
      token: 'test-token',
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('calls getMe once on mount and does not re-fire across unrelated re-renders', async () => {
    await act(async () => {
      root.render(<ProfilePage params={{ locale: 'en' }} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(getMe).toHaveBeenCalledTimes(1);

    // Re-renders that don't touch isLoggedIn/token/updateUser (e.g. an
    // unrelated store update bumping some other subscribed field) must not
    // re-run the effect — this is the exact identity-stability question the
    // reviewer raised for the (isLoggedIn, token, updateUser, applyLoadedUser)
    // dep array.
    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        root.render(<ProfilePage params={{ locale: 'en' }} />);
      });
    }
    await act(async () => {
      await Promise.resolve();
    });

    expect(getMe).toHaveBeenCalledTimes(1);
  });
});
