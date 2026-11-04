/**
 * KAZI-1209 part 5 (#280 review) — `POST events` goes out with `keepalive: true`, so a batch sent while the
 * page is being left (`player_left`, the last flush) is not cancelled by the browser. Not `sendBeacon`: it cannot
 * carry the auth header.
 */
import { describe, expect, it, vi } from 'vitest';

const apiRequest = vi.hoisted(() => vi.fn(async () => ({ success: true, data: { accepted: 1, duplicates: 0, rejected: [] } })));
vi.mock('@/lib/api-client', () => ({ apiRequest }));

import { postRadioEvents } from '@/lib/radio/player-api';
import { localDay } from '@/components/radio/radio-saves';

describe('POST events', () => {
  it('is sent with keepalive', async () => {
    await postRadioEvents([{ client_event_id: 'ev_12345678', kind: 'replay', save_id: 'sv1', payload: { seq: 1 } }]);
    const [path, init] = apiRequest.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toBe('/api/v1/radio/events');
    expect(init.method).toBe('POST');
    expect(init.keepalive).toBe(true);
    expect(JSON.parse(init.body as string).events).toHaveLength(1);
  });
});

describe('the greeting day', () => {
  it("is the user's local date, not UTC", () => {
    // 2026-11-04 07:30 in China is 2026-11-03 23:30 UTC; built from local parts, so it holds in any test time zone.
    const d = new Date(2026, 10, 4, 7, 30);
    expect(localDay(d)).toBe('2026-11-04');
  });
});
