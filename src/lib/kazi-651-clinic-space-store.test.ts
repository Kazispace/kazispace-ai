import { describe, expect, it, beforeEach } from 'vitest';

import { useSpaceStore } from '@/lib/store';
import { CLINIC_SPACE_ID } from '@/lib/spaces/constants';
import { SPACE_SLICE_LRU_LIMIT } from '@/lib/space-slice';

describe('KAZI-651 Phase C.1b: useSpaceStore.reset() preserves the __clinic__ slice', () => {
  beforeEach(() => {
    useSpaceStore.setState({ activeSpaceId: null, spaces: {}, spaceLruOrder: [] });
  });

  it('wipes real Space slices but keeps __clinic__ (logout never cleared Clinic before this migration)', () => {
    useSpaceStore.setState({
      spaces: {
        [CLINIC_SPACE_ID]: {
          masterSessionId: 'sess_clinic',
          messages: [{ id: 'u1', role: 'user', content: 'hello' }],
          isHydrating: false,
          isSending: false,
          isStreaming: false,
          replyNotice: null,
          activeCapability: null,
          activePanelHint: null,
        },
        sp_real: {
          masterSessionId: 'sess_real',
          messages: [{ id: 'u2', role: 'user', content: 'hi' }],
          isHydrating: false,
          isSending: false,
          isStreaming: false,
          replyNotice: null,
          activeCapability: null,
          activePanelHint: null,
        },
      },
      spaceLruOrder: ['sp_real', CLINIC_SPACE_ID],
      activeSpaceId: 'sp_real',
    });

    useSpaceStore.getState().reset();

    const state = useSpaceStore.getState();
    expect(state.activeSpaceId).toBeNull();
    expect(state.spaces.sp_real).toBeUndefined();
    expect(state.spaces[CLINIC_SPACE_ID]).toBeDefined();
    expect(state.spaces[CLINIC_SPACE_ID]?.messages).toEqual([
      { id: 'u1', role: 'user', content: 'hello' },
    ]);
    expect(state.spaces[CLINIC_SPACE_ID]?.masterSessionId).toBe('sess_clinic');
    expect(state.spaceLruOrder).toEqual([CLINIC_SPACE_ID]);
  });

  it('is a no-op-safe full wipe when Clinic never had a slice yet', () => {
    useSpaceStore.getState().setSpaceMessages('sp_real', [
      { id: 'u1', role: 'user', content: 'hi' },
    ]);

    useSpaceStore.getState().reset();

    const state = useSpaceStore.getState();
    expect(state.spaces).toEqual({});
    expect(state.spaceLruOrder).toEqual([]);
  });
});

describe('KAZI-651 Phase C.1b review discovery: setActiveSpaceId LRU touch-to-front', () => {
  beforeEach(() => {
    useSpaceStore.setState({ activeSpaceId: null, spaces: {}, spaceLruOrder: [] });
  });

  it('actually persists the touch-to-front onto spaceLruOrder', () => {
    useSpaceStore.setState({
      spaces: {
        sp_a: {
          masterSessionId: null,
          messages: [],
          isHydrating: false,
          isSending: false,
          isStreaming: false,
          replyNotice: null,
          activeCapability: null,
          activePanelHint: null,
        },
        sp_b: {
          masterSessionId: null,
          messages: [],
          isHydrating: false,
          isSending: false,
          isStreaming: false,
          replyNotice: null,
          activeCapability: null,
          activePanelHint: null,
        },
      },
      spaceLruOrder: ['sp_b', 'sp_a'],
    });

    useSpaceStore.getState().setActiveSpaceId('sp_a');

    // Before the fix, this stayed ['sp_b', 'sp_a'] -- setActiveSpaceId wrote
    // its touched order under a stray `lruOrder` key instead of the store's
    // actual `spaceLruOrder` field, so the touch-to-front silently no-op'd.
    expect(useSpaceStore.getState().spaceLruOrder).toEqual(['sp_a', 'sp_b']);
  });
});

