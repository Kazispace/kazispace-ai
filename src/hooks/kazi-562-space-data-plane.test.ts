import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchSpaceDetail,
  spaceDetailQueryKey,
} from '@/hooks/use-space-detail';
import {
  fetchSpaceHistoryMessages,
  preserveSpaceMessageRows,
  spaceHistoryQueryKey,
} from '@/lib/spaces/space-history-query';
import type { SpaceChatMessage } from '@/lib/spaces/turn';

const fetchChatHistory = vi.fn();
const getSpace = vi.fn();

vi.mock('@/lib/api-client', () => ({
  fetchChatHistory: (...args: unknown[]) => fetchChatHistory(...args),
}));

vi.mock('@/lib/spaces-api', () => ({
  getSpace: (...args: unknown[]) => getSpace(...args),
}));

function msg(
  id: string,
  content: string,
  role: 'user' | 'assistant' = 'assistant'
): SpaceChatMessage {
  return { id, role, content };
}

describe('KAZI-562 space query runtime contracts', () => {
  beforeEach(() => {
    fetchChatHistory.mockReset();
    getSpace.mockReset();
  });

  it('dedupes concurrent history fetchQuery calls to one network request', async () => {
    let resolveFetch: (value: unknown) => void = () => undefined;
    fetchChatHistory.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const key = spaceHistoryQueryKey('ms_1', 'en');
    const queryFn = ({ signal }: { signal?: AbortSignal }) =>
      fetchSpaceHistoryMessages('ms_1', 'en', signal);

    const p1 = client.fetchQuery({ queryKey: key, queryFn });
    const p2 = client.fetchQuery({ queryKey: key, queryFn });

    expect(fetchChatHistory).toHaveBeenCalledTimes(1);

    resolveFetch({
      success: true,
      data: [{ id: 'a1', role: 'assistant', content: 'hi' }],
    });
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual(r2);
    expect(r1).toHaveLength(1);
  });

  it('aborts in-flight history when Query signal aborts', async () => {
    const seenSignals: AbortSignal[] = [];
    fetchChatHistory.mockImplementation(
      (_id: string, opts?: { signal?: AbortSignal }) => {
        if (opts?.signal) seenSignals.push(opts.signal);
        return new Promise(() => undefined);
      }
    );

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const key = spaceHistoryQueryKey('ms_abort', 'zh');
    const promise = client.fetchQuery({
      queryKey: key,
      queryFn: ({ signal }) =>
        fetchSpaceHistoryMessages('ms_abort', 'zh', signal),
    });

    await Promise.resolve();
    expect(seenSignals).toHaveLength(1);
    client.cancelQueries({ queryKey: key });
    await expect(promise).rejects.toThrow();
    expect(seenSignals[0]?.aborted).toBe(true);
  });

  it('passes Query signal through fetchSpaceDetail → getSpace', async () => {
    const controller = new AbortController();
    getSpace.mockResolvedValue({
      success: true,
      data: {
        id: 'sp_1',
        name: 'S',
        template_id: 'blank_conversation',
        status: 'active',
        is_entry_point: false,
        is_system: false,
        master_session_id: 'ms_1',
        last_active_at: null,
        config_snapshot: {},
        space_state: {},
        created_at: null,
        updated_at: null,
      },
    });

    await fetchSpaceDetail('sp_1', controller.signal);
    expect(getSpace).toHaveBeenCalledWith('sp_1', {
      signal: controller.signal,
    });
    expect(spaceDetailQueryKey('sp_1')).toEqual(['space-detail', 'sp_1']);
  });

  it('warm revalidate keeps previous array identity when rows unchanged', () => {
    const previous = [msg('u1', 'hello', 'user'), msg('a1', 'world')];
    const next = [msg('u1', 'hello', 'user'), msg('a1', 'world')];
    expect(preserveSpaceMessageRows(previous, next)).toBe(previous);
  });

  it('warm revalidate returns new rows when content changes', () => {
    const previous = [msg('a1', 'old')];
    const next = [msg('a1', 'new')];
    const result = preserveSpaceMessageRows(previous, next);
    expect(result).not.toBe(previous);
    expect(result[0]?.content).toBe('new');
  });
});
