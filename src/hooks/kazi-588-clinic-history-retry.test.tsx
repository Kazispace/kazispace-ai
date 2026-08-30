/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
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

    act(() => {
      root.render(<ClinicHistoryProbe />);
    });

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
