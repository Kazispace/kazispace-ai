/**
 * KAZI-1476 — a saved place names the text it is in (kazispace-ui personal-radio.md 0.32, Data — Serial
 * stories, "When an episode's text is replaced").
 *
 * The field goes in the body only when the episode answer carried one. A server that does not send it yet
 * refuses a body with a field it does not know: a client that always sent it would fail every save there.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ apiRequest: m.apiRequest }));

import { putRadioProgress } from '@/lib/radio/serial-api';

const AT = new Date('2026-11-25T12:00:00.000Z');
const base = { programId: 'dee_s01e01', seq: 3, band: 'B1' as const, mode: 'balanced' as const, at: AT };
const sent = () => JSON.parse(m.apiRequest.mock.calls.at(-1)?.[1].body as string);

describe('PUT progress carries script_checksum', () => {
  beforeEach(() => {
    m.apiRequest.mockReset();
    m.apiRequest.mockResolvedValue({ success: true, data: { storyline_id: 'dee', applied: true, progress: null } });
  });

  it('with the value of the episode answer, unchanged', async () => {
    await putRadioProgress('dee', { ...base, scriptChecksum: 'sha256:abc' });
    expect(m.apiRequest.mock.calls.at(-1)?.[0]).toBe('/api/v1/radio/storylines/dee/progress');
    expect(sent()).toEqual({
      program_id: 'dee_s01e01',
      seq: 3,
      band: 'B1',
      mode: 'balanced',
      at: '2026-11-25T12:00:00.000Z',
      script_checksum: 'sha256:abc',
    });
  });

  it.each([[undefined], [null], ['']])('answer had none (%j) ⇒ the key is not in the body at all', async (value) => {
    await putRadioProgress('dee', { ...base, scriptChecksum: value });
    expect(sent()).toEqual({ program_id: 'dee_s01e01', seq: 3, band: 'B1', mode: 'balanced', at: '2026-11-25T12:00:00.000Z' });
    expect('script_checksum' in sent()).toBe(false);
  });

  it('is still sent with keepalive: the page may be gone before the answer', async () => {
    await putRadioProgress('dee', { ...base, scriptChecksum: 'sha256:abc' });
    expect(m.apiRequest.mock.calls.at(-1)?.[1]).toMatchObject({ method: 'PUT', keepalive: true });
  });
});
