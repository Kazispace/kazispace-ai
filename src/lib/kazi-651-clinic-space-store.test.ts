import { describe, expect, it, beforeEach } from 'vitest';

import { useSpaceStore } from '@/lib/store';
import { CLINIC_SPACE_ID } from '@/lib/spaces/constants';

/**
 * Preconditions here are seeded via `setState` directly, not via the
 * `setSpaceMessages`/etc. actions. Those actions all funnel through
 * `applySpacePatch`, which has its own pre-existing, unrelated bug (spreads
 * `{ spaces, lruOrder }` from `patchSpaceSliceWithLru` directly into `set()`,
 * but the store's real field is `spaceLruOrder` — so `spaceLruOrder` is
 * never actually updated by any space-slice-mutating action today). That's
 * a real, separate finding reported on its own ticket, not fixed here —
 * fixing it touches every Space action, not just Clinic's migration.
 */

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