/**
 * Review on PR #217 caught a real regression these tests were missing:
 * `applySpacePatch` had the same `{ spaces, lruOrder }` vs. `spaceLruOrder`
 * field-name bug as `setActiveSpaceId` (KAZI-668) -- but once Clinic's
 * messages live in this same `spaces` record, that bug meant the *next*
 * real Space write (`setSpaceMessages`, `setSpaceSending`, etc.) would
 * silently prune `__clinic__` out of `spaces` entirely via
 * `pruneSpacesToLru`, because the stale `spaceLruOrder` it computed from
 * never included `__clinic__`. Unlike ordinary Space eviction correctness
 * (still a real, separate finding — see KAZI-668's broader note), this one
 * was squarely this PR's to not ship broken, since only this migration
 * put Clinic at risk of it. Fixed in `applySpacePatch`/`clearSpaceSlice`,
 * plus `__clinic__` is now unconditionally exempt from LRU eviction (not
 * just via `protectSpaceId`, which only covers the *active* space) --
 * these tests exercise the real actions end-to-end, not `setState`.
 */
describe('KAZI-651 review: __clinic__ survives real Space writes, not just reset()', () => {
  beforeEach(() => {
    useSpaceStore.setState({ activeSpaceId: null, spaces: {}, spaceLruOrder: [] });
  });

  it('is not pruned when a subsequent real Space message write fires', () => {
    useSpaceStore.getState().setSpaceMessages(CLINIC_SPACE_ID, [
      { id: 'u1', role: 'user', content: 'clinic message' },
    ]);
    useSpaceStore.getState().setSpaceMessages('sp_real', [
      { id: 'u2', role: 'user', content: 'space message' },
    ]);

    const state = useSpaceStore.getState();
    expect(state.spaces[CLINIC_SPACE_ID]?.messages).toEqual([
      { id: 'u1', role: 'user', content: 'clinic message' },
    ]);
    expect(state.spaces.sp_real?.messages).toEqual([
      { id: 'u2', role: 'user', content: 'space message' },
    ]);
    expect(state.spaceLruOrder).toContain(CLINIC_SPACE_ID);
  });

  it('survives even after real Spaces exceed the LRU cap', () => {
    useSpaceStore.getState().setSpaceMessages(CLINIC_SPACE_ID, [
      { id: 'u1', role: 'user', content: 'clinic message' },
    ]);
    for (let i = 0; i < SPACE_SLICE_LRU_LIMIT + 3; i++) {
      useSpaceStore.getState().setSpaceMessages(`sp_${i}`, [
        { id: `m_${i}`, role: 'user', content: String(i) },
      ]);
    }

    const state = useSpaceStore.getState();
    expect(state.spaces[CLINIC_SPACE_ID]).toBeDefined();
    expect(state.spaces[CLINIC_SPACE_ID]?.messages).toEqual([
      { id: 'u1', role: 'user', content: 'clinic message' },
    ]);
    // Real spaces still cap at the limit -- Clinic is an extra slot on top,
    // not a free pass for real Spaces to also dodge eviction.
    const realSpaceCount = Object.keys(state.spaces).filter(
      (id) => id !== CLINIC_SPACE_ID
    ).length;
    expect(realSpaceCount).toBeLessThanOrEqual(SPACE_SLICE_LRU_LIMIT);
    expect(state.spaces.sp_0).toBeUndefined();
  });

  it('spaceLruOrder is now actually updated by setSpaceMessages (applySpacePatch fix)', () => {
    useSpaceStore.getState().setSpaceMessages('sp_a', [{ id: 'u1', role: 'user', content: 'a' }]);
    expect(useSpaceStore.getState().spaceLruOrder).toEqual(['sp_a']);
    useSpaceStore.getState().setSpaceMessages('sp_b', [{ id: 'u2', role: 'user', content: 'b' }]);
    expect(useSpaceStore.getState().spaceLruOrder).toEqual(['sp_b', 'sp_a']);
  });

  it('clearSpaceSlice correctly updates spaceLruOrder too', () => {
    useSpaceStore.getState().setSpaceMessages('sp_a', [{ id: 'u1', role: 'user', content: 'a' }]);
    useSpaceStore.getState().setSpaceMessages('sp_b', [{ id: 'u2', role: 'user', content: 'b' }]);

    useSpaceStore.getState().clearSpaceSlice('sp_a');

    const state = useSpaceStore.getState();
    expect(state.spaces.sp_a).toBeUndefined();
    expect(state.spaceLruOrder).toEqual(['sp_b']);
  });
});
