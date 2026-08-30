/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

vi.mock('@/lib/region/client', () => ({
  RegionAccountFetchError: class RegionAccountFetchError extends Error {
    code = 'REGION_ACCOUNT_FETCH_ERROR';
  },
  regionAwareApiClient: { fetch: (...args: unknown[]) => fetchMock(...args) },
}));

import { apiRequest } from '@/lib/api-client';

/**
 * Found via manual UI review: a thrown fetch() failure (offline, DNS,
 * blocked request -- no HTTP response at all) surfaced as the raw browser
 * exception message ("Failed to fetch" in Chromium, "Load failed" in
 * Safari) inside `ApiResponse.error`. Several callers (login page, profile
 * save) render `result.error` directly without checking `errorCode` first,
 * so that raw string was reaching end users verbatim. `errorCode:
 * 'NETWORK_ERROR'` was already set correctly; only the fallback text leaked
 * engine internals. Fixed at the single shared source (apiRequest's
 * catch-all) rather than patching every caller individually.
 */
describe('apiRequest network-error normalization', () => {
  it('does not leak the raw browser fetch() exception message to callers', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const res = await apiRequest('/api/v1/whatever');

    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('NETWORK_ERROR');
    expect(res.error).toBe('Network error');
    expect(res.error).not.toContain('Failed to fetch');
  });

  it('normalizes a non-Error throw the same way', async () => {
    fetchMock.mockRejectedValue('some non-Error rejection');

    const res = await apiRequest('/api/v1/whatever');

    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('NETWORK_ERROR');
    expect(res.error).toBe('Network error');
  });
});
