/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatHistoryLoadError } from '@/components/chat/chat-history-load-error';
import { clinicHistoryBootstrapOutcome } from '@/lib/clinic/history-bootstrap';
import { useAuthStore, useSpaceStore } from '@/lib/store';
import { CLINIC_SPACE_ID } from '@/lib/spaces/constants';

const fetchChatHistory = vi.fn();

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/lib/api-client', () => ({
  fetchChatHistory: (...args: unknown[]) => fetchChatHistory(...args),
  sendChatMessage: vi.fn(),
  parseClinicReply: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getAuthToken: () => null,
}));

vi.mock('@/lib/master-session', () => ({
  ensureMasterSession: async () => 'sess_clinic',
  syncMasterSession: async () => undefined,
}));

import {
  fetchNormalizedClinicHistory,
  useClinicChat,
} from '@/hooks/use-clinic-chat';

function ClinicHistoryProbe() {
  const { loadHistory, messages, isHistoryLoading } = useClinicChat('en');
  return (
    <div>
      <span data-testid="count">{messages.length}</span>
      <span data-testid="loading">{isHistoryLoading ? '1' : '0'}</span>
      <button
        type="button"
        data-testid="load"
        onClick={() => {
          void loadHistory().then((ok) => {
            document
              .querySelector('[data-testid="ok"]')
              ?.setAttribute('data-ok', ok ? '1' : '0');
          });
        }}
      >
        load
      </button>
      <span data-testid="ok" data-ok="" />
    </div>
  );
}

/**
 * KAZI-651 true Phase C.1b, take 1: `loadHistory` now routes its fetch
 * through `useQueryClient().fetchQuery` (clinicHistoryQueryKey), so this
 * probe needs a real QueryClient in context -- one per test to keep runs
 * isolated, `retry: false` so a mocked failure resolves on the first attempt
 * (matching this suite's own single-mockResolvedValueOnce-per-call setup).
 */
function renderClinicHistoryProbe(root: Root) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <ClinicHistoryProbe />
      </QueryClientProvider>
    );
  });
}

describe('KAZI-588 R3 Clinic history failure is retryable', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
  });

  beforeEach(() => {
    fetchChatHistory.mockReset();
    useSpaceStore.getState().clearSpaceSlice(CLINIC_SPACE_ID);
    useAuthStore.setState({ isLoggedIn: true });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useSpaceStore.getState().clearSpaceSlice(CLINIC_SPACE_ID);
  });

  it('does not mark a failed history GET as a completed bootstrap', () => {
    expect(clinicHistoryBootstrapOutcome(true)).toEqual({
      markComplete: true,
      showHistoryFailed: false,
    });
    expect(clinicHistoryBootstrapOutcome(false)).toEqual({
      markComplete: false,
      showHistoryFailed: true,
    });
  });

  it('throws instead of returning an empty success array', async () => {
    fetchChatHistory.mockResolvedValue({
      success: false,
      error: 'history unavailable',
    });
    await expect(fetchNormalizedClinicHistory('sess_clinic')).rejects.toThrow(
      'history unavailable'
    );
  });

  it('loadHistory fails closed, then retry populates messages', async () => {
    fetchChatHistory.mockResolvedValueOnce({
      success: false,
      error: 'history unavailable',
    });
    fetchChatHistory.mockResolvedValueOnce({
      success: true,
      data: [{ id: 'm1', role: 'assistant', content: 'hello' }],
    });

    renderClinicHistoryProbe(root);

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="load"]')?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="ok"]')?.getAttribute('data-ok')).toBe(
      '0'
    );
    expect(container.querySelector('[data-testid="count"]')?.textContent).toBe('0');

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="load"]')?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="ok"]')?.getAttribute('data-ok')).toBe(
      '1'
    );
    expect(container.querySelector('[data-testid="count"]')?.textContent).toBe('1');
  });

  /**
   * KAZI-651 true Phase C.1b, take 1: the actual value of routing
   * `loadHistory` through `queryClient.fetchQuery` -- two of the 10+
   * clinic-shell.tsx call sites can genuinely race in the same tick (e.g.
   * `reconcileActiveAgentLayer`'s reload racing a keep-alive idle reload).
   * Before this change each call meant its own `fetchChatHistory` network
   * call; now concurrent calls for the same session share one in-flight
   * fetch. This must hold without weakening the "always a fresh read"
   * contract the other test in this suite already covers (second call after
   * the first *resolves* still hits the network).
   */
  it('dedupes concurrent loadHistory calls into a single network fetch', async () => {
    fetchChatHistory.mockResolvedValue({
      success: true,
      data: [{ id: 'm1', role: 'assistant', content: 'hello' }],
    });

    renderClinicHistoryProbe(root);

    await act(async () => {
      const button = container.querySelector<HTMLButtonElement>('[data-testid="load"]');
      button?.click();
      button?.click();
      await Promise.resolve();
    });

    expect(fetchChatHistory).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="count"]')?.textContent).toBe('1');
  });

  it('retry button is clickable after a failed load', () => {
    const onRetry = vi.fn();
    act(() => {
      root.render(
        <ChatHistoryLoadError
          message="Could not load conversation history"
          retryLabel="Try again"
          onRetry={onRetry}
        />
      );
    });
    expect(container.textContent).toContain('Could not load conversation history');
    act(() => {
      container.querySelector('button')?.click();
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
