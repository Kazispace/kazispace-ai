import { describe, expect, it } from 'vitest';

import { GET } from './route';

describe('KAZI-1422 · /api/healthz', () => {
  it('answers 200 {ok: true} and is never cached', async () => {
    const res = GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});
