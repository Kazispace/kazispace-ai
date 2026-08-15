/**
 * KAZI-533 / IR-FE-1 — RegionAwareApiClient unit tests (T1–T12).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BUNDLED_DIRECTORY,
  RegionAccountFetchError,
  RegionAwareApiClient,
  bootstrapBase,
  clearSession,
  getSession,
  resolveHome,
  selectLiveApiBase,
  setAdvertisedApiBasesForTests,
  setSession,
} from '@/lib/region';

const CN = 'https://api-cn.kazispace.ai';
const INTL = 'https://bot.kazispace.ai';

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
  vi.stubGlobal('localStorage', localStorage);
  vi.stubGlobal('window', { localStorage });
}

describe('resolveHome (T1–T3)', () => {
  it('T1: +86 → cn-mainland / api-cn', () => {
    const home = resolveHome('+8613262788342');
    expect(home.data_region).toBe('cn-mainland');
    expect(home.api_base).toBe(CN);
    expect(home.region_id).toBe('cn-chengdu');
  });

  it('T2: +7 → global / intl', () => {
    const home = resolveHome('+77015551234');
    expect(home.data_region).toBe('global');
    expect(home.api_base).toBe(INTL);
  });

  it('T3: unknown prefix → default_data_region', () => {
    const home = resolveHome('+15551234567');
    expect(home.data_region).toBe(BUNDLED_DIRECTORY.default_data_region);
    expect(home.api_base).toBe(INTL);
  });

  it('normalizes bare 86… and 00 prefix', () => {
    expect(resolveHome('8613262788342').api_base).toBe(CN);
    expect(resolveHome('008613262788342').api_base).toBe(CN);
  });
});

describe('selectLiveApiBase (T4–T7)', () => {
  const prevFlag = process.env.NEXT_PUBLIC_REGION_ALLOW_NOT_READY;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_REGION_ALLOW_NOT_READY;
    setAdvertisedApiBasesForTests([INTL]);
  });

  afterEach(() => {
    setAdvertisedApiBasesForTests(null);
    if (prevFlag === undefined) {
      delete process.env.NEXT_PUBLIC_REGION_ALLOW_NOT_READY;
    } else {
      process.env.NEXT_PUBLIC_REGION_ALLOW_NOT_READY = prevFlag;
    }
  });

  it('T4: public advertised only intl + flag off → +86 OTP to bootstrap intl', () => {
    expect(selectLiveApiBase('+8613262788342')).toBe(bootstrapBase());
    expect(selectLiveApiBase('+8613262788342')).toBe(INTL);
  });

  it('T5: mock public includes CN advertised → +86 OTP to api-cn', () => {
    setAdvertisedApiBasesForTests([INTL, CN]);
    expect(selectLiveApiBase('+8613262788342')).toBe(CN);
  });

  it('T6: CN not_ready but flag=1 → +86 OTP to api-cn', () => {
    process.env.NEXT_PUBLIC_REGION_ALLOW_NOT_READY = '1';
    setAdvertisedApiBasesForTests([INTL]);
    expect(selectLiveApiBase('+8613262788342')).toBe(CN);
  });

  it('T7: +7 stays intl under T4 and T6', () => {
    setAdvertisedApiBasesForTests([INTL]);
    expect(selectLiveApiBase('+77015551234')).toBe(INTL);
    process.env.NEXT_PUBLIC_REGION_ALLOW_NOT_READY = '1';
    expect(selectLiveApiBase('+77015551234')).toBe(INTL);
  });
});

describe('session blob (T8)', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    clearSession();
  });

  afterEach(() => {
    clearSession();
    vi.unstubAllGlobals();
  });

  it('T8: missing fields / token-only → getSession null', () => {
    setSession({
      token: 'tok',
      home_api_base: '',
      data_region: 'global',
      directory_version: 4,
    } as never);
    expect(getSession()).toBeNull();

    localStorage.setItem(
      'kazi.region.session',
      JSON.stringify({ token: 'only-token' })
    );
    expect(getSession()).toBeNull();
  });

  it('accepts a full valid session', () => {
    setSession({
      token: 'tok',
      home_api_base: INTL,
      data_region: 'global',
      directory_version: 4,
    });
    expect(getSession()?.token).toBe('tok');
    expect(getSession()?.home_api_base).toBe(INTL);
  });
});

describe('RegionAwareApiClient.fetch (T9–T11)', () => {
  const client = new RegionAwareApiClient();
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    installMemoryLocalStorage();
    clearSession();
    setAdvertisedApiBasesForTests([INTL]);
    fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    clearSession();
    setAdvertisedApiBasesForTests(null);
    vi.unstubAllGlobals();
  });

  it('T9: account fetch without session throws', async () => {
    await expect(
      client.fetch('/api/v1/me', { requireSession: true })
    ).rejects.toBeInstanceOf(RegionAccountFetchError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('T10: logged-in fetch URL host === session.home_api_base; JWT only there', async () => {
    setSession({
      token: 'jwt-secret',
      home_api_base: CN,
      data_region: 'cn-mainland',
      directory_version: 4,
    });

    await client.fetch('/api/v1/me', { requireSession: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${CN}/api/v1/me`);
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer jwt-secret');
  });

  it('T10b: bootstrap / phone paths never attach JWT', async () => {
    setSession({
      token: 'jwt-secret',
      home_api_base: CN,
      data_region: 'cn-mainland',
      directory_version: 4,
    });
    await client.fetch('/api/v1/auth/otp/request', {
      method: 'POST',
      phone: '+8613262788342',
      headers: { Authorization: 'Bearer leaked' },
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBeNull();
    // Production flag off → live host is intl, not CN
    expect(String(fetchMock.mock.calls[0][0])).toContain(INTL);
  });

  it('T11: directory refresh marking CN advertised does not change home_api_base', async () => {
    setSession({
      token: 'jwt-secret',
      home_api_base: INTL,
      data_region: 'global',
      directory_version: 4,
    });
    const before = getSession()!.home_api_base;
    setAdvertisedApiBasesForTests([INTL, CN]);
    expect(getSession()!.home_api_base).toBe(before);
    expect(getSession()!.home_api_base).toBe(INTL);
  });
});

describe('login 404 region isolation (T12)', () => {
  it('maps region-local 404 without a second cross-cluster request', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          detail: { error_code: 'USER_NOT_FOUND', message: 'no account' },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);
    setAdvertisedApiBasesForTests([INTL]);

    const { apiRequest } = await import('@/lib/api-client');
    const res = await apiRequest('/api/v1/auth/otp/verify', {
      method: 'POST',
      phone: '+8613262788342',
      body: JSON.stringify({ phone: '+8613262788342', code: '000000' }),
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe('此区域没有账号');
    expect(res.errorCode).toBe('REGION_ACCOUNT_NOT_FOUND');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = String((fetchMock.mock.calls as unknown as Array<[unknown]>)[0]?.[0] ?? '');
    expect(calledUrl).toContain(INTL);
    expect(calledUrl).not.toContain('api-cn');

    vi.unstubAllGlobals();
    setAdvertisedApiBasesForTests(null);
  });
});
