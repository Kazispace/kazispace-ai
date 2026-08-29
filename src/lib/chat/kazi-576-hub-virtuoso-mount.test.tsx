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

const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 48;

function TestVirtuoso({
  messages,
  locale,
  isStreaming,
  header,
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
        header={header}
      />
    </div>
  );
}

function TestHeader({ label, height }: { label: string; height: number }) {
  return (
    <div
      data-testid="hub-header"
      data-workflow={label}
      style={{ height, flexShrink: 0 }}
    >
      {label}
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
  withHeader = false,
  initialWorkflow = 'wf-a',
  initialHeaderHeight = HEADER_HEIGHT,
  setCountRef,
  setWorkflowRef,
  setHeaderHeightRef,
}: {
  initialCount: number;
  withHeader?: boolean;
  initialWorkflow?: string;
  initialHeaderHeight?: number;
  setCountRef: { current: (n: number) => void };
  setWorkflowRef?: { current: (w: string) => void };
  setHeaderHeightRef?: { current: (h: number) => void };
}) {
  const [count, setCount] = useState(initialCount);
  const [workflow, setWorkflow] = useState(initialWorkflow);
  const [headerHeight, setHeaderHeight] = useState(initialHeaderHeight);
  setCountRef.current = setCount;
  if (setWorkflowRef) setWorkflowRef.current = setWorkflow;
  if (setHeaderHeightRef) setHeaderHeightRef.current = setHeaderHeight;
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
        header={
          withHeader ? (
            <TestHeader label={workflow} height={headerHeight} />
          ) : undefined
        }
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

function headerHeightOf(root: ParentNode): number {
  const header = root.querySelector('[data-testid="hub-header"]') as HTMLElement | null;
  expect(header).not.toBeNull();
  return Number.parseInt(header!.style.height, 10);
}

function visibleMessageOffset(scrollTop: number, headerHeight: number): number {
  return Math.max(0, scrollTop - headerHeight);
}

function firstVisibleMessageIndex(scrollTop: number, headerHeight: number): number {
  return Math.floor(visibleMessageOffset(scrollTop, headerHeight) / ROW_HEIGHT);
}

function assertHeaderThenMessages(root: ParentNode) {
  const header = root.querySelector('[data-testid="hub-header"]');
  const firstMsg = root.querySelector('[data-message-id]');
  expect(header).not.toBeNull();
  expect(firstMsg).not.toBeNull();
  expect(header!.compareDocumentPosition(firstMsg!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
    const idsWhilePending = Array.from(host.querySelectorAll('[data-message-id]')).map((node) => node.getAttribute('data-message-id'));
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
    const idsAfter = Array.from(host.querySelectorAll('[data-message-id]')).map((node) => node.getAttribute('data-message-id'));
    expect(new Set(idsAfter).size).toBe(60);
    expect(idsAfter).toHaveLength(60);
    expect(host.querySelector('[data-testid="hub-virtuoso"]')).not.toBeNull();
    expect(afterParent.scrollTop).toBe(80);
    expect(afterParent.scrollTop).not.toBe(0);
  });

  it('59→60 with a measured header keeps the same visible message offset', async () => {
    const setCountRef = { current: (_n: number) => undefined };
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    act(() => {
      root!.render(
        <Harness
          initialCount={59}
          withHeader
          setCountRef={setCountRef}
        />
      );
    });

    const scrollParent = host.querySelector(
      '[data-testid="scroll-parent"]'
    ) as HTMLElement;
    const contentHeight = HEADER_HEIGHT + 60 * ROW_HEIGHT;
    wireOverflow(scrollParent, contentHeight);
    act(() => {
      scrollParent.scrollTop = 80;
    });

    assertHeaderThenMessages(scrollParent);
    expect(headerHeightOf(scrollParent)).toBe(HEADER_HEIGHT);
    const offsetBefore = visibleMessageOffset(80, HEADER_HEIGHT);
    const indexBefore = firstVisibleMessageIndex(80, HEADER_HEIGHT);
    expect(offsetBefore).toBe(32);
    expect(indexBefore).toBe(0);
    expect(scrollParent.querySelector('[data-testid="hub-virtuoso"]')).toBeNull();

    act(() => {
      setCountRef.current(60);
    });

    expect(host.querySelector('[data-testid="hub-virtuoso"]')).toBeNull();
    assertHeaderThenMessages(scrollParent);
    expect(scrollParent.scrollTop).toBe(80);
    expect(
      visibleMessageOffset(scrollParent.scrollTop, headerHeightOf(scrollParent))
    ).toBe(offsetBefore);
    expect(
      firstVisibleMessageIndex(scrollParent.scrollTop, headerHeightOf(scrollParent))
    ).toBe(indexBefore);

    await act(async () => {
      await virtuosoGate.resolveWith(TestVirtuoso);
    });

    expect(
      host.querySelector('[data-testid="hub-virtuoso"] [data-testid="hub-header"]')
    ).not.toBeNull();
    assertHeaderThenMessages(scrollParent);
    expect(scrollParent.scrollTop).toBe(80);
    expect(scrollParent.scrollTop).not.toBe(0);
    expect(
      visibleMessageOffset(scrollParent.scrollTop, headerHeightOf(scrollParent))
    ).toBe(offsetBefore);
    expect(
      firstVisibleMessageIndex(scrollParent.scrollTop, headerHeightOf(scrollParent))
    ).toBe(indexBefore);
    expect(host.querySelectorAll('[data-message-id]')).toHaveLength(60);
  });

  it('long-history restore with a header keeps the same visible message offset', async () => {
    const setCountRef = { current: (_n: number) => undefined };
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    act(() => {
      root!.render(
        <Harness
          initialCount={80}
          withHeader
          setCountRef={setCountRef}
        />
      );
    });

    const scrollParent = host.querySelector(
      '[data-testid="scroll-parent"]'
    ) as HTMLElement;
    const contentHeight = HEADER_HEIGHT + 80 * ROW_HEIGHT;
    wireOverflow(scrollParent, contentHeight);
    act(() => {
      scrollParent.scrollTop = 200;
    });

    assertHeaderThenMessages(scrollParent);
    const offsetBefore = visibleMessageOffset(200, HEADER_HEIGHT);
    const indexBefore = firstVisibleMessageIndex(200, HEADER_HEIGHT);
    expect(offsetBefore).toBe(152);
    expect(indexBefore).toBe(3);
    expect(host.querySelector('[data-testid="hub-virtuoso"]')).toBeNull();
    expect(host.querySelectorAll('[data-message-id]')).toHaveLength(80);

    await act(async () => {
      await virtuosoGate.resolveWith(TestVirtuoso);
    });

    expect(
      host.querySelector('[data-testid="hub-virtuoso"] [data-testid="hub-header"]')
    ).not.toBeNull();
    assertHeaderThenMessages(scrollParent);
    expect(scrollParent.scrollTop).toBe(200);
    expect(scrollParent.scrollTop).not.toBe(0);
    expect(
      visibleMessageOffset(scrollParent.scrollTop, headerHeightOf(scrollParent))
    ).toBe(offsetBefore);
    expect(
      firstVisibleMessageIndex(scrollParent.scrollTop, headerHeightOf(scrollParent))
    ).toBe(indexBefore);
  });

  it('activeWorkflow header changes do not reset restore to the top', async () => {
    const setCountRef = { current: (_n: number) => undefined };
    const setWorkflowRef = { current: (_w: string) => undefined };
    const setHeaderHeightRef = { current: (_h: number) => undefined };
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    act(() => {
      root!.render(
        <Harness
          initialCount={60}
          withHeader
          setCountRef={setCountRef}
          setWorkflowRef={setWorkflowRef}
          setHeaderHeightRef={setHeaderHeightRef}
        />
      );
    });

    const scrollParent = host.querySelector(
      '[data-testid="scroll-parent"]'
    ) as HTMLElement;
    wireOverflow(scrollParent, HEADER_HEIGHT + 60 * ROW_HEIGHT);
    act(() => {
      scrollParent.scrollTop = 80;
    });

    await act(async () => {
      await virtuosoGate.resolveWith(TestVirtuoso);
    });

    const offsetBefore = visibleMessageOffset(80, HEADER_HEIGHT);
    const indexBefore = firstVisibleMessageIndex(80, HEADER_HEIGHT);
    expect(scrollParent.querySelector('[data-workflow="wf-a"]')).not.toBeNull();

    act(() => {
      setWorkflowRef.current('wf-b');
    });

    expect(scrollParent.querySelector('[data-workflow="wf-b"]')).not.toBeNull();
    expect(scrollParent.querySelector('[data-workflow="wf-a"]')).toBeNull();
    assertHeaderThenMessages(scrollParent);
    expect(scrollParent.scrollTop).toBe(80);
    expect(scrollParent.scrollTop).not.toBe(0);
    expect(
      visibleMessageOffset(scrollParent.scrollTop, headerHeightOf(scrollParent))
    ).toBe(offsetBefore);
    expect(
      firstVisibleMessageIndex(scrollParent.scrollTop, headerHeightOf(scrollParent))
    ).toBe(indexBefore);

    act(() => {
      setHeaderHeightRef.current(72);
    });

    expect(headerHeightOf(scrollParent)).toBe(72);
    assertHeaderThenMessages(scrollParent);
    expect(scrollParent.scrollTop).not.toBe(0);
    expect(scrollParent.scrollTop).toBe(80);
    expect(host.querySelector('[data-testid="hub-virtuoso"]')).not.toBeNull();
    expect(host.querySelectorAll('[data-message-id]')).toHaveLength(60);
  });
});
