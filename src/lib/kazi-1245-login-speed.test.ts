/**
 * KAZI-1245 login speed-up (Owen, 2026-11-04: "登录或者注册的时候，弹出框要spin很长时间").
 * 1. Sending a code no longer waits for the US public directory when the bundled
 *    directory already advertises the number's home (+86, +7, +998).
 * 2. Reads time out and get one more try; writes are never retried.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiRequest, bundledDirectoryAdvertisesHome, requestOtp } from '@/lib/api-client';

function hangUntilAborted(_url: unknown, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  });
}

describe('KAZI-1245 sending a code does not wait for the US directory', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('knows which numbers the bundled directory already routes', () => {
    expect(bundledDirectoryAdvertisesHome('+8613262788342')).toBe(true);
    expect(bundledDirectoryAdvertisesHome('+77001234567')).toBe(true);
    expect(bundledDirectoryAdvertisesHome('+998901234567')).toBe(true);
    expect(bundledDirectoryAdvertisesHome('+15550100')).toBe(false);
  });

  it('a +86 code request goes to China at once, even while the directory never answers', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      calls.push(String(url));
      if (String(url).includes('region-directory')) return hangUntilAborted(url, init);
      return Promise.resolve(new Response(JSON.stringify({ status: 'sent' }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }));
    const started = Date.now();
    const res = await requestOtp('+8613262788342');
    expect(res.success).toBe(true);
    expect(Date.now() - started).toBeLessThan(500);
    expect(calls.some((u) => u === 'https://api.kazispace.cn/api/v1/auth/otp/request')).toBe(true);
  });
});

describe('KAZI-1245 a stalled request does not spin for ever', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(hangUntilAborted));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('a read times out, is tried once more, then reports a network error', async () => {
    const res = await apiRequest('/health', { bootstrap: true, timeoutMs: 50 });
    expect(res).toMatchObject({ success: false, errorCode: 'NETWORK_ERROR' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('a write is never retried', async () => {
    const res = await apiRequest('/x', { bootstrap: true, method: 'POST', body: '{}', timeoutMs: 50 });
    expect(res).toMatchObject({ success: false, errorCode: 'NETWORK_ERROR' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('a caller that aborts is not retried', async () => {
    const ctrl = new AbortController();
    const pending = apiRequest('/health', { bootstrap: true, signal: ctrl.signal });
    ctrl.abort();
    expect(await pending).toMatchObject({ success: false });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
