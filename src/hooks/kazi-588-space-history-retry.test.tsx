/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { spaceChatFirstPaintKind } from '@/lib/spaces/space-history-ready';
import { useSpaceStore } from '@/lib/store';
import type { SpaceChatMessage } from '@/lib/spaces/turn';

const queryState = vi.hoisted(() => ({
  data: undefined as SpaceChatMessage[] | undefined,
  isSuccess: false,
  isError: true,
  isFetching: false,
  refetch: vi.fn(),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/lib/spaces/constants', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/spaces/constants')>();
  return { ...actual, isSpacesEnabled: () => true };
});

vi.mock('@/hooks/use-space-history', () => ({
  useSpaceHistoryQuery: () => queryState,
  useFetchSpaceHistory: () => async () => [],
  useHydrateSpaceHistory: () => async () => [],
}));

import { useSpaceTurn } from '@/hooks/use-space-turn';

function SpaceTurnProbe() {
  const {
    messages,
    historyError,
    isHydrating,
    isHistoryFetching,
    historyReady,
    retryHistory,
  } = useSpaceTurn('sp_blank', 'sess_blank', 'en');
  const kind = spaceChatFirstPaintKind({
    historyReady,
    isHydrating,
    messageCount: messages.length,
    historyError,
    isFetching: isHistoryFetching,
  });
  return (
    <div>
      <span data-testid="kind">{kind}</span>
      <span data-testid="count">{messages.length}</span>
      {kind === 'error' ? (
        <button type="button" data-testid="retry" onClick={() => void retryHistory()}>
          retry
        </button>
      ) : null}
    </div>
  );
}

describe('KAZI-588 R3 Space history error is user-retryable', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
  });

  beforeEach(() => {
    queryState.data = undefined;
    queryState.isSuccess = false;
    queryState.isError = true;
    queryState.isFetching = false;
    queryState.refetch.mockReset();
    queryState.refetch.mockImplementation(async () => {
      queryState.data = [{ id: 'm1', role: 'assistant', content: 'kept' }];
      queryState.isSuccess = true;
      queryState.isError = false;
      queryState.isFetching = false;
      return { data: queryState.data };
    });
    useSpaceStore.getState().reset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useSpaceStore.getState().reset();
  });

  it('empty error first paint is error, retry in-flight is loading, warm rows stay messages', () => {
    expect(
      spaceChatFirstPaintKind({
        historyReady: false,
        isHydrating: false,
        messageCount: 0,
        historyError: true,
      })
    ).toBe('error');
    expect(
      spaceChatFirstPaintKind({
        historyReady: false,
        isHydrating: false,
        messageCount: 0,
        historyError: true,
        isFetching: true,
      })
    ).toBe('loading');
    expect(
      spaceChatFirstPaintKind({
        historyReady: true,
        isHydrating: false,
        messageCount: 2,
        historyError: true,
      })
    ).toBe('messages');
  });

  it('failed history shows retry, click recovers messages', async () => {
    act(() => {
      root.render(<SpaceTurnProbe />);
    });

    expect(container.querySelector('[data-testid="kind"]')?.textContent).toBe('error');
    expect(container.querySelector('[data-testid="count"]')?.textContent).toBe('0');
    expect(container.querySelector('[data-testid="retry"]')).toBeTruthy();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="retry"]')?.click();
    });
    await act(async () => {
      root.render(<SpaceTurnProbe />);
    });

    expect(queryState.refetch).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="kind"]')?.textContent).toBe(
      'messages'
    );
    expect(container.querySelector('[data-testid="count"]')?.textContent).toBe('1');
  });
});
