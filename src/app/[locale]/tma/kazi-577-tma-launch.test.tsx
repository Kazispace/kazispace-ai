/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearAuthToken, getAuthToken } from '@/lib/auth';
import { BUNDLED_DIRECTORY, setSession } from '@/lib/region';
import { useAuthStore, useUIStore } from '@/lib/store';
import type { User } from '@/types';

const getMeMock = vi.hoisted(() => vi.fn());
const authTelegramMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());
const isTma = vi.hoisted(() => ({ value: true }));

function jwtWithExp(expSeconds: number): string {
  const payload = btoa(JSON.stringify({ exp: expSeconds }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `eyJhbGciOiJub25l.${payload}.sig`;
}

function writeRegionSession(token: string) {
  setSession({
    token,
    home_api_base: 'https://bot.kazispace.ai',
    data_region: 'global',
    directory_version: BUNDLED_DIRECTORY.directory_version,
  });
}

function sampleUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    displayName: 'Ada',
    createdAt: '2026-08-17T00:00:00Z',
    updatedAt: '2026-08-17T00:00:00Z',
    ...overrides,
  };
}

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/lib/telegram', () => ({
  getTelegramWebApp: () => ({}),
  getInitData: () => 'query_id=1',
  isTelegramWebApp: () => isTma.value,
  readyTelegramWebApp: () => undefined,
  expandTelegramWebApp: () => undefined,
  applyTelegramTheme: () => undefined,
  resolveStartParam: () => null,
}));

vi.mock('@/lib/api-client', () => ({
  getMe: () => getMeMock(),
  authTelegramWebapp: (initData: string) => authTelegramMock(initData),
}));

vi.mock('@/lib/master-session', () => ({
  syncMasterSession: async () => undefined,
  clearMasterSession: () => undefined,
}));

import TmaLaunchPage from '@/app/[locale]/tma/launch/page';
import { reauthTelegramIfPossible } from '@/hooks/use-tma-init';

describe('KAZI-577 TMA launch does not half-authenticate', () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  beforeAll(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    getMeMock.mockReset();
    authTelegramMock.mockReset();
    replaceMock.mockReset();
    pushMock.mockReset();
    isTma.value = true;
    useAuthStore.setState({
      token: null,
      user: null,
      isLoggedIn: false,
      authReady: false,
    });
    useUIStore.setState({ tmaInitComplete: false, isTelegramMiniApp: false });
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
    clearAuthToken();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('authTelegramWebapp success but /me failure stays logged out and does not route', async () => {
    const token = jwtWithExp(Math.floor(Date.now() / 1000) + 3600);
    authTelegramMock.mockImplementation(async () => {
      writeRegionSession(token);
      return { success: true, data: { access_token: token } };
    });
    getMeMock.mockResolvedValue({ success: false, error: 'me failed' });

    await act(async () => {
      root!.render(<TmaLaunchPage params={{ locale: 'en' }} />);
    });

    expect(useAuthStore.getState().isLoggedIn).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(getAuthToken()).toBeNull();
    expect(useUIStore.getState().tmaInitComplete).toBe(false);
    expect(replaceMock).not.toHaveBeenCalled();
    expect(host?.textContent).toContain('authFailed');
    expect(host?.textContent).toContain('useOtpLogin');
  });

  it('authTelegramWebapp + /me success logs in and routes through login()', async () => {
    const token = jwtWithExp(Math.floor(Date.now() / 1000) + 3600);
    const user = sampleUser({ displayName: 'TmaUser' });
    authTelegramMock.mockImplementation(async () => {
      writeRegionSession(token);
      return { success: true, data: { access_token: token } };
    });
    getMeMock.mockResolvedValue({ success: true, data: user });

    await act(async () => {
      root!.render(<TmaLaunchPage params={{ locale: 'en' }} />);
    });

    expect(useAuthStore.getState().isLoggedIn).toBe(true);
    expect(useAuthStore.getState().user).toMatchObject({
      id: 'u1',
      displayName: 'TmaUser',
    });
    expect(useUIStore.getState().tmaInitComplete).toBe(true);
    expect(replaceMock).toHaveBeenCalledWith('/en/chat');
  });

  it('reauthTelegramIfPossible fails closed when /me fails', async () => {
    const token = jwtWithExp(Math.floor(Date.now() / 1000) + 3600);
    authTelegramMock.mockImplementation(async () => {
      writeRegionSession(token);
      return { success: true, data: { access_token: token } };
    });
    getMeMock.mockResolvedValue({ success: false });

    const ok = await reauthTelegramIfPossible();

    expect(ok).toBe(false);
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(getAuthToken()).toBeNull();
  });
});
