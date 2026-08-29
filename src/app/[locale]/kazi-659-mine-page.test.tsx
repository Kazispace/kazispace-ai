/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import { useAuthStore, useUIStore } from '@/lib/store';
import type { User } from '@/types';

const useBillingMock = vi.hoisted(() => vi.fn());
const useNbaActionMock = vi.hoisted(() => vi.fn());
const getMeMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  usePathname: () => '/en/mine',
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/hooks/use-billing', () => ({
  useBilling: () => useBillingMock(),
}));

vi.mock('@/hooks/use-nba-action', () => ({
  useNbaAction: () => useNbaActionMock(),
}));

vi.mock('@/lib/api-client', () => ({
  getMe: () => getMeMock(),
}));

import MinePage from '@/app/[locale]/mine/page';

function sampleUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    displayName: 'Ada Lovelace',
    createdAt: '2026-08-17T00:00:00Z',
    updatedAt: '2026-08-17T00:00:00Z',
    ...overrides,
  };
}

describe('KAZI-659 /mine page', () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;
  let confirmSpy: MockInstance<Window['confirm']>;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    useBillingMock.mockReset();
    useNbaActionMock.mockReset();
    getMeMock.mockReset();
    pushMock.mockReset();
    useBillingMock.mockReturnValue({
      balance: { cvCredits: 2, interviewCredits: 1 },
      plan: null,
      isLoading: false,
    });
    useNbaActionMock.mockReturnValue({ nba: null, isLoading: false });
    getMeMock.mockResolvedValue({ success: false });
    useUIStore.setState({ isTelegramMiniApp: false });
    useAuthStore.setState({
      token: 'tok',
      user: sampleUser(),
      isLoggedIn: true,
      authReady: true,
    });
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
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
    confirmSpy.mockRestore();
    useAuthStore.setState({ token: null, user: null, isLoggedIn: false, authReady: false });
  });

  it('renders the logged-in user’s name and credit balances', async () => {
    await act(async () => {
      root!.render(<MinePage params={{ locale: 'en' }} />);
    });

    expect(host?.textContent).toContain('Ada Lovelace');
    // Review follow-up (PR #215): bare `toContain` digits don't catch
    // cvCredits/interviewCredits rendering in the swapped card -- pin each
    // to its own credit card in DOM order (cv, interview, streak) instead.
    // Scoped to the `grid-cols-3` credits row, not `.text-2xl.font-bold`
    // globally (the page header's own wordmark also matches that class).
    const values = Array.from(
      host?.querySelectorAll('.grid-cols-3 .text-2xl.font-bold') ?? []
    ).map((el) => el.textContent);
    expect(values).toEqual(['2', '1', '0']);
  });

  it('falls back to a guest label when there is no user', async () => {
    useAuthStore.setState({ token: null, user: null, isLoggedIn: false, authReady: true });

    await act(async () => {
      root!.render(<MinePage params={{ locale: 'en' }} />);
    });

    expect(host?.textContent).toContain('Guest User');
  });

  it('logs out and navigates to /login when the user confirms', async () => {
    await act(async () => {
      root!.render(<MinePage params={{ locale: 'en' }} />);
    });

    const logoutButton = Array.from(host?.querySelectorAll('button') ?? []).find((b) =>
      b.textContent?.includes('logoutLabel')
    );
    expect(logoutButton).toBeDefined();

    await act(async () => {
      logoutButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(confirmSpy).toHaveBeenCalled();
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(pushMock).toHaveBeenCalledWith('/en/login');
  });

  it('does not log out when the user cancels the confirm dialog', async () => {
    confirmSpy.mockReturnValue(false);

    await act(async () => {
      root!.render(<MinePage params={{ locale: 'en' }} />);
    });

    const logoutButton = Array.from(host?.querySelectorAll('button') ?? []).find((b) =>
      b.textContent?.includes('logoutLabel')
    );

    await act(async () => {
      logoutButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(useAuthStore.getState().isLoggedIn).toBe(true);
    expect(pushMock).not.toHaveBeenCalled();
  });
});
