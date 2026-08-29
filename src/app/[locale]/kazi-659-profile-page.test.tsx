/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore, useUIStore } from '@/lib/store';
import type { User } from '@/types';

const getMeMock = vi.hoisted(() => vi.fn());
const patchMeMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());
const showToastMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  usePathname: () => '/en/profile',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/lib/api-client', () => ({
  getMe: () => getMeMock(),
  patchMe: (body: unknown) => patchMeMock(body),
}));

// React tracks the last value it set on a controlled input via a wrapped
// property setter; assigning `.value` directly and dispatching 'input' is a
// no-op from React's perspective. Go through the native setter instead.
function setInputValue(input: HTMLInputElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )!.set!;
  nativeSetter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

import ProfilePage from '@/app/[locale]/profile/page';

function sampleUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    displayName: 'Ada',
    createdAt: '2026-08-17T00:00:00Z',
    updatedAt: '2026-08-17T00:00:00Z',
    targetRole: '',
    ...overrides,
  };
}

describe('KAZI-659 /profile page', () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    getMeMock.mockReset();
    patchMeMock.mockReset();
    pushMock.mockReset();
    replaceMock.mockReset();
    showToastMock.mockReset();
    getMeMock.mockResolvedValue({ success: true, data: sampleUser() });
    useUIStore.setState({ isTelegramMiniApp: false, showToast: showToastMock });
    useAuthStore.setState({
      token: 'tok',
      user: sampleUser(),
      isLoggedIn: true,
      authReady: true,
    });
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
    useAuthStore.setState({ token: null, user: null, isLoggedIn: false, authReady: false });
  });

  it('prompts sign-in instead of the form when logged out', async () => {
    useAuthStore.setState({ token: null, user: null, isLoggedIn: false, authReady: true });

    await act(async () => {
      root!.render(<ProfilePage params={{ locale: 'en' }} />);
    });

    expect(host?.textContent).toContain('loginRequired');
    expect(host?.querySelector('form')).toBeNull();
    expect(getMeMock).not.toHaveBeenCalled();
  });

  it('loads the current user via getMe and renders the form once logged in', async () => {
    getMeMock.mockResolvedValue({
      success: true,
      data: sampleUser({ targetRole: 'Backend Engineer' }),
    });

    await act(async () => {
      root!.render(<ProfilePage params={{ locale: 'en' }} />);
    });
    // Flush the async getMe().then(...) chain inside the load effect.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getMeMock).toHaveBeenCalled();
    const form = host?.querySelector('form');
    expect(form).not.toBeNull();
    const targetRoleInput = host?.querySelector('input[placeholder="targetRolePlaceholder"]') as
      | HTMLInputElement
      | undefined;
    expect(targetRoleInput?.value).toBe('Backend Engineer');
  });

  it('saves a changed field and shows a success toast', async () => {
    getMeMock.mockResolvedValue({
      success: true,
      data: sampleUser({ targetRole: 'Backend Engineer' }),
    });
    patchMeMock.mockResolvedValue({
      success: true,
      data: sampleUser({ targetRole: 'Staff Engineer' }),
    });

    await act(async () => {
      root!.render(<ProfilePage params={{ locale: 'en' }} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const targetRoleInput = host!.querySelector(
      'input[placeholder="targetRolePlaceholder"]'
    ) as HTMLInputElement;
    await act(async () => {
      setInputValue(targetRoleInput, 'Staff Engineer');
    });

    const form = host!.querySelector('form') as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(patchMeMock).toHaveBeenCalledWith(
      expect.objectContaining({ target_role: 'Staff Engineer' })
    );
    expect(showToastMock).toHaveBeenCalledWith('saveSuccess', 'info');
  });

  it('shows a save-failed toast and keeps the form editable when patchMe fails', async () => {
    getMeMock.mockResolvedValue({
      success: true,
      data: sampleUser({ targetRole: 'Backend Engineer' }),
    });
    patchMeMock.mockResolvedValue({ success: false, error: 'saveFailed' });

    await act(async () => {
      root!.render(<ProfilePage params={{ locale: 'en' }} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const targetRoleInput = host!.querySelector(
      'input[placeholder="targetRolePlaceholder"]'
    ) as HTMLInputElement;
    await act(async () => {
      setInputValue(targetRoleInput, 'Staff Engineer');
    });

    const form = host!.querySelector('form') as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(showToastMock).toHaveBeenCalledWith('saveFailed', 'error');
    expect(host?.querySelector('form')).not.toBeNull();
  });
});
