import { describe, expect, it } from 'vitest';

import { resolveSpaceJobId } from '@/lib/spaces/space-context';
import type { SpaceDetail } from '@/types/spaces';

describe('resolveSpaceJobId', () => {
  const space = (space_state: SpaceDetail['space_state'] = {}): Pick<
    SpaceDetail,
    'space_state' | 'config_snapshot'
  > => ({
    space_state,
    config_snapshot: {},
  });

  it('prefers URL job_id override', () => {
    expect(
      resolveSpaceJobId(space({ job_id: 'job_from_state' }), {
        get: (key) => (key === 'job_id' ? 'job_from_url' : null),
      })
    ).toBe('job_from_url');
  });

  it('falls back to space_state when URL absent', () => {
    expect(
      resolveSpaceJobId(space({ job_id: 'job_from_state' }), {
        get: () => null,
      })
    ).toBe('job_from_state');
  });
});
