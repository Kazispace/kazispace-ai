import { describe, expect, it } from 'vitest';

import { canRunSpaceLifecycle, isSpaceComposerMuted } from '@/hooks/use-space-lifecycle';
import type { SpaceDetail } from '@/types/spaces';

function space(
  patch: Partial<SpaceDetail> & Pick<SpaceDetail, 'id' | 'status'>
): Pick<SpaceDetail, 'id' | 'status' | 'is_system' | 'is_entry_point'> {
  return {
    is_system: false,
    is_entry_point: false,
    ...patch,
  };
}

describe('canRunSpaceLifecycle', () => {
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
});

describe('isSpaceComposerMuted', () => {
  it('mutes archived and deleted only', () => {
    expect(isSpaceComposerMuted('archived')).toBe(true);
    expect(isSpaceComposerMuted('deleted')).toBe(true);
    expect(isSpaceComposerMuted('active')).toBe(false);
    expect(isSpaceComposerMuted('completed')).toBe(false);
  });
});
