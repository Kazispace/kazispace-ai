import { describe, expect, it } from 'vitest';

import { CLINIC_SPACE_ID } from '@/lib/spaces/constants';
import { isSpacesIndexPath, pickLatestUserSpace } from '@/lib/spaces/routes';
import type { SpaceSummary } from '@/types/spaces';

function space(
  id: string,
  last_active_at: string | null,
  overrides: Partial<SpaceSummary> = {}
): SpaceSummary {
  return {
    id,
    name: id,
    template_id: 'blank_conversation',
    status: 'active',
    master_session_id: `sess_${id}`,
    last_active_at,
    ...overrides,
  };
}

describe('spaces routes', () => {
  it('matches bare /spaces only', () => {
    expect(isSpacesIndexPath('/spaces')).toBe(true);
    expect(isSpacesIndexPath('/spaces/sp_abc')).toBe(false);
  });

  it('picks latest non-clinic space', () => {
    const spaces = [
      space(CLINIC_SPACE_ID, '2026-07-13T12:00:00Z', {
        is_entry_point: true,
      }),
      space('sp_old', '2026-07-10T10:00:00Z'),
      space('sp_new', '2026-07-12T10:00:00Z'),
    ];
    expect(pickLatestUserSpace(spaces)?.id).toBe('sp_new');
  });

  it('returns null when only clinic exists', () => {
    expect(
      pickLatestUserSpace([
        space(CLINIC_SPACE_ID, '2026-07-13T12:00:00Z', { is_entry_point: true }),
      ])
    ).toBeNull();
  });
});
