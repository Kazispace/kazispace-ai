/**
 * @vitest-environment jsdom
 *
 * KAZI-1171 UAT 14205: `spaces` is [] before the first load, so callers that act on
 * "no Space" must wait for `hasLoaded` — it turns true only once `listSpaces` settles.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  resolve: null as null | ((v: unknown) => void),
  seen: [] as Array<{ hasLoaded: boolean; n: number; error: string | null }>,
}));

vi.mock('@/lib/spaces/constants', async (orig) => ({
  ...(await orig<typeof import('@/lib/spaces/constants')>()),
  isSpacesEnabled: () => true,
}));
vi.mock('@/lib/spaces-api', () => ({
  listSpaces: () => new Promise((r) => (state.resolve = r)),
}));
vi.mock('@/lib/spaces/prefetch-space-switch', () => ({ prefetchRecentSpaceSwitches: () => {} }));
vi.mock('@/lib/spaces/space-detail-from-summary', () => ({ seedSpaceDetailPlaceholders: () => {} }));
vi.mock('@/lib/store', () => ({
  useAuthStore: (sel: (s: { isLoggedIn: boolean }) => unknown) => sel({ isLoggedIn: true }),
}));

import { useSpaces } from '@/hooks/use-spaces';

function Probe() {
  const { spaces, hasLoaded, error } = useSpaces({ fetchImmediately: true, locale: 'zh' });
  state.seen.push({ hasLoaded, n: spaces.length, error });
  return null;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  root = createRoot(container);
  state.seen = [];
  state.resolve = null;
});
afterEach(() => act(() => root.unmount()));

const mount = () =>
  act(async () => {
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <Probe />
      </QueryClientProvider>
    );
  });

describe('useSpaces.hasLoaded', () => {
  it('is false with an empty list until the first load settles, then true with the list', async () => {
    await mount();
    expect(state.seen.at(-1)).toEqual({ hasLoaded: false, n: 0, error: null });
    await act(async () => {
      state.resolve?.({ success: true, data: { spaces: [{ id: 'sp1' }, { id: 'sp2' }] } });
    });
    expect(state.seen.at(-1)).toEqual({ hasLoaded: true, n: 2, error: null });
  });

  it('turns true on a failed load too, with the error', async () => {
    await mount();
    await act(async () => {
      state.resolve?.({ success: false, error: 'boom' });
    });
    expect(state.seen.at(-1)).toEqual({ hasLoaded: true, n: 0, error: 'boom' });
  });
});
