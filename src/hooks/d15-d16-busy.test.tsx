/**
 * @vitest-environment jsdom
 *
 * kazispace-ui States: D15 (slow line after 10 s), Busy (countdown on the
 * failed bubble's "Try again"), D16 (messages typed offline are queued and
 * sent in order when the connection returns).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { MessageBubble, SLOW_WAIT_MS } from '@/components/clinic/message-bubble';
import { useAgentStore } from '@/lib/store';

const sendAgentChat = vi.fn();

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}));

vi.mock('@/lib/agent-api', () => ({
  sendAgentChat: (...args: unknown[]) => sendAgentChat(...args),
  fetchAgentMessages: vi.fn(),
}));

vi.mock('@/lib/handle-agent-envelope', () => ({
  handleAgentEnvelope: () => ({ assistant: { content: 'ok' } }),
}));

vi.mock('@/lib/agent-pending-transition', () => ({
  parsePendingTransition: () => null,
}));

import { useAgentChat } from '@/hooks/use-agent-chat';
import { useOfflineQueueFlush } from '@/hooks/use-offline-queue-flush';

const AGENT = 'english_tutor';

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  useAgentStore.getState().setAgentMessages(AGENT, []);
  sendAgentChat.mockReset();
  setOnline(true);
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  vi.useRealTimers();
  setOnline(true);
});

describe('D15 slow reply', () => {
  it('adds the slow line after 10 seconds and keeps waiting', () => {
    vi.useFakeTimers();
    act(() =>
      root!.render(
        <MessageBubble role="assistant" content="" isStreaming streamComplete={false} />
      )
    );
    act(() => {
      vi.advanceTimersByTime(SLOW_WAIT_MS - 1);
    });
    expect(host!.querySelector('[data-testid="reply-slow"]')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(host!.querySelector('[data-testid="reply-slow"]')?.textContent).toBe(
      'states.slow'
    );
  });
});

describe('Busy countdown', () => {
  it('keeps "Try again" disabled until the wait is over', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-18T12:00:00Z'));
    const retryAt = Date.now() + 3000;
    act(() =>
      root!.render(
        <MessageBubble
          role="user"
          content="Hi"
          status="failed"
          retryAt={retryAt}
          onRetry={() => {}}
        />
      )
    );
    const button = () => host!.querySelector('button') as HTMLButtonElement;
    const marker = () => host!.querySelector('[data-testid="message-not-sent"]');
    expect(button().disabled).toBe(true);
    expect(marker()?.textContent).toContain('states.busy');

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(button().disabled).toBe(false);
    expect(marker()?.textContent).toContain('states.notSent');
  });

  it('marks a busy specialist failure with a retry time', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-18T12:00:00Z'));
    let api: ReturnType<typeof useAgentChat> | null = null;
    function Probe() {
      api = useAgentChat(AGENT, 'sess_1', 'en');
      return null;
    }
    act(() => root!.render(<Probe />));
    sendAgentChat.mockResolvedValueOnce({
      success: false,
      error: 'busy',
      errorCode: 'LLM_BUSY',
      retryAfter: 5,
    });
    await act(async () => {
      await api!.sendMessage('Hello');
    });
    expect(useAgentStore.getState().getAgentMessages(AGENT)[0]).toMatchObject({
      status: 'failed',
      retryAt: Date.now() + 5000,
    });
  });
});

describe('D16 offline queue', () => {
  it('queues messages typed offline and sends them in order when back online', async () => {
    let api: ReturnType<typeof useAgentChat> | null = null;
    function Probe() {
      api = useAgentChat(AGENT, 'sess_1', 'en');
      useOfflineQueueFlush(
        () =>
          useAgentStore
            .getState()
            .getAgentMessages(AGENT)
            .filter((m) => m.role === 'user' && m.status === 'queued')
            .map((m) => m.id),
        (id) => api!.retryMessage(id)
      );
      return null;
    }

    setOnline(false);
    act(() => root!.render(<Probe />));

    const actionMeta = { action_type: 'form_submit', form_id: 'et_intake' };
    await act(async () => {
      await api!.sendMessage('Level: B1', { displayContent: 'Level: B1', actionMeta });
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 2));
      await api!.sendMessage('Second message');
    });

    expect(sendAgentChat).not.toHaveBeenCalled();
    const queued = useAgentStore.getState().getAgentMessages(AGENT);
    expect(queued.map((m) => m.status)).toEqual(['queued', 'queued']);

    sendAgentChat.mockResolvedValue({ success: true, data: {} });
    setOnline(true);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(sendAgentChat).toHaveBeenCalledTimes(2);
    expect(sendAgentChat.mock.calls[0]).toEqual([
      AGENT,
      'Level: B1',
      'sess_1',
      { actionMeta },
    ]);
    expect(sendAgentChat.mock.calls[1]).toEqual([
      AGENT,
      'Second message',
      'sess_1',
      undefined,
    ]);
    const users = useAgentStore
      .getState()
      .getAgentMessages(AGENT)
      .filter((m) => m.role === 'user');
    expect(users.map((m) => m.status)).toEqual(['sent', 'sent']);
  });
});

describe('D16 queue flush follows the open conversation (#246 review)', () => {
  function FlushProbe({
    active,
    queues,
    send,
  }: {
    active: string;
    queues: Record<string, string[]>;
    send: (id: string) => Promise<unknown>;
  }) {
    useOfflineQueueFlush(() => [...(queues.main ?? []), ...(queues[active] ?? [])], send, [active]);
    return null;
  }

  it('sends a message queued in a specialist that was closed when the connection returned, once it is opened', async () => {
    setOnline(false);
    const queues: Record<string, string[]> = { main: [], a: ['a1'] };
    const sent: string[] = [];
    const send = async (id: string) => {
      sent.push(id);
      for (const key of Object.keys(queues)) queues[key] = queues[key].filter((x) => x !== id);
    };

    // The user is in the main chat (not specialist A) when the connection returns.
    await act(async () => root!.render(<FlushProbe active="main" queues={queues} send={send} />));
    setOnline(true);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    expect(sent).toEqual([]);

    // Opening specialist A sends what was queued there.
    await act(async () => root!.render(<FlushProbe active="a" queues={queues} send={send} />));
    expect(sent).toEqual(['a1']);
  });

  it('does not send a message twice when the user already sent it with "Try again" during a flush', async () => {
    const queues: Record<string, string[]> = { main: ['m1', 'm2'] };
    const sent: string[] = [];
    let release: () => void = () => {};
    const send = async (id: string) => {
      sent.push(id);
      queues.main = queues.main.filter((x) => x !== id);
      if (id === 'm1') {
        // While m1 is in flight, the user taps "Try again" on m2.
        queues.main = queues.main.filter((x) => x !== 'm2');
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
    };

    await act(async () => root!.render(<FlushProbe active="main" queues={queues} send={send} />));
    await act(async () => release());
    expect(sent).toEqual(['m1']);
  });
});

describe('D16 queued bubble', () => {
  it('says "Waiting to send" and offers "Try again" only while online', async () => {
    const onRetry = vi.fn();
    setOnline(true);
    await act(async () =>
      root!.render(
        <MessageBubble role="user" content="Hi" locale="en" status="queued" onRetry={onRetry} />
      )
    );
    const marker = host!.querySelector('[data-testid="message-queued"]');
    expect(marker?.textContent).toContain('states.queued');
    const button = Array.from(host!.querySelectorAll('button')).find(
      (b) => b.textContent === 'states.retry'
    );
    expect(button).toBeDefined();
    act(() => button!.click());
    expect(onRetry).toHaveBeenCalledTimes(1);

    await act(async () => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(
      Array.from(host!.querySelectorAll('button')).some((b) => b.textContent === 'states.retry')
    ).toBe(false);
  });
});
