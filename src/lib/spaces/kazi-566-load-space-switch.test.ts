import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { spaceDetailQueryKey } from '@/hooks/use-space-detail';
import { CLINIC_SPACE_ID } from '@/lib/spaces/constants';
import {
  isPrefetchableSpaceNavId,
  prefetchSpaceSwitch,
} from '@/lib/spaces/prefetch-space-switch';
import {
  seedSpaceDetailPlaceholders,
  spaceDetailFromSummary,
} from '@/lib/spaces/space-detail-from-summary';
import { isSpaceHistoryReadyFromSlice } from '@/lib/spaces/space-history-ready';
import {
  SPACE_HISTORY_QUERY_DEFAULTS,
  spaceHistoryQueryKey,
} from '@/lib/spaces/space-history-query';
import { spaceSummaryToNavRow } from '@/lib/space-nav';
import type { SpaceDetail, SpaceSummary } from '@/types/spaces';

const fetchChatHistory = vi.fn();
const getSpace = vi.fn();

vi.mock('@/lib/api-client', () => ({
  fetchChatHistory: (...args: unknown[]) => fetchChatHistory(...args),
}));

vi.mock('@/lib/spaces-api', () => ({
  getSpace: (...args: unknown[]) => getSpace(...args),
}));

const jobSprint: SpaceSummary = {
  id: 'sp_abc123',
  name: '我的求职冲刺',
  template_id: 'job_sprint',
  status: 'active',
  master_session_id: 'sess_sp_abc123',
  last_active_at: '2026-07-12T10:00:00Z',
};

describe('KAZI-566 space switch + load contracts', () => {
  it('builds a detail placeholder from the sidebar summary', () => {
    const detail = spaceDetailFromSummary(jobSprint);
    expect(detail.id).toBe('sp_abc123');
    expect(detail.master_session_id).toBe('sess_sp_abc123');
    expect(detail.template_id).toBe('job_sprint');
    expect(detail.config_snapshot).toEqual({});
    expect(detail.space_state).toEqual({});
    expect(detail.updated_at).toBe(jobSprint.last_active_at);
  });

  it('seeds missing detail cache as immediately stale', () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    seedSpaceDetailPlaceholders(client, [
      { ...jobSprint, id: CLINIC_SPACE_ID, is_entry_point: true },
      jobSprint,
    ]);

    expect(client.getQueryData(spaceDetailQueryKey(CLINIC_SPACE_ID))).toBeUndefined();
    const seeded = client.getQueryData<SpaceDetail>(
      spaceDetailQueryKey('sp_abc123')
    );
    expect(seeded?.master_session_id).toBe('sess_sp_abc123');
    expect(client.getQueryState(spaceDetailQueryKey('sp_abc123'))?.dataUpdatedAt).toBe(
      0
    );
  });

  it('does not overwrite a fetched space detail', () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const fetched: SpaceDetail = {
      ...spaceDetailFromSummary(jobSprint),
      name: 'Fetched',
      config_snapshot: { rendering: { layout: 'chat_with_panels' } },
    };
    client.setQueryData(spaceDetailQueryKey('sp_abc123'), fetched);
    seedSpaceDetailPlaceholders(client, [{ ...jobSprint, name: 'List name' }]);
    expect(client.getQueryData<SpaceDetail>(spaceDetailQueryKey('sp_abc123'))?.name).toBe(
      'Fetched'
    );
  });

  it('prefetches detail and history in parallel for a space row', async () => {
    getSpace.mockResolvedValue({
      success: true,
      data: spaceDetailFromSummary(jobSprint),
    });
    fetchChatHistory.mockResolvedValue({ success: true, data: [] });

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    prefetchSpaceSwitch(client, {
      spaceId: 'sp_abc123',
      masterSessionId: 'sess_sp_abc123',
      locale: 'en',
    });

    await vi.waitFor(() => {
      expect(getSpace).toHaveBeenCalledWith('sp_abc123', expect.any(Object));
      expect(fetchChatHistory).toHaveBeenCalledWith(
        'sess_sp_abc123',
        expect.any(Object)
      );
    });
    expect(spaceHistoryQueryKey('sess_sp_abc123', 'en')).toEqual([
      'space-history',
      'sess_sp_abc123',
      'en',
    ]);
  });

  it('skips clinic ids for prefetch', () => {
    expect(isPrefetchableSpaceNavId(CLINIC_SPACE_ID)).toBe(false);
    expect(isPrefetchableSpaceNavId('clinic')).toBe(false);
    expect(isPrefetchableSpaceNavId('sp_abc123')).toBe(true);
  });

  it('puts masterSessionId on space nav rows', () => {
    const row = spaceSummaryToNavRow(jobSprint, 'en', 'Clinic');
    expect(row.masterSessionId).toBe('sess_sp_abc123');
  });

  it('does not refetch history on remount or window focus', () => {
    expect(SPACE_HISTORY_QUERY_DEFAULTS.refetchOnMount).toBe(false);
    expect(SPACE_HISTORY_QUERY_DEFAULTS.refetchOnWindowFocus).toBe(false);
  });

  it('treats a warm Zustand slice as history-ready on first paint', () => {
    expect(
      isSpaceHistoryReadyFromSlice('sp_abc123', 'sess_sp_abc123', {
        masterSessionId: 'sess_sp_abc123',
        messages: [{ id: 'm1', role: 'assistant', content: 'hi' }],
        isHydrating: false,
      })
    ).toBe(true);
    expect(
      isSpaceHistoryReadyFromSlice('sp_abc123', 'sess_sp_abc123', {
        masterSessionId: 'sess_sp_abc123',
        messages: [],
        isHydrating: false,
      })
    ).toBe(false);
    expect(isSpaceHistoryReadyFromSlice('sp_abc123', null, null)).toBe(true);
    expect(isSpaceHistoryReadyFromSlice(null, 'sess', null)).toBe(false);
  });
});
