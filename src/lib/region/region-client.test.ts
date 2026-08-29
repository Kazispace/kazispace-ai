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
  vi.stubGlobal('document', { cookie: '' });
  vi.stubGlobal('window', {
    localStorage,
    location: { pathname: '/en/login' },
  });
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

  it('P2: rejects absolute API paths', async () => {
    await expect(
      client.fetch('https://evil.example/api/v1/me', { bootstrap: true })
    ).rejects.toMatchObject({ code: 'ABSOLUTE_PATH' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('P2: session Authorization overwrites caller header', async () => {
    setSession({
      token: 'session-jwt',
      home_api_base: INTL,
      data_region: 'global',
      directory_version: 4,
    });
    await client.fetch('/api/v1/me', {
      requireSession: true,
      headers: { Authorization: 'Bearer attacker' },
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get('Authorization')).toBe(
      'Bearer session-jwt'
    );
  });

  it('P2: pinned apiBase must be allowlisted', async () => {
    await expect(
      client.fetch('/api/v1/auth/otp/verify', {
        apiBase: 'https://evil.example',
      })
    ).rejects.toMatchObject({ code: 'UNKNOWN_API_BASE' });
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

describe('OtpAttempt host pin (P1-3)', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    clearSession();
    setAdvertisedApiBasesForTests([INTL]);
    delete process.env.NEXT_PUBLIC_REGION_ALLOW_NOT_READY;
  });

  afterEach(() => {
    clearSession();
    setAdvertisedApiBasesForTests(null);
    vi.unstubAllGlobals();
  });

  it('request/verify stay on same host when directory becomes CN-advertised mid-flight', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/otp/request')) {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      if (String(url).includes('/otp/verify')) {
        return new Response(
          JSON.stringify({
            access_token: 'tok',
            home_api_base: CN,
            data_region: 'cn-mainland',
            directory_version: 4,
            user: { id: 1 },
          }),
          { status: 200 }
        );
      }
      return new Response('{}', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { requestOtp, verifyOtp } = await import('@/lib/api-client');
    const req = await requestOtp('+8613262788342');
    expect(req.success).toBe(true);
    expect(req.attempt?.api_base).toBe(INTL);

    // Mid-flight: CN becomes advertised — verify must still use pinned intl.
    setAdvertisedApiBasesForTests([INTL, CN]);
    expect(selectLiveApiBase('+8613262788342')).toBe(CN);

    const ver = await verifyOtp('+8613262788342', '123456', req.attempt);
    expect(ver.success).toBe(true);

    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    const otpUrls = urls.filter((u) => u.includes('/auth/otp/'));
    expect(otpUrls).toHaveLength(2);
    expect(otpUrls.every((u) => u.startsWith(INTL))).toBe(true);
    expect(otpUrls.some((u) => u.includes('api-cn'))).toBe(false);

    // Session stays on pinned intl (CN home from BE rejected while we used intl OTP)
    // BE returned CN but we authenticated on intl — chosenBase prefers pinned when
    // BE home differs and... wait: after advertise, CN is in advertised set, so
    // chosenBase would become CN. That would move JWT from intl OTP to CN session!
    //
    // Review: "成功后仍按 BE 响应 + advertised contract 创建 RegionSession"
    // So after verify on intl, if BE returns CN and CN is now advertised, session
    // could be CN — but then token was issued by intl. That's a BE contract issue.
    // Safer: session home must equal the pinned OTP host (where token was issued).
    expect(getSession()?.home_api_base).toBe(INTL);
  });

  it('rejects missing / unknown attempt host on verify', async () => {
    const { verifyOtp } = await import('@/lib/api-client');
    const missing = await verifyOtp('+8613262788342', '123456', null);
    expect(missing.success).toBe(false);
    expect(missing.errorCode).toBe('INVALID_OTP_ATTEMPT');

    const bad = await verifyOtp('+8613262788342', '123456', {
      phone: '+8613262788342',
      api_base: 'https://evil.example',
      directory_version: 4,
    });
    expect(bad.success).toBe(false);
    expect(bad.errorCode).toBe('INVALID_OTP_ATTEMPT');
  });
});

describe('TMA session pin (P1-4)', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    clearSession();
    setAdvertisedApiBasesForTests([INTL]);
  });

  afterEach(() => {
    clearSession();
    setAdvertisedApiBasesForTests(null);
    vi.unstubAllGlobals();
  });

  it('ignores BE home_api_base=CN and keeps intl liveBase', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) =>
      new Response(
        JSON.stringify({
          access_token: 'tma-tok',
          token_type: 'bearer',
          user_id: 1,
          is_new_user: false,
          expires_in: 3600,
          home_api_base: CN,
          data_region: 'cn-mainland',
          directory_version: 4,
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const { authTelegramWebapp } = await import('@/lib/api-client');
    const res = await authTelegramWebapp('query_id=1');
    expect(res.success).toBe(true);
    expect(getSession()?.home_api_base).toBe(INTL);
    expect(getSession()?.data_region).toBe('global');
    expect(String(fetchMock.mock.calls[0][0])).toContain(INTL);
  });
});
