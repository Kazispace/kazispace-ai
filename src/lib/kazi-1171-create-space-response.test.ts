/**
 * KAZI-1171 UAT 14221 — `POST /api/v1/spaces` answers `CreateSpaceResponse`
 * (`{ space, master_session_id }`), not a bare `SpaceDetail`. `createSpace` must read the
 * Space out of the wrapper, or every caller gets `id: ''` and navigates to `/spaces/`.
 *
 * The fixture is typed with the generated BE schema, so if the response shape changes,
 * `tsc` fails here first.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { components } from '@/types/api.generated';

const api = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ apiRequest: api.request }));

import { createSpace } from '@/lib/spaces-api';

type CreateSpaceResponse = components['schemas']['CreateSpaceResponse'];
type SpaceDetailWire = components['schemas']['SpaceDetail'];

const detail = {
  id: 'sp_e083afdbd1f4',
  name: '雅思备考',
  template_id: 'ielts_prep',
  status: 'active',
  is_entry_point: false,
  is_system: false,
  master_session_id: 'sess_m1',
  last_active_at: '2026-10-26T13:40:00Z',
  config_snapshot: {},
  space_state: {},
  created_at: '2026-10-26T13:40:00Z',
  updated_at: '2026-10-26T13:40:00Z',
} as unknown as SpaceDetailWire;

beforeEach(() => api.request.mockReset());

describe('createSpace', () => {
  it('reads the Space out of the real BE response shape', async () => {
    const body: CreateSpaceResponse = { space: detail, master_session_id: 'sess_m1' };
    api.request.mockResolvedValue({ success: true, data: body });

    const res = await createSpace({ template_id: 'ielts_prep' });

    expect(api.request).toHaveBeenCalledWith(
      '/api/v1/spaces',
      expect.objectContaining({ method: 'POST' })
    );
    expect(res.success).toBe(true);
    expect(res.data?.id).toBe('sp_e083afdbd1f4');
    expect(res.data?.template_id).toBe('ielts_prep');
    expect(res.data?.master_session_id).toBe('sess_m1');
  });

  it('still reads a bare SpaceDetail', async () => {
    api.request.mockResolvedValue({ success: true, data: detail });
    const res = await createSpace({ template_id: 'ielts_prep' });
    expect(res.data?.id).toBe('sp_e083afdbd1f4');
  });

  it('passes an error through', async () => {
    api.request.mockResolvedValue({ success: false, error: 'boom', status: 400 });
    const res = await createSpace({ template_id: 'ielts_prep' });
    expect(res.success).toBe(false);
    expect(res.error).toBe('boom');
  });
});
