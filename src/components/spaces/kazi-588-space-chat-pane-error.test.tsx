/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SpaceDetail } from '@/types/spaces';

const retryHistory = vi.fn(async () => undefined);

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/hooks/use-space-turn', () => ({
  useSpaceTurn: () => ({
    messages: [],
    isHydrating: false,
    isHistoryFetching: false,
    historyError: true,
    historyReady: false,
    isSending: false,
    replyNotice: null,
    sendMessage: async () => ({ ok: false as const, error: 'no' }),
    retryMessage: async () => ({ ok: false as const, error: 'no' }),
    retryHistory,
    hydrateHistoryStubs: async () => undefined,
    enabled: true,
  }),
}));

vi.mock('@/hooks/use-chat-scroll', () => ({
  useChatScroll: () => ({
    scrollRef: { current: null },
    showJumpToLatest: false,
    handleScroll: () => undefined,
    jumpToLatest: () => undefined,
    pinToLatestOnSend: () => undefined,
  }),
}));

vi.mock('@/hooks/use-history-stub-hydrate', () => ({
  useHistoryStubHydrate: () => undefined,
}));

vi.mock('@/hooks/use-active-workspace-chrome', () => ({
  useActiveWorkspaceRailEvents: () => undefined,
}));

vi.mock('@/components/chat/chat-side-rails-host', () => ({
  ChatSideRailsHost: ({ children }: { children: unknown }) => children,
}));

vi.mock('@/components/spaces/space-shell', () => ({
  SpaceShell: ({ children }: { children: unknown }) => <div>{children}</div>,
}));

vi.mock('@/components/clinic/message-bubble', () => ({
  MessageBubble: () => null,
}));

import { SpaceChatPane } from '@/components/spaces/space-chat-pane';

const blankSpace: SpaceDetail = {
  id: 'sp_blank',
  name: 'Blank',
  template_id: 'blank_conversation',
  status: 'active',
  master_session_id: 'sess_blank',
  last_active_at: '2026-08-21T00:00:00.000Z',
  is_entry_point: false,
  is_system: false,
  config_snapshot: {},
  space_state: {},
  created_at: null,
  updated_at: null,
};

describe('KAZI-588 R3 SpaceChatPane history error UI', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
  });

  beforeEach(() => {
    retryHistory.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders retry instead of blank welcome and calls retryHistory', () => {
    act(() => {
      root.render(<SpaceChatPane locale="en" space={blankSpace} />);
    });
    expect(container.textContent).toContain('historyLoadFailed');
    expect(container.textContent).toContain('historyRetry');
    expect(container.textContent).not.toContain('blankWelcome');
    act(() => {
      container.querySelector('button')?.click();
    });
    expect(retryHistory).toHaveBeenCalledTimes(1);
  });
});
