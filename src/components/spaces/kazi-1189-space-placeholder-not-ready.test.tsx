/**
 * @vitest-environment jsdom
 *
 * KAZI-1189 — opening a Space whose detail cache holds only the sidebar-list placeholder must
 * show loading, ⛔ 「空间尚未就绪」. The BE list row has no `master_session_id`; the fixture is
 * typed with the generated `SpaceSummary`, so if that contract changes, `tsc` fails here first.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { components } from '@/types/api.generated';
import type { SpaceDetail } from '@/types/spaces';

const api = vi.hoisted(() => ({
  resolve: null as null | ((v: unknown) => void),
  getSpace: vi.fn(),
}));

vi.mock('@/lib/spaces-api', async (orig) => ({
  ...(await orig<typeof import('@/lib/spaces-api')>()),
  getSpace: api.getSpace,
}));
vi.mock('@/lib/spaces/constants', async (orig) => ({
  ...(await orig<typeof import('@/lib/spaces/constants')>()),
  isSpacesEnabled: () => true,
}));
vi.mock('@/lib/store', () => ({
  useAuthStore: (sel: (s: { isLoggedIn: boolean }) => unknown) => sel({ isLoggedIn: true }),
}));
vi.mock('@/components/spaces/space-workspace-states', () => ({
  SpaceWorkspaceLoading: () => <div data-testid="loading" />,
  SpaceWorkspaceError: () => <div data-testid="error" />,
}));
const templateProps = vi.hoisted(() => ({
  seen: [] as Array<{ master_session_id: string }>,
  Template: ({ space }: { space: SpaceDetail }) => {
    templateProps.seen.push({ master_session_id: space.master_session_id });
    return <div data-testid="workspace" data-session={space.master_session_id} />;
  },
}));
vi.mock('@/components/spaces/blank-conversation-workspace', () => ({
  BlankConversationWorkspace: templateProps.Template,
}));
vi.mock('@/components/spaces/ielts-prep-workspace', () => ({
  IeltsPrepWorkspace: templateProps.Template,
}));
vi.mock('@/components/spaces/job-sprint-workspace', () => ({
  JobSprintWorkspace: templateProps.Template,
}));

import { SpaceWorkspace } from '@/components/spaces/space-workspace';
import { normalizeSpaceSummary } from '@/lib/spaces-api';
import { seedSpaceDetailPlaceholders } from '@/lib/spaces/space-detail-from-summary';

// The real BE `GET /api/v1/spaces` row: no master_session_id.
const listRow: components['schemas']['SpaceSummary'] = {
  id: 'sp_ab83a73e44ca',
  name: '空白对话',
  template_id: 'blank_conversation',
  status: 'active',
  is_entry_point: false,
  is_system: false,
  last_active_at: '2026-10-27T00:53:00Z',
};

const fetched = (master: string): SpaceDetail => ({
  ...normalizeSpaceSummary(listRow as unknown as Record<string, unknown>),
  master_session_id: master,
  config_snapshot: {},
  space_state: {},
  created_at: '2026-10-27T00:53:00Z',
  updated_at: '2026-10-27T00:53:00Z',
});

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  root = createRoot(container);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  templateProps.seen = [];
  api.getSpace.mockReset();
  api.getSpace.mockImplementation(() => new Promise((r) => (api.resolve = r)));
});
afterEach(() => act(() => root.unmount()));

const mount = () =>
  act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <SpaceWorkspace spaceId={listRow.id} />
      </QueryClientProvider>
    );
  });

const testid = () =>
  container.querySelector('[data-testid]')?.getAttribute('data-testid') ?? null;

describe('KAZI-1189 — list placeholder is not a usable Space', () => {
  it('the list row really has no master_session_id', () => {
    const summary = normalizeSpaceSummary(listRow as unknown as Record<string, unknown>);
    expect(summary.master_session_id).toBe('');
  });

  it('shows loading while only the placeholder is cached, then the workspace once the GET lands', async () => {
    seedSpaceDetailPlaceholders(client, [
      normalizeSpaceSummary(listRow as unknown as Record<string, unknown>),
    ]);
    await mount();
    expect(testid()).toBe('loading');
    expect(templateProps.seen).toEqual([]);

    await act(async () => {
      api.resolve?.({ success: true, data: fetched('sess_sp_ab83a73e44ca') });
    });
    await vi.waitFor(() => expect(testid()).toBe('workspace'));
    expect(templateProps.seen.every((p) => p.master_session_id === 'sess_sp_ab83a73e44ca')).toBe(
      true
    );
  });

  it('a fetched Space without a master session still reaches the chat pane (its 「空间尚未就绪」 stays)', async () => {
    await mount();
    await act(async () => {
      api.resolve?.({ success: true, data: fetched('') });
    });
    await vi.waitFor(() => expect(testid()).toBe('workspace'));
    expect(templateProps.seen.at(-1)?.master_session_id).toBe('');
  });

  it('a failed GET under a placeholder shows the error, not an endless loader', async () => {
    // useSpaceDetail retries once (~1 s) before it gives up.
    api.getSpace.mockResolvedValue({ success: false, error: 'boom' });
    seedSpaceDetailPlaceholders(client, [
      normalizeSpaceSummary(listRow as unknown as Record<string, unknown>),
    ]);
    await mount();
    expect(testid()).toBe('loading');
    await vi.waitFor(() => expect(testid()).toBe('error'), { timeout: 4000 });
  });
});
