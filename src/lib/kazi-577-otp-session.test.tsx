/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

import {
  AUTH_COOKIE_MAX_AGE_SECONDS,
  clearAuthToken,
  getAuthToken,
  getPendingOtpPhone,
  hydrateAuthFromSession,
  isAuthTokenExpired,
  PENDING_OTP_PHONE_SESSION_KEY,
  resumeAuthSession,
  setPendingOtpPhone,
  setUserInfo,
  syncAuthCookieFromSession,
} from '@/lib/auth';
import { STORAGE_KEYS } from '@/lib/constants';
import { BUNDLED_DIRECTORY, setSession } from '@/lib/region';
import { useAuthStore } from '@/lib/store';
import type { User } from '@/types';

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

function readSrc(rel: string): string {
  return readFileSync(path.resolve(__dirname, rel), 'utf8');
}

describe('KAZI-577 resume login session without caching OTP', () => {
  const cookieWrites: string[] = [];

  beforeEach(() => {
    cookieWrites.length = 0;
    localStorage.clear();
    sessionStorage.clear();
    useAuthStore.setState({
      token: null,
      user: null,
      isLoggedIn: false,
      authReady: false,
    });
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () =>
        cookieWrites.filter((row) => !row.includes('max-age=0')).join('; '),
      set: (value: string) => {
        cookieWrites.push(String(value));
      },
    });
  });

  afterEach(() => {
    clearAuthToken();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('does not treat opaque tokens as expired', () => {
    expect(isAuthTokenExpired('opaque-session-token')).toBe(false);
  });

  it('treats JWT exp in the past as expired', () => {
    const past = Math.floor(Date.now() / 1000) - 120;
    expect(isAuthTokenExpired(jwtWithExp(past))).toBe(true);
    const future = Math.floor(Date.now() / 1000) + 3600;
    expect(isAuthTokenExpired(jwtWithExp(future))).toBe(false);
  });

  it('clears an expired JWT region session instead of returning it', () => {
    writeRegionSession(jwtWithExp(Math.floor(Date.now() / 1000) - 120));
    expect(getAuthToken()).toBeNull();
    expect(resumeAuthSession()).toBeNull();
  });

  it('bounds the middleware cookie max-age to JWT exp when known', () => {
    const token = jwtWithExp(Math.floor(Date.now() / 1000) + 3600);
    writeRegionSession(token);
    expect(syncAuthCookieFromSession()).toBe(true);
    const written = cookieWrites.find((row) =>
      row.startsWith(`${STORAGE_KEYS.AUTH_COOKIE}=`)
    );
    const maxAge = Number(written?.match(/max-age=(\d+)/)?.[1]);
    expect(maxAge).toBeGreaterThan(3000);
    expect(maxAge).toBeLessThanOrEqual(3600);
    expect(written).not.toContain(`max-age=${AUTH_COOKIE_MAX_AGE_SECONDS}`);
  });

  it('uses the 30-day cap for opaque tokens', () => {
    writeRegionSession('opaque-session-token');
    expect(syncAuthCookieFromSession()).toBe(true);
    const written = cookieWrites.find((row) =>
      row.startsWith(`${STORAGE_KEYS.AUTH_COOKIE}=`)
    );
    expect(written).toContain(`max-age=${AUTH_COOKIE_MAX_AGE_SECONDS}`);
    expect(AUTH_COOKIE_MAX_AGE_SECONDS).toBe(2592000);
  });

  it('resumes a valid session with cached user and never stores the OTP code', () => {
    const token = jwtWithExp(Math.floor(Date.now() / 1000) + 3600);
    writeRegionSession(token);
    setUserInfo(sampleUser());

    const resumed = resumeAuthSession();
    expect(resumed?.token).toBe(token);
    expect(resumed?.user).toMatchObject({ id: 'u1' });
    expect(getAuthToken()).toBe(token);

    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      expect(key).not.toMatch(/otp|phone/i);
      expect(localStorage.getItem(key)).not.toBe('123456');
      expect(localStorage.getItem(key)).not.toBe('+77001234567');
    }
  });

  it('keeps pending OTP phone in sessionStorage and clears it on logout/expiry', () => {
    localStorage.setItem('kazi_last_otp_phone', '+77001234567');
    setPendingOtpPhone('+77001234567');
    expect(getPendingOtpPhone()).toBe('+77001234567');
    expect(sessionStorage.getItem(PENDING_OTP_PHONE_SESSION_KEY)).toBe(
      '+77001234567'
    );
    expect(localStorage.getItem(PENDING_OTP_PHONE_SESSION_KEY)).toBeNull();

    useAuthStore.getState().logout();

    expect(getPendingOtpPhone()).toBeNull();
    expect(sessionStorage.getItem(PENDING_OTP_PHONE_SESSION_KEY)).toBeNull();
    expect(localStorage.getItem('kazi_last_otp_phone')).toBeNull();
  });

  it('hydrateAuthFromSession fetches /me even when USER_INFO is cached and does not mark login itself', async () => {
    const token = jwtWithExp(Math.floor(Date.now() / 1000) + 3600);
    writeRegionSession(token);
    setUserInfo(sampleUser({ displayName: 'StaleCache' }));
    const user = sampleUser({ displayName: 'FromMe' });
    const fetchMe = vi.fn(async () => ({
      success: true as const,
      data: user,
    }));
    const result = await hydrateAuthFromSession(fetchMe);
    expect(fetchMe).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: 'authenticated', token, user });
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('hydrateAuthFromSession clears auth when /me fails even if USER_INFO exists', async () => {
    const token = jwtWithExp(Math.floor(Date.now() / 1000) + 3600);
    writeRegionSession(token);
    setUserInfo(sampleUser());
    const result = await hydrateAuthFromSession(async () => ({
      success: false,
    }));
    expect(result.status).toBe('invalid');
    expect(getAuthToken()).toBeNull();
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
  });

  it('login page uses pending session phone and hydrateAuthFromSession, not durable last-phone', () => {
    const login = readSrc('../app/[locale]/login/page.tsx');
    const providers = readSrc('../components/providers.tsx');
    const auth = readSrc('./auth.ts');
    const attempt = readSrc('./region/otp-attempt.ts');
    expect(login).toMatch(/getPendingOtpPhone/);
    expect(login).toMatch(/setPendingOtpPhone/);
    expect(login).not.toMatch(/setLastOtpPhone|getLastOtpPhone|LAST_OTP_PHONE/);
    expect(login).not.toMatch(/localStorage\.setItem/);
    expect(providers).toMatch(/hydrateAuthFromSession/);
    expect(providers).not.toMatch(/isLoggedIn: true/);
    const tmaLaunch = readSrc('../app/[locale]/tma/launch/page.tsx');
    const tmaInit = readSrc('../hooks/use-tma-init.ts');
    expect(tmaLaunch).not.toMatch(/isLoggedIn: true/);
    expect(tmaInit).not.toMatch(/isLoggedIn: true/);
    expect(auth).toMatch(/PENDING_OTP_PHONE_SESSION_KEY/);
    expect(auth).toMatch(/sessionStorage/);
    expect(auth).toMatch(/LEGACY_LAST_OTP_PHONE_KEY/);
    expect(auth).not.toMatch(/export const LAST_OTP_PHONE/);
    expect(auth).not.toMatch(/localStorage\.setItem\([^)]*otp_phone/);
    expect(auth).not.toMatch(/otp_code/);
    expect(attempt).toMatch(/Do not persist/);
  });
});

const getMeMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
  usePathname: () => '/en/chat',
}));

vi.mock('@/hooks/use-tma-init', () => ({
  useTmaInit: () => undefined,
  reauthTelegramIfPossible: async () => false,
}));

vi.mock('@/lib/api-client', () => ({
  getMe: () => getMeMock(),
}));

import { Providers } from '@/components/providers';

describe('KAZI-577 Providers boot does not half-authenticate', () => {
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
    replaceMock.mockReset();
    useAuthStore.setState({
      token: null,
      user: null,
      isLoggedIn: false,
      authReady: false,
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
    clearAuthToken();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('token without USER_INFO waits for /me then logs in with a user', async () => {
    const token = jwtWithExp(Math.floor(Date.now() / 1000) + 3600);
    writeRegionSession(token);
    const user = sampleUser({ displayName: 'BootMe' });
    getMeMock.mockResolvedValue({ success: true, data: user });

    expect(useAuthStore.getState().isLoggedIn).toBe(false);

    await act(async () => {
      root!.render(
        <Providers>
          <div data-testid="child" />
        </Providers>
      );
    });

    expect(useAuthStore.getState().isLoggedIn).toBe(true);
    expect(useAuthStore.getState().user).toMatchObject({
      id: 'u1',
      displayName: 'BootMe',
    });
    expect(useAuthStore.getState().authReady).toBe(true);
    expect(getMeMock).toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('token without USER_INFO and failed /me stays logged out and routes to login', async () => {
    const token = jwtWithExp(Math.floor(Date.now() / 1000) + 3600);
    writeRegionSession(token);
    getMeMock.mockResolvedValue({ success: false });

    await act(async () => {
      root!.render(
        <Providers>
          <div data-testid="child" />
        </Providers>
      );
    });

    expect(useAuthStore.getState().isLoggedIn).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().authReady).toBe(true);
    expect(getAuthToken()).toBeNull();
    expect(replaceMock).toHaveBeenCalledWith('/en/login');
  });
});
