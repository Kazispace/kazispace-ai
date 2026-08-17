/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

import {
  AUTH_COOKIE_MAX_AGE_SECONDS,
  clearAuthToken,
  getAuthToken,
  getLastOtpPhone,
  isAuthTokenExpired,
  resumeAuthSession,
  setLastOtpPhone,
  setUserInfo,
  syncAuthCookieFromSession,
} from '@/lib/auth';
import { STORAGE_KEYS } from '@/lib/constants';
import { BUNDLED_DIRECTORY, setSession } from '@/lib/region';

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

function readSrc(rel: string): string {
  return readFileSync(path.resolve(__dirname, rel), 'utf8');
}

describe('KAZI-577 resume login session without caching OTP', () => {
  const cookieWrites: string[] = [];

  beforeEach(() => {
    cookieWrites.length = 0;
    localStorage.clear();
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => cookieWrites.filter((row) => !row.includes('max-age=0')).join('; '),
      set: (value: string) => {
        cookieWrites.push(String(value));
      },
    });
  });

  afterEach(() => {
    clearAuthToken();
    localStorage.clear();
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

  it('rewrites the middleware cookie from localStorage with a 30-day max-age', () => {
    const token = jwtWithExp(Math.floor(Date.now() / 1000) + 3600);
    writeRegionSession(token);
    expect(syncAuthCookieFromSession()).toBe(true);
    const written = cookieWrites.find((row) => row.startsWith(`${STORAGE_KEYS.AUTH_COOKIE}=`));
    expect(written).toContain(`max-age=${AUTH_COOKIE_MAX_AGE_SECONDS}`);
    expect(AUTH_COOKIE_MAX_AGE_SECONDS).toBe(2592000);
    expect(decodeURIComponent(written!.split(';')[0].split('=')[1])).toBe(token);
  });

  it('resumes a valid session with cached user and never stores the OTP code', () => {
    const token = jwtWithExp(Math.floor(Date.now() / 1000) + 3600);
    writeRegionSession(token);
    setUserInfo({
      id: 'u1',
      displayName: 'Ada',
      createdAt: '2026-08-17T00:00:00Z',
      updatedAt: '2026-08-17T00:00:00Z',
    });
    setLastOtpPhone('+77001234567');

    const resumed = resumeAuthSession();
    expect(resumed?.token).toBe(token);
    expect(resumed?.user).toMatchObject({ id: 'u1' });
    expect(getLastOtpPhone()).toBe('+77001234567');
    expect(getAuthToken()).toBe(token);

    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      expect(key).not.toMatch(/otp_code|otpCode|verification_code/i);
      expect(localStorage.getItem(key)).not.toBe('123456');
    }
  });

  it('login page resumes session and only remembers the phone, not the code', () => {
    const login = readSrc('../app/[locale]/login/page.tsx');
    const auth = readSrc('./auth.ts');
    const attempt = readSrc('./region/otp-attempt.ts');
    expect(login).toMatch(/resumeAuthSession/);
    expect(login).toMatch(/setLastOtpPhone/);
    expect(login).not.toMatch(/localStorage\.setItem\([^)]*otp/i);
    expect(auth).toMatch(/LAST_OTP_PHONE/);
    expect(auth).not.toMatch(/otp_code/);
    expect(attempt).toMatch(/Do not persist/);
  });
});
