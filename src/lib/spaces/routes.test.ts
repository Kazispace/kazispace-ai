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

  // KAZI-1171 UAT 14213: the Space tab opened a Space archived minutes earlier, because
  // archiving bumps last_active_at.
  it('never picks an archived or deleted space, even when it is the most recent', () => {
    const spaces = [
      space('sp_archived', '2026-10-26T12:00:00Z', { status: 'archived' }),
      space('sp_deleted', '2026-10-26T12:30:00Z', { status: 'deleted' }),
      space('sp_active', '2026-10-18T09:09:00Z'),
    ];
    expect(pickLatestUserSpace(spaces)?.id).toBe('sp_active');
  });

  it('prefers an in-progress space over a more recent completed one', () => {
    const spaces = [
      space('sp_done', '2026-10-26T12:00:00Z', { status: 'completed' }),
      space('sp_active', '2026-10-18T09:09:00Z'),
    ];
    expect(pickLatestUserSpace(spaces)?.id).toBe('sp_active');
  });

  it('falls back to the latest completed space when none is in progress', () => {
    const spaces = [
      space('sp_done_old', '2026-10-01T00:00:00Z', { status: 'completed' }),
      space('sp_done_new', '2026-10-20T00:00:00Z', { status: 'completed' }),
      space('sp_archived', '2026-10-26T00:00:00Z', { status: 'archived' }),
    ];
    expect(pickLatestUserSpace(spaces)?.id).toBe('sp_done_new');
  });

  it('returns null when every user space is archived or deleted', () => {
    expect(
      pickLatestUserSpace([
        space('sp_a', '2026-10-26T00:00:00Z', { status: 'archived' }),
        space('sp_d', '2026-10-25T00:00:00Z', { status: 'deleted' }),
      ])
    ).toBeNull();
  });
});
