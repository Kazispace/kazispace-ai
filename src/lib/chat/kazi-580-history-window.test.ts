import { describe, expect, it, vi } from 'vitest';

import {
  applyHistoryWindowRows,
  buildChatHistoryQuery,
  capHistoryHydrateIds,
  isHistoryStub,
  mergeHydratedHistoryRows,
  parseChatHistoryResponse,
  windowedHistoryQuery,
} from '@/lib/chat/history-window';
import {
  applySpaceHistoryWindowRows,
  fetchSpaceHistoryMessages,
  hydrateSpaceHistoryMessages,
  spaceMessageRowFingerprint,
} from '@/lib/spaces/space-history-query';
import { spaceChatFirstPaintKind } from '@/lib/spaces/space-history-ready';
import { mapSpaceHistoryMessages, type SpaceChatMessage } from '@/lib/spaces/turn';
import {
  CHAT_HISTORY_HYDRATE_IDS_MAX,
  CHAT_HISTORY_WINDOW_LIMIT,
} from '@/lib/spaces/perf-policy';

const fetchChatHistory = vi.fn();

vi.mock('@/lib/api-client', () => ({
  fetchChatHistory: (...args: unknown[]) => fetchChatHistory(...args),
}));

function fp(row: SpaceChatMessage): string {
  return spaceMessageRowFingerprint(row);
}

describe('KAZI-580 chat history window', () => {
  it('keeps a legacy JSON array as a complete dump (no silent drop)', () => {
    const parsed = parseChatHistoryResponse([
      { id: '1', role: 'user', content: 'hi' },
      { id: '2', role: 'assistant', content: 'yo' },
    ]);
    expect(parsed.mode).toBe('legacy');
    expect(parsed.hasMore).toBe(false);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows.every((row) => row.content_pending !== true)).toBe(true);
  });

  it('parses envelope as stubs then latest full rows', () => {
    const parsed = parseChatHistoryResponse({
      messages: [
        { id: '40', role: 'user', content: 'recent user' },
        { id: '41', role: 'assistant', content: 'recent assistant' },
      ],
      older_stubs: [
        { id: '1', role: 'user', created_at: '2026-01-01T00:00:00' },
        { id: '2', role: 'assistant', created_at: '2026-01-01T00:00:01' },
      ],
      has_more: true,
      oldest_cursor: '40',
      newest_cursor: '41',
    });
    expect(parsed.mode).toBe('window');
    expect(parsed.hasMore).toBe(true);
    expect(parsed.rows.map((row) => String(row.id))).toEqual([
      '1',
      '2',
      '40',
      '41',
    ]);
    expect(parsed.rows[0]?.content_pending).toBe(true);
    expect(parsed.rows[2]?.content_pending).toBeUndefined();
  });

  it('first-pack query is limit 200 fields=full', () => {
    expect(CHAT_HISTORY_WINDOW_LIMIT).toBe(200);
    expect(windowedHistoryQuery()).toEqual({
      limit: 200,
      fields: 'full',
    });
    expect(buildChatHistoryQuery(windowedHistoryQuery())).toBe(
      '?limit=200&fields=full'
    );
  });

  it('hydrate query uses ids and does not send limit', () => {
    expect(
      buildChatHistoryQuery(windowedHistoryQuery({ ids: '1,2,3' }))
    ).toBe('?ids=1%2C2%2C3&fields=full');
  });

  it('caps hydrate ids at 50 unique values', () => {
    const ids = Array.from({ length: 80 }, (_, i) => String(i));
    expect(capHistoryHydrateIds(ids)).toHaveLength(CHAT_HISTORY_HYDRATE_IDS_MAX);
    expect(capHistoryHydrateIds(['1', '1', '2'])).toEqual(['1', '2']);
  });

  it('maps stubs without dropping them as empty/placeholder', () => {
    const rows = mapSpaceHistoryMessages([
      { id: '1', role: 'user', content_pending: true },
      { id: '2', role: 'assistant', content: '…' },
      { id: '3', role: 'assistant', content: 'hello' },
    ]);
    expect(rows).toEqual([
      { id: '1', role: 'user', content: '', contentPending: true },
      { id: '3', role: 'assistant', content: 'hello', serverMessageId: '3' },
    ]);
    expect(isHistoryStub(rows[0]!)).toBe(true);
    expect(isHistoryStub(rows[1]!)).toBe(false);
  });

  it('historyReady first paint treats stubs as messages, not loading', () => {
    expect(
      spaceChatFirstPaintKind({
        historyReady: true,
        isHydrating: false,
        messageCount: 2,
      })
    ).toBe('messages');
  });

  it('keeps hydrated rows when a window refetch re-sends stubs', () => {
    const hydrated: SpaceChatMessage = {
      id: '1',
      role: 'user',
      content: 'old body',
    };
    const recent: SpaceChatMessage = {
      id: '40',
      role: 'assistant',
      content: 'new',
    };
    const incoming: SpaceChatMessage[] = [
      { id: '1', role: 'user', content: '', contentPending: true },
      recent,
    ];
    const next = applyHistoryWindowRows([hydrated, recent], incoming, fp);
    expect(next[0]).toBe(hydrated);
    expect(next[0]?.content).toBe('old body');
    expect(next[1]?.content).toBe('new');
  });

  it('mergeHydratedHistoryRows replaces stubs by id and keeps others', () => {
    const previous: SpaceChatMessage[] = [
      { id: '1', role: 'user', content: '', contentPending: true },
      { id: '2', role: 'assistant', content: 'recent' },
    ];
    const next = mergeHydratedHistoryRows(previous, [
      { id: '1', role: 'user', content: 'loaded' },
    ]);
    expect(next[0]?.content).toBe('loaded');
    expect(next[0]?.contentPending).toBeUndefined();
    expect(next[1]).toBe(previous[1]);
  });

  it('applySpaceHistoryWindowRows uses id match, not index', () => {
    const previous: SpaceChatMessage[] = [
      { id: '1', role: 'user', content: 'kept' },
    ];
    const incoming: SpaceChatMessage[] = [
      { id: '1', role: 'user', content: '', contentPending: true },
      { id: '9', role: 'assistant', content: 'tail' },
    ];
    const next = applySpaceHistoryWindowRows(previous, incoming);
    expect(next[0]?.content).toBe('kept');
    expect(next[1]?.id).toBe('9');
  });
});

