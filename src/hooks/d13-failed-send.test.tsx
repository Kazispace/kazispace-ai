/**
 * @vitest-environment jsdom
 *
 * D13 / D14 (kazispace-ui decisions): a message that fails to send keeps the
 * user's bubble, marks it "Not sent" and offers "Try again" (`states.retry`).
 * No warning is written into the reply bubble.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { MessageBubble } from '@/components/clinic/message-bubble';
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
  handleAgentEnvelope: () => ({ assistant: { content: 'Hello again' } }),
}));

vi.mock('@/lib/agent-pending-transition', () => ({
  parsePendingTransition: () => null,
}));

import { useAgentChat } from '@/hooks/use-agent-chat';

const AGENT = 'cv_builder';

let api: ReturnType<typeof useAgentChat> | null = null;

function Probe() {
  api = useAgentChat(AGENT, 'sess_1', 'en');
  return null;
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  useAgentStore.getState().setAgentMessages(AGENT, []);
  sendAgentChat.mockReset();
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  api = null;
});

describe('D13 specialist send failure', () => {
  it('marks the user bubble failed, drops the reply placeholder, and retries in place', async () => {
    act(() => root!.render(<Probe />));

    sendAgentChat.mockResolvedValueOnce({ success: false, error: 'Failed to fetch' });
    await act(async () => {
      await api!.sendMessage('Rewrite my summary');
    });

    let messages = useAgentStore.getState().getAgentMessages(AGENT);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      role: 'user',
      content: 'Rewrite my summary',
      status: 'failed',
    });
    expect(messages.some((m) => m.content.includes('⚠️'))).toBe(false);

    sendAgentChat.mockResolvedValueOnce({ success: true, data: {} });
    const failedId = messages[0].id;
    await act(async () => {
      await api!.retryMessage(failedId);
    });

    messages = useAgentStore.getState().getAgentMessages(AGENT);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ id: failedId, status: 'sent' });
    expect(messages[1]).toMatchObject({ role: 'assistant', content: 'Hello again' });
    expect(sendAgentChat).toHaveBeenLastCalledWith(
      AGENT,
      'Rewrite my summary',
      'sess_1',
      undefined
    );
  });
});

describe('D13 bubble', () => {
  it('shows "Not sent" and a "Try again" button on a failed user message', () => {
    const onRetry = vi.fn();
    act(() =>
      root!.render(
        <MessageBubble
          role="user"
          content="Hi"
          locale="en"
          status="failed"
          onRetry={onRetry}
        />
      )
    );

    const marker = host!.querySelector('[data-testid="message-not-sent"]');
    expect(marker?.textContent).toContain('states.notSent');
    const button = Array.from(host!.querySelectorAll('button')).find(
      (b) => b.textContent === 'states.retry'
    );
    expect(button).toBeDefined();
    act(() => button!.click());
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows nothing extra on a sent message', () => {
    act(() =>
      root!.render(<MessageBubble role="user" content="Hi" locale="en" status="sent" />)
    );
    expect(host!.querySelector('[data-testid="message-not-sent"]')).toBeNull();
  });
});
