import { describe, expect, it } from 'vitest';

import { canRunSpaceLifecycle, isSpaceComposerMuted } from '@/lib/spaces/lifecycle';
import type { SpaceDetail } from '@/types/spaces';

function space(
  patch: Partial<SpaceDetail> & Pick<SpaceDetail, 'id' | 'status'>
): Pick<SpaceDetail, 'id' | 'status' | 'is_system' | 'is_entry_point'> &
  Partial<Pick<SpaceDetail, 'template_id'>> {
  return {
    is_system: false,
    is_entry_point: false,
    ...patch,
  };
}

describe('canRunSpaceLifecycle', () => {
  it('offers only Delete on an archived template, whatever its server status (D39)', () => {
    for (const status of ['active', 'completed', 'archived'] as const) {
      const s = space({ id: 'sp_job', status, template_id: 'job_sprint' });
      expect(canRunSpaceLifecycle(s, 'complete')).toBe(false);
      expect(canRunSpaceLifecycle(s, 'archive')).toBe(false);
      expect(canRunSpaceLifecycle(s, 'restore')).toBe(false);
      expect(canRunSpaceLifecycle(s, 'delete')).toBe(true);
    }
    expect(
      canRunSpaceLifecycle(space({ id: 'sp_en', status: 'active', template_id: 'ielts_prep' }), 'archive')
    ).toBe(true);
  });

  it('blocks clinic / system spaces', () => {
    expect(
      canRunSpaceLifecycle(
        space({ id: '__clinic__', status: 'active', is_system: true }),
        'archive'
      )
    ).toBe(false);
  });

  it('allows archive on active/completed', () => {
    expect(canRunSpaceLifecycle(space({ id: 'sp_1', status: 'active' }), 'archive')).toBe(
      true
    );
    expect(
      canRunSpaceLifecycle(space({ id: 'sp_1', status: 'completed' }), 'archive')
    ).toBe(true);
  });

  it('allows restore only from archived/deleted', () => {
    expect(
      canRunSpaceLifecycle(space({ id: 'sp_1', status: 'archived' }), 'restore')
    ).toBe(true);
    expect(canRunSpaceLifecycle(space({ id: 'sp_1', status: 'active' }), 'restore')).toBe(
      false
    );
  });

  it('allows delete unless already deleted', () => {
    expect(canRunSpaceLifecycle(space({ id: 'sp_1', status: 'active' }), 'delete')).toBe(
      true
    );
    expect(
      canRunSpaceLifecycle(space({ id: 'sp_1', status: 'archived' }), 'delete')
    ).toBe(true);
    expect(
      canRunSpaceLifecycle(space({ id: 'sp_1', status: 'deleted' }), 'delete')
    ).toBe(false);
  });
});

describe('isSpaceComposerMuted', () => {
  it('mutes archived and deleted only', () => {
    expect(isSpaceComposerMuted('archived')).toBe(true);
    expect(isSpaceComposerMuted('deleted')).toBe(true);
    expect(isSpaceComposerMuted('active')).toBe(false);
    expect(isSpaceComposerMuted('completed')).toBe(false);
  });
});
