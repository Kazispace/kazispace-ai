/**
 * @vitest-environment jsdom
 */
import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { HistoryStubPlaceholder } from '@/components/chat/history-stub-placeholder';
import { useHistoryStubHydrate } from '@/hooks/use-history-stub-hydrate';

function Harness({
  hydrate,
  messages,
}: {
  hydrate: (ids: string[]) => Promise<void> | void;
  messages: { id: string; contentPending?: boolean }[];
}) {
  const scrollRoot = useRef<HTMLElement | null>(null);
  useHistoryStubHydrate({
    enabled: true,
    messages,
    scrollRoot,
    hydrate,
  });
  return (
    <div
      ref={(node) => {
        scrollRoot.current = node;
      }}
      data-testid="scroll-root"
      style={{ height: 200, overflow: 'auto' }}
    >
      {messages.map((row) =>
        row.contentPending ? (
          <HistoryStubPlaceholder key={row.id} id={row.id} role="user" />
        ) : (
          <p key={row.id}>{row.id}</p>
        )
      )}
    </div>
  );
}

describe('KAZI-580 stub scroll hydrate', () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;
  let observerCallback: IntersectionObserverCallback | null = null;
  let mutationCallback: MutationCallback | null = null;
  let observeSpy: ReturnType<typeof vi.fn> | null = null;

  beforeAll(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    observerCallback = null;
    mutationCallback = null;
    observeSpy = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe = observeSpy!;
        disconnect = vi.fn();
        unobserve = vi.fn();
        constructor(cb: IntersectionObserverCallback) {
          observerCallback = cb;
        }
      }
    );
    vi.stubGlobal(
      'MutationObserver',
      class {
        observe = vi.fn();
        disconnect = vi.fn();
        constructor(cb: MutationCallback) {
          mutationCallback = cb;
        }
      }
    );
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    host?.remove();
    root = null;
    host = null;
    vi.unstubAllGlobals();
  });

  it('hydrates intersecting stub ids', async () => {
    const hydrate = vi.fn();
    await act(async () => {
      root!.render(
        <Harness
          hydrate={hydrate}
          messages={[
            { id: '1', contentPending: true },
            { id: '2', contentPending: true },
            { id: '3' },
          ]}
        />
      );
    });

    const stubs = host!.querySelectorAll('[data-history-stub]');
    expect(stubs).toHaveLength(2);
    expect(observerCallback).not.toBeNull();

    await act(async () => {
      observerCallback!(
        [
          {
            isIntersecting: true,
            target: stubs[0]!,
          } as unknown as IntersectionObserverEntry,
          {
            isIntersecting: false,
            target: stubs[1]!,
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver
      );
    });

    expect(hydrate).toHaveBeenCalledWith(['1']);
  });

  it('observes stubs Virtuoso mounts after the first scan', async () => {
    const hydrate = vi.fn();
    await act(async () => {
      root!.render(
        <Harness
          hydrate={hydrate}
          messages={[{ id: '1', contentPending: true }]}
        />
      );
    });

    expect(mutationCallback).not.toBeNull();
    const late = document.createElement('div');
    late.dataset.historyStub = 'late';
    host!.querySelector('[data-testid="scroll-root"]')!.appendChild(late);
    const observedBefore = observeSpy!.mock.calls.length;

    await act(async () => {
      mutationCallback!([], {} as MutationObserver);
    });

    expect(observeSpy!.mock.calls.length).toBeGreaterThan(observedBefore);
    expect(
      observeSpy!.mock.calls.some((call) => call[0] === late)
    ).toBe(true);
  });

  it('retries once after a rejected hydrate without waiting for another scroll', async () => {
    const hydrate = vi
      .fn<(ids: string[]) => Promise<void>>()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(undefined);

    await act(async () => {
      root!.render(
        <Harness
          hydrate={hydrate}
          messages={[{ id: '1', contentPending: true }]}
        />
      );
    });

    const stub = host!.querySelector('[data-history-stub]')!;
    await act(async () => {
      observerCallback!(
        [
          {
            isIntersecting: true,
            target: stub,
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(hydrate).toHaveBeenCalledTimes(2);
    expect(hydrate).toHaveBeenNthCalledWith(1, ['1']);
    expect(hydrate).toHaveBeenNthCalledWith(2, ['1']);
    expect(stub.getAttribute('data-failed')).toBeNull();
  });

  it('marks a stub failed after retries exhaust and hydrates again on click', async () => {
    const hydrate = vi
      .fn<(ids: string[]) => Promise<void>>()
      .mockRejectedValue(new Error('network'));

    await act(async () => {
      root!.render(
        <Harness
          hydrate={hydrate}
          messages={[{ id: '1', contentPending: true }]}
        />
      );
    });

    const stub = host!.querySelector('[data-history-stub]') as HTMLElement;
    await act(async () => {
      observerCallback!(
        [
          {
            isIntersecting: true,
            target: stub,
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(hydrate).toHaveBeenCalledTimes(2);
    expect(stub.dataset.failed).toBe('true');
    expect(stub.getAttribute('aria-label')).toBe('Retry loading message');

    hydrate.mockReset();
    hydrate.mockResolvedValue(undefined);

    await act(async () => {
      stub.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(hydrate).toHaveBeenCalledWith(['1']);
    expect(stub.dataset.failed).toBeUndefined();
  });
});
