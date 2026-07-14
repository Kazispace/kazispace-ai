import { describe, expect, it } from 'vitest';

import {
  emptySpaceSlice,
  getSpaceSliceFromRecord,
  patchSpaceSlice,
  patchSpaceSliceWithLru,
  pruneSpacesToLru,
  removeSpaceFromLru,
  SPACE_SLICE_LRU_LIMIT,
  touchSpaceLruOrder,
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

  it('touches LRU most-recent-first and trims', () => {
    expect(touchSpaceLruOrder(['a', 'b'], 'c', 2)).toEqual(['c', 'a']);
    expect(touchSpaceLruOrder(['a', 'b'], 'b', 3)).toEqual(['b', 'a']);
  });

  it('evicts oldest slices beyond LRU limit', () => {
    let spaces = {};
    let order: string[] = [];
    for (let i = 0; i < SPACE_SLICE_LRU_LIMIT + 3; i++) {
      const id = `sp_${i}`;
      const next = patchSpaceSliceWithLru(spaces, order, id, {
        messages: [{ id: `m_${i}`, role: 'user', content: String(i) }],
      });
      spaces = next.spaces;
      order = next.lruOrder;
    }
    expect(Object.keys(spaces)).toHaveLength(SPACE_SLICE_LRU_LIMIT);
    expect(order).toHaveLength(SPACE_SLICE_LRU_LIMIT);
    expect(spaces.sp_0).toBeUndefined();
    expect(spaces[`sp_${SPACE_SLICE_LRU_LIMIT + 2}`]).toBeDefined();
  });

  it('protects active spaceId from eviction when possible', () => {
    let spaces = {};
    let order: string[] = [];
    for (let i = 0; i < SPACE_SLICE_LRU_LIMIT; i++) {
      const next = patchSpaceSliceWithLru(spaces, order, `sp_${i}`, {
        isHydrating: true,
      });
      spaces = next.spaces;
      order = next.lruOrder;
    }
    const protectedId = 'sp_0';
    // Access oldest as active so it moves… actually leave it old, then insert new ones with protect
    const next = patchSpaceSliceWithLru(
      spaces,
      order,
      'sp_new',
      { isSending: true },
      { protectSpaceId: protectedId }
    );
    expect(next.spaces[protectedId]).toBeDefined();
    expect(next.spaces.sp_new?.isSending).toBe(true);
    expect(Object.keys(next.spaces).length).toBeLessThanOrEqual(SPACE_SLICE_LRU_LIMIT);
  });

  it('removeSpaceFromLru drops id from both maps', () => {
    const spaces = pruneSpacesToLru(
      { a: emptySpaceSlice(), b: emptySpaceSlice() },
      ['a', 'b']
    );
    const removed = removeSpaceFromLru(spaces, ['a', 'b'], 'a');
    expect(removed.spaces.a).toBeUndefined();
    expect(removed.lruOrder).toEqual(['b']);
  });
});
