/**
 * @vitest-environment jsdom
 */
/**
 * KAZI-1245, found while testing sign-in on www.kazispace.cn and kazispace.ai over a weak
 * connection (2026-11-04):
 * 1. A dropped /me request signed the user out: any /me failure deleted the session.
 *    Now only a definite rejection does; a network failure or server error keeps it.
 * 2. A script file that failed to download left the page on the error screen, whose
 *    "Retry" asks for the same file. Now the error screens reload once by themselves.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

import { getAuthToken, hydrateAuthFromSession, isTransientMeFailure, setUserInfo } from '@/lib/auth';
import {
  CHUNK_RELOAD_INLINE_SCRIPT,
  CHUNK_RELOAD_KEY,
  RELOAD_WINDOW_MS,
  isChunkLoadError,
  reloadForChunkError,
  shouldReloadForChunkError,
} from '@/lib/chunk-reload';
import { BUNDLED_DIRECTORY, setSession } from '@/lib/region';
import type { User } from '@/types';

function jwtWithExp(expSeconds: number): string {
  const payload = btoa(JSON.stringify({ exp: expSeconds })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `eyJhbGciOiJub25l.${payload}.sig`;
}

const user: User = { id: 'u1', displayName: 'Ada', createdAt: '2026-11-04T00:00:00Z', updatedAt: '2026-11-04T00:00:00Z' };
const networkError = { success: false, errorCode: 'NETWORK_ERROR' };

function signIn(): string {
  const token = jwtWithExp(Math.floor(Date.now() / 1000) + 3600);
  setSession({ token, home_api_base: 'https://api.kazispace.cn', data_region: 'cn-mainland', directory_version: BUNDLED_DIRECTORY.directory_version });
  setUserInfo(user);
  return token;
}

describe('KAZI-1245 a weak connection does not sign the user out', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  const noWait = { sleep: vi.fn(async () => undefined) };

  it('a dropped /me is retried, and the session resumes when it gets through', async () => {
    const token = signIn();
    const fetchMe = vi.fn().mockResolvedValueOnce(networkError).mockResolvedValueOnce({ success: true, data: user });
    const sleep = vi.fn(async () => undefined);
    expect(await hydrateAuthFromSession(fetchMe, { sleep })).toEqual({ status: 'authenticated', token, user });
    expect(fetchMe).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1500);
  });

  it('if /me never gets through, the session is kept (unreachable), not ended', async () => {
    const token = signIn();
    const fetchMe = vi.fn().mockResolvedValue(networkError);
    expect(await hydrateAuthFromSession(fetchMe, noWait)).toEqual({ status: 'unreachable' });
    expect(fetchMe).toHaveBeenCalledTimes(3);
    expect(getAuthToken()).toBe(token);
  });

  it.each([500, 502, 503, 408, 429])('HTTP %i is treated as unreachable, not as a rejection', async (status) => {
    const token = signIn();
    const result = await hydrateAuthFromSession(vi.fn().mockResolvedValue({ success: false, status }), noWait);
    expect(result.status).toBe('unreachable');
    expect(getAuthToken()).toBe(token);
  });

  it.each([401, 403, 404])('HTTP %i ends the session at once', async (status) => {
    signIn();
    const fetchMe = vi.fn().mockResolvedValue({ success: false, status });
    expect((await hydrateAuthFromSession(fetchMe, noWait)).status).toBe('invalid');
    expect(fetchMe).toHaveBeenCalledTimes(1);
    expect(getAuthToken()).toBeNull();
  });

  it('only network and server failures are transient', () => {
    expect(isTransientMeFailure(networkError)).toBe(true);
    expect(isTransientMeFailure({ success: false, status: 503 })).toBe(true);
    expect(isTransientMeFailure({ success: false, status: 401 })).toBe(false);
    expect(isTransientMeFailure({ success: false })).toBe(false);
    expect(isTransientMeFailure({ success: true })).toBe(false);
  });

  it('getMe keeps why it failed, and the app re-checks an unreachable session', () => {
    const api = readFileSync(path.resolve(__dirname, './api-client.ts'), 'utf8');
    expect(api).toMatch(/errorCode: res\.errorCode, status: res\.status/);
    const providers = readFileSync(path.resolve(__dirname, '../components/providers.tsx'), 'utf8');
    expect(providers).toMatch(/result\.status === "unreachable"/);
    expect(providers).toMatch(/addEventListener\("online", recheck\)/);
  });
});

describe('KAZI-1245 a script that failed to download reloads the page once', () => {
  function memoryStorage(initial: Record<string, string> = {}) {
    const data = { ...initial };
    return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v), data };
  }
  const chunkError = Object.assign(new Error('Loading chunk 3812 failed.'), { name: 'ChunkLoadError' });

  it('recognises chunk load failures, and nothing else', () => {
    expect(isChunkLoadError(chunkError)).toBe(true);
    expect(isChunkLoadError(new Error('Loading CSS chunk 12 failed.'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /x.js'))).toBe(true);
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });

  it('reloads the first time, then not again for the same path within the window', () => {
    const storage = memoryStorage();
    const now = 1_000_000;
    const env = { storage, path: '/zh/spaces', now };
    expect(shouldReloadForChunkError(chunkError, env)).toBe(true);
    const reload = vi.fn();
    reloadForChunkError(env, reload);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(JSON.parse(storage.data[CHUNK_RELOAD_KEY])).toEqual({ path: '/zh/spaces', at: now });
    // Same path, soon after: show the error screen (no reload loop).
    expect(shouldReloadForChunkError(chunkError, { storage, path: '/zh/spaces', now: now + 5_000 })).toBe(false);
    // Another path, or after the window: reload again.
    expect(shouldReloadForChunkError(chunkError, { storage, path: '/zh/mine', now: now + 5_000 })).toBe(true);
    expect(shouldReloadForChunkError(chunkError, { storage, path: '/zh/spaces', now: now + RELOAD_WINDOW_MS + 1 })).toBe(true);
  });

  it('never reloads for other errors, or when storage is unavailable', () => {
    const env = { storage: memoryStorage(), path: '/zh', now: 1 };
    expect(shouldReloadForChunkError(new Error('boom'), env)).toBe(false);
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(shouldReloadForChunkError(chunkError, { storage: broken, path: '/zh', now: 1 })).toBe(false);
    expect(shouldReloadForChunkError(chunkError, null)).toBe(false);
  });

  it('both error screens use it', () => {
    for (const rel of ['../app/[locale]/error.tsx', '../app/global-error.tsx']) {
      const src = readFileSync(path.resolve(__dirname, rel), 'utf8');
      expect(src).toMatch(/shouldReloadForChunkError\(error\)/);
      expect(src).toMatch(/reloadForChunkError\(\)/);
    }
  });
});

describe('KAZI-1245 a startup script that fails to download reloads the page once', () => {
  it('the inline <head> guard reloads on a failed /_next/static script, once per path', () => {
    sessionStorage.clear();
    const reload = vi.fn();
    const realLocation = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { pathname: '/zh/login', reload } });
    const added: Array<(e: Event) => void> = [];
    const spy = vi.spyOn(window, 'addEventListener').mockImplementation(((type: string, fn: (e: Event) => void) => {
      if (type === 'error') added.push(fn);
    }) as typeof window.addEventListener);
    try {
      new Function(CHUNK_RELOAD_INLINE_SCRIPT)();
      const fail = (src: string) => added.forEach((fn) => fn({ target: { tagName: 'SCRIPT', src } } as unknown as Event));
      fail('https://www.kazispace.cn/_next/static/chunks/app/page-1.js');
      expect(reload).toHaveBeenCalledTimes(1);
      expect(JSON.parse(sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? '{}').path).toBe('/zh/login');
      // Same path again within the window: no second reload, so no loop.
      fail('https://www.kazispace.cn/_next/static/chunks/app/page-1.js');
      expect(reload).toHaveBeenCalledTimes(1);
      // Other scripts (e.g. a third-party SDK) are left alone.
      sessionStorage.clear();
      fail('https://telegram.org/js/telegram-web-app.js');
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
      Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
    }
  });

  it('the locale layout puts it in <head> before other scripts', () => {
    const layout = readFileSync(path.resolve(__dirname, '../app/[locale]/layout.tsx'), 'utf8');
    expect(layout.indexOf('CHUNK_RELOAD_INLINE_SCRIPT }}')).toBeGreaterThan(-1);
    expect(layout.indexOf('CHUNK_RELOAD_INLINE_SCRIPT }}')).toBeLessThan(layout.indexOf('<TmaScript />'));
  });
});
