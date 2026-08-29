import { describe, expect, it } from 'vitest';

import { SPACE_WORKSPACE_KEEPALIVE_LIMIT } from '@/lib/spaces/perf-policy';
import {
  nextSpaceWorkspaceKeepAliveIds,
  sameSpaceIdList,
} from '@/lib/spaces/space-workspace-keepalive';

describe('KAZI-573 Space workspace keep-alive', () => {
  it('keeps A mounted when switching A→B→A', () => {
    let ids: string[] = [];
    ids = nextSpaceWorkspaceKeepAliveIds(ids, 'sp_a');
    ids = nextSpaceWorkspaceKeepAliveIds(ids, 'sp_b');
    const afterReturn = nextSpaceWorkspaceKeepAliveIds(ids, 'sp_a');
    expect(afterReturn).toContain('sp_a');
    expect(afterReturn).toContain('sp_b');
    expect(afterReturn[0]).toBe('sp_a');
  });

  it('evicts the oldest id when over the keepalive limit', () => {
    // KAZI-567 f/u: raised 3→5 (perf-policy.ts) — mobile/touch switches lean
    // on the list-load bulk prefetch fan-out, not hover, so a deeper warm
    // set covers more of a session's active Spaces on tap-only devices.
    expect(SPACE_WORKSPACE_KEEPALIVE_LIMIT).toBe(5);
    let ids: string[] = [];
    ids = nextSpaceWorkspaceKeepAliveIds(ids, 'sp_a', 3);
    ids = nextSpaceWorkspaceKeepAliveIds(ids, 'sp_b', 3);
    ids = nextSpaceWorkspaceKeepAliveIds(ids, 'sp_c', 3);
    ids = nextSpaceWorkspaceKeepAliveIds(ids, 'sp_d', 3);
    expect(ids).toEqual(['sp_d', 'sp_c', 'sp_b']);
    expect(ids).not.toContain('sp_a');
  });

  it('is a no-op for empty active ids', () => {
    expect(nextSpaceWorkspaceKeepAliveIds(['sp_a'], '  ')).toEqual(['sp_a']);
  });

  it('compares id lists by order', () => {
    expect(sameSpaceIdList(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameSpaceIdList(['a', 'b'], ['b', 'a'])).toBe(false);
  });
});
