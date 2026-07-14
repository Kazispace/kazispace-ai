import { describe, expect, it } from 'vitest';

import {
  emptySpaceSlice,
  getSpaceSliceFromRecord,
  patchSpaceSlice,
} from '@/lib/space-slice';

describe('space-slice', () => {
  it('returns empty slice for unknown spaceId', () => {
    expect(getSpaceSliceFromRecord({}, 'sp_1')).toEqual(emptySpaceSlice());
  });

  it('patches by spaceId without clobbering siblings', () => {
    const a = patchSpaceSlice({}, 'sp_a', {
      messages: [{ id: 'u1', role: 'user', content: 'hi' }],
      isSending: true,
    });
    const both = patchSpaceSlice(a, 'sp_b', { isHydrating: true });
    expect(both.sp_a?.isSending).toBe(true);
    expect(both.sp_a?.messages).toHaveLength(1);
    expect(both.sp_b?.isHydrating).toBe(true);
    expect(both.sp_b?.messages).toEqual([]);
  });
});
