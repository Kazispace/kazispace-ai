/**
 * KAZI-588: keep-alive must survive Clinic/hub, Space switch pins latest,
 * and recent Spaces are prefetched so history cache is warm.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { windowedHistoryQuery } from '@/lib/chat/history-window';
import { CLINIC_SPACE_ID } from '@/lib/spaces/constants';
import { pinChatScrollToLatest } from '@/lib/spaces/chat-scroll';
import {
  CHAT_HISTORY_WINDOW_LIMIT,
  SPACE_WORKSPACE_KEEPALIVE_LIMIT,
} from '@/lib/spaces/perf-policy';
import {
  prefetchRecentSpaceSwitches,
  prefetchSpaceSwitch,
  selectRecentPrefetchSpaces,
} from '@/lib/spaces/prefetch-space-switch';
import type { SpaceSummary } from '@/types/spaces';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');

const fetchChatHistory = vi.fn();
const getSpace = vi.fn();

vi.mock('@/lib/api-client', () => ({
  fetchChatHistory: (...args: unknown[]) => fetchChatHistory(...args),
}));

vi.mock('@/lib/spaces-api', () => ({
  getSpace: (...args: unknown[]) => getSpace(...args),
}));

function readSrc(relativePath: string): string {
  return readFileSync(join(repoRoot, 'src', relativePath), 'utf8');
}

function space(id: string, lastActiveAt: string): SpaceSummary {
  return {
    id,
    name: id,
    template_id: 'blank_conversation',
    status: 'active',
    master_session_id: `sess_${id}`,
    last_active_at: lastActiveAt,
  };
}

describe('KAZI-588 Space switch cache and latest pin', () => {
  afterEach(() => {
    fetchChatHistory.mockReset();
    getSpace.mockReset();
  });
  it('workspace layout hosts keep-alive so Clinic cannot unmount Space instances', () => {
    const workspaceLayout = readSrc('app/[locale]/(workspace)/layout.tsx');
    const spacesLayout = readSrc('app/[locale]/(workspace)/spaces/layout.tsx');
    expect(workspaceLayout).toMatch(/SpaceWorkspaceKeepAlive/);
    expect(spacesLayout).not.toMatch(/SpaceWorkspaceKeepAlive/);
  });

  it('keep-alive keeps cached ids when leaving a Space route', () => {
    const host = readSrc('components/spaces/space-workspace-keep-alive.tsx');
    expect(host).not.toMatch(/if \(!spaceId\) \{\s*return children/);
    expect(host).not.toMatch(/if \(!spaceId\) return children/);
    expect(host).toMatch(/spaceId && 'hidden'/);
    expect(host).toMatch(/!active && 'hidden'/);
  });

  it('space chat pins latest instead of restoring the last browse pixel', () => {
    const pane = readSrc('components/spaces/space-chat-pane.tsx');
    expect(pane).toMatch(/alignToLatest:\s*true/);
    expect(pane).toMatch(/activationKey:\s*active \? 'active' : 'idle'/);
    expect(pane).toMatch(/activationKey=\{active \? 'active' : 'idle'\}/);

    const scroll = readSrc('hooks/use-chat-scroll.ts');
    expect(scroll).toMatch(/alignToLatest \? null : readChatScrollTop/);
    expect(scroll).toMatch(/activationKey === 'idle'/);
    expect(scroll).toMatch(/activationKey,/);

    const virtuoso = readSrc('components/spaces/space-message-virtuoso.tsx');
    expect(virtuoso).toMatch(/pinChatScrollToLatest/);
    expect(virtuoso).toMatch(/alignToLatest/);
    expect(virtuoso).toMatch(/didFreezeInitialRef/);
    expect(virtuoso).toMatch(/activationKey === 'idle'/);
    expect(virtuoso).not.toMatch(/followOutput/);
  });

  it('pinChatScrollToLatest ignores leftover pixels and lands on overflow bottom', () => {
    const scroller = { scrollHeight: 4000, clientHeight: 400, scrollTop: 80 };
    expect(pinChatScrollToLatest(scroller)).toBe(true);
    expect(scroller.scrollTop).toBe(3600);

    const short = { scrollHeight: 100, clientHeight: 400, scrollTop: 12 };
    expect(pinChatScrollToLatest(short)).toBe(false);
    expect(short.scrollTop).toBe(12);
  });

  it('selectRecentPrefetchSpaces warms the keep-alive window, newest first', () => {
    const spaces = [
      space('old', '2026-01-01T00:00:00.000Z'),
      space('mid', '2026-06-01T00:00:00.000Z'),
      space('new', '2026-08-01T00:00:00.000Z'),
      space('newest', '2026-08-20T00:00:00.000Z'),
      {
        ...space('clinic-row', '2026-08-21T00:00:00.000Z'),
        id: CLINIC_SPACE_ID,
        is_entry_point: true,
      },
    ];
    const recent = selectRecentPrefetchSpaces(spaces);
    expect(recent).toHaveLength(SPACE_WORKSPACE_KEEPALIVE_LIMIT);
    expect(recent.map((row) => row.id)).toEqual(['newest', 'new', 'mid']);
  });

  it('prefetchRecentSpaceSwitches prefetches detail + windowed history', async () => {
    getSpace.mockResolvedValue({ success: true, data: { id: 'newest' } });
    fetchChatHistory.mockResolvedValue({ success: true, data: [] });

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    prefetchRecentSpaceSwitches(
      client,
      [
        space('old', '2026-01-01T00:00:00.000Z'),
        space('mid', '2026-06-01T00:00:00.000Z'),
        space('new', '2026-08-01T00:00:00.000Z'),
        space('newest', '2026-08-20T00:00:00.000Z'),
      ],
      'zh'
    );

    await vi.waitFor(() => {
      expect(getSpace).toHaveBeenCalled();
      expect(fetchChatHistory).toHaveBeenCalled();
    });

    const historySessions = fetchChatHistory.mock.calls.map((call) => call[0]);
    expect(historySessions).toHaveLength(SPACE_WORKSPACE_KEEPALIVE_LIMIT);
    expect(historySessions).toEqual(
      expect.arrayContaining(['sess_newest', 'sess_new', 'sess_mid'])
    );
    expect(historySessions).not.toContain('sess_old');
    expect(fetchChatHistory.mock.calls[0]?.[1]).toMatchObject(windowedHistoryQuery());
    expect(windowedHistoryQuery().limit).toBe(CHAT_HISTORY_WINDOW_LIMIT);
  });

  it('spaces list seed warms recent Space switches with the route locale', () => {
    const hook = readSrc('hooks/use-spaces.ts');
    expect(hook).toMatch(/prefetchRecentSpaceSwitches/);
    expect(hook).toMatch(/locale\?: string/);
    const shell = readSrc('components/session-nav/session-nav-shell.tsx');
    expect(shell).toMatch(/useSpaces\(\{ panelOpen: panelVisible, locale \}\)/);
  });

  it('prefetchSpaceSwitch still warms detail plus the history window', async () => {
    getSpace.mockResolvedValue({ success: true, data: { id: 'sp_abc123' } });
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
        expect.objectContaining({
          limit: CHAT_HISTORY_WINDOW_LIMIT,
          fields: 'full',
        })
      );
    });
  });
});
