/**
 * @vitest-environment jsdom
 */
import {
  act,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { HubMessageVirtuosoProps } from '@/components/chat/hub-message-virtuoso';
import { StaticHubMessageRows } from '@/components/chat/hub-message-static-rows';
import { restoreSpaceChatScrollAfterVirtualize } from '@/lib/spaces/space-message-virtualize';
import type { HubListMessage } from '@/components/chat/hub-message-row';

const virtuosoGate = vi.hoisted(() => {
  let resolveMod: ((value: { HubMessageVirtuoso: unknown }) => void) | null =
    null;
  let promise = new Promise<{ HubMessageVirtuoso: unknown }>((resolve) => {
    resolveMod = resolve;
  });
  return {
    load: () => promise,
    reset() {
      promise = new Promise<{ HubMessageVirtuoso: unknown }>((resolve) => {
        resolveMod = resolve;
      });
    },
    resolveWith(comp: unknown) {
      resolveMod?.({ HubMessageVirtuoso: comp });
      return promise;
    },
  };
});

vi.mock('@/lib/chat/load-hub-message-virtuoso', () => ({
  loadHubMessageVirtuoso: () => virtuosoGate.load(),
}));

vi.mock('@/components/chat/hub-message-row', () => ({
  HubMessageRow: ({ message }: { message: { id: string } }) => (
    <div data-message-id={message.id} style={{ height: 40 }}>
      {message.id}
    </div>
  ),
}));

import { HubMessageList } from '@/components/chat/hub-message-list';

function TestVirtuoso({
  messages,
  locale,
  isStreaming,
  scrollParentRef,
  initialScrollTop = 0,
}: HubMessageVirtuosoProps) {
  useLayoutEffect(() => {
    const el = scrollParentRef.current;
    if (el) restoreSpaceChatScrollAfterVirtualize(el, initialScrollTop);
  }, [initialScrollTop, scrollParentRef]);
  return (
    <div data-testid="hub-virtuoso">
      <StaticHubMessageRows
        messages={messages}
        locale={locale}
        isStreaming={isStreaming}
      />
    </div>
  );
}

function makeMessages(count: number): HubListMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `h${i + 1}`,
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `row ${i + 1}`,
  }));
}

function Harness({
  initialCount,
  setCountRef,
}: {
  initialCount: number;
  setCountRef: { current: (n: number) => void };
}) {
  const [count, setCount] = useState(initialCount);
  setCountRef.current = setCount;
  const scrollRef = useRef<HTMLDivElement>(null);
  const messages = useMemo(() => makeMessages(count), [count]);
  return (
    <div
      ref={scrollRef}
      data-testid="scroll-parent"
      style={{ height: 200, overflow: 'auto' }}
    >
      <HubMessageList
        messages={messages}
        locale="en"
        isStreaming={false}
        scrollParentRef={scrollRef}
      />
    </div>
  );
}

function wireOverflow(el: HTMLElement, scrollHeight = 2400, clientHeight = 200) {
  Object.defineProperty(el, 'scrollHeight', {
    configurable: true,
    value: scrollHeight,
  });
  Object.defineProperty(el, 'clientHeight', {
    configurable: true,
    value: clientHeight,
  });
}

describe('KAZI-576 hub threshold swap keeps rows and scroll', () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  beforeAll(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    host?.remove();
    root = null;
    host = null;
    virtuosoGate.reset();
  });

  it('59→60 keeps existing rows and scrollTop while the chunk is pending', async () => {
    const setCountRef = { current: (_n: number) => undefined };
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    act(() => {
      root!.render(<Harness initialCount={59} setCountRef={setCountRef} />);
    });

    const scrollParent = host.querySelector(
      '[data-testid="scroll-parent"]'
    ) as HTMLElement;
    wireOverflow(scrollParent);
    act(() => {
      scrollParent.scrollTop = 80;
    });
    expect(host.querySelectorAll('[data-message-id]')).toHaveLength(59);
    expect(scrollParent.scrollTop).toBe(80);

    act(() => {
      setCountRef.current(60);
    });

    expect(host.querySelector('[data-testid="hub-virtuoso"]')).toBeNull();
    const idsWhilePending = [
      ...host.querySelectorAll('[data-message-id]'),
    ].map((node) => node.getAttribute('data-message-id'));
    expect(idsWhilePending).toHaveLength(60);
    expect(idsWhilePending.slice(0, 59)).toEqual(
      Array.from({ length: 59 }, (_, i) => `h${i + 1}`)
    );
    expect(scrollParent.scrollTop).toBe(80);

    await act(async () => {
      await virtuosoGate.resolveWith(TestVirtuoso);
    });

    const afterParent = host.querySelector(
      '[data-testid="scroll-parent"]'
    ) as HTMLElement;
    expect(afterParent).toBe(scrollParent);
    const idsAfter = [
      ...host.querySelectorAll('[data-message-id]'),
    ].map((node) => node.getAttribute('data-message-id'));
    expect(new Set(idsAfter).size).toBe(60);
    expect(idsAfter).toHaveLength(60);
    expect(host.querySelector('[data-testid="hub-virtuoso"]')).not.toBeNull();
    expect(afterParent.scrollTop).toBe(80);
    expect(afterParent.scrollTop).not.toBe(0);
  });
});
