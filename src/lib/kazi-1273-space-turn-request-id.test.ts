/**
 * KAZI-1273 — every Space turn POST carries a `request_id`, so a turn seen in a browser
 * (a user's report, a browser test) can be found in the backend Trace. The reply carries
 * no id of its own, so the request is the only place it can come from.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ apiRequest: api.request }));

import { newSpaceTurnRequestId, sendSpaceTurn } from '@/lib/spaces-api';

function sentBody(call = 0): Record<string, unknown> {
  const init = api.request.mock.calls[call][1] as { body: string };
  return JSON.parse(init.body);
}

beforeEach(() => {
  api.request.mockReset();
  api.request.mockResolvedValue({ success: true, data: { envelope: {} } });
});

describe('sendSpaceTurn request_id', () => {
  it('adds a request_id and keeps the rest of the body', async () => {
    await sendSpaceTurn('sp_1', { message: '练词汇', locale: 'zh', language_preference: 'zh' });
    expect(api.request.mock.calls[0][0]).toBe('/api/v1/spaces/sp_1/turn');
    const body = sentBody();
    expect(body).toMatchObject({ message: '练词汇', locale: 'zh', language_preference: 'zh' });
    expect(body.request_id).toMatch(/^web_[0-9a-z]{16,}$/);
  });

  it('uses a new id on every call, so a retry is a fresh turn (no KAZI-1031 replay)', async () => {
    await sendSpaceTurn('sp_1', { message: 'a' });
    await sendSpaceTurn('sp_1', { message: 'a' });
    expect(sentBody(0).request_id).not.toBe(sentBody(1).request_id);
  });

  it('keeps an id the caller already chose', async () => {
    await sendSpaceTurn('sp_1', { message: 'a', request_id: 'web_given_123' });
    expect(sentBody().request_id).toBe('web_given_123');
  });

  it('mints ids without crypto.randomUUID too', () => {
    const real = globalThis.crypto;
    vi.stubGlobal('crypto', undefined);
    try {
      expect(newSpaceTurnRequestId()).toMatch(/^web_[0-9a-z]+$/);
    } finally {
      vi.stubGlobal('crypto', real);
    }
  });
});