describe('KAZI-580 fetchSpaceHistoryMessages', () => {
  it('requests the windowed first pack and maps envelope stubs', async () => {
    fetchChatHistory.mockReset();
    fetchChatHistory.mockResolvedValue({
      success: true,
      data: {
        messages: [{ id: '40', role: 'assistant', content: 'recent' }],
        older_stubs: [{ id: '1', role: 'user', created_at: '2026-01-01' }],
        has_more: true,
      },
    });

    const rows = await fetchSpaceHistoryMessages('sess_1', 'en');
    expect(fetchChatHistory).toHaveBeenCalledWith(
      'sess_1',
      expect.objectContaining({ limit: 200, fields: 'full' })
    );
    expect(rows).toEqual([
      { id: '1', role: 'user', content: '', contentPending: true },
      { id: '40', role: 'assistant', content: 'recent', serverMessageId: '40' },
    ]);
  });

  it('legacy array response still returns every full body', async () => {
    fetchChatHistory.mockReset();
    fetchChatHistory.mockResolvedValue({
      success: true,
      data: [
        { id: '1', role: 'user', content: 'a' },
        { id: '2', role: 'assistant', content: 'b' },
      ],
    });
    const rows = await fetchSpaceHistoryMessages('sess_legacy', 'zh');
    expect(rows.map((row) => row.content)).toEqual(['a', 'b']);
    expect(rows.some((row) => row.contentPending)).toBe(false);
  });

  it('hydrate by ids fetches fields=full without a full dump', async () => {
    fetchChatHistory.mockReset();
    fetchChatHistory.mockResolvedValue({
      success: true,
      data: {
        messages: [{ id: '1', role: 'user', content: 'loaded' }],
        older_stubs: [],
        has_more: false,
      },
    });
    const rows = await hydrateSpaceHistoryMessages('sess_1', 'en', ['1', '2']);
    expect(fetchChatHistory).toHaveBeenCalledWith(
      'sess_1',
      expect.objectContaining({ ids: '1,2', fields: 'full' })
    );
    expect(fetchChatHistory.mock.calls[0]?.[1]).not.toHaveProperty('limit');
    expect(rows).toEqual([{ id: '1', role: 'user', content: 'loaded' }]);
  });

  it('hydrate by ids caps the request at 50', async () => {
    fetchChatHistory.mockReset();
    fetchChatHistory.mockResolvedValue({
      success: true,
      data: { messages: [], older_stubs: [], has_more: false },
    });
    const ids = Array.from({ length: 80 }, (_, i) => String(i + 1));
    await hydrateSpaceHistoryMessages('sess_1', 'en', ids);
    const sent = String(fetchChatHistory.mock.calls[0]?.[1]?.ids ?? '');
    expect(sent.split(',')).toHaveLength(CHAT_HISTORY_HYDRATE_IDS_MAX);
    expect(fetchChatHistory.mock.calls[0]?.[1]).not.toHaveProperty('limit');
  });

  it('throws on an unsuccessful envelope instead of returning []', async () => {
    fetchChatHistory.mockReset();
    fetchChatHistory.mockResolvedValue({
      success: false,
      error: 'history unavailable',
    });
    await expect(fetchSpaceHistoryMessages('sess_fail', 'zh')).rejects.toThrow(
      'history unavailable'
    );
  });
});
