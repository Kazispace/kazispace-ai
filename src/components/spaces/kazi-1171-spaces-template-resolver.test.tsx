/**
 * @vitest-environment jsdom
 *
 * KAZI-1171 — `/spaces?template=ielts_prep` is where the English tutor opens now that `/english`
 * is gone: reuse the user's latest active Space of that template, else create one — once.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SpaceSummary } from '@/types/spaces';

const state = vi.hoisted(() => ({
  query: '' as string,
  spaces: [] as SpaceSummary[],
  hasLoaded: true,
  error: null as string | null,
  authReady: true,
  authenticated: true,
  replace: vi.fn(),
  create: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: state.replace }),
  useSearchParams: () => new URLSearchParams(state.query),
}));
vi.mock('@/hooks/use-spaces', () => ({
  useSpaces: () => ({
    spaces: state.spaces,
    hasLoaded: state.hasLoaded,
    error: state.error,
    enabled: true,
  }),
}));
vi.mock('@/hooks/use-auth-ready', () => ({
  useAuthReady: () => ({ ready: state.authReady, authenticated: state.authenticated }),
}));
vi.mock('@/lib/spaces-api', () => ({ createSpace: state.create }));
vi.mock('@/components/spaces/space-workspace-states', () => ({
  SpaceWorkspaceLoading: () => null,
}));

import { SpacesIndexPage } from '@/components/spaces/spaces-index-page';
import { englishSpaceHref, pickLatestUserSpaceOfTemplate } from '@/lib/spaces/routes';

function space(id: string, template: string, extra: Partial<SpaceSummary> = {}): SpaceSummary {
  return {
    id,
    name: id,
    template_id: template,
    status: 'active',
    master_session_id: `m_${id}`,
    last_active_at: '2026-10-01T00:00:00Z',
    ...extra,
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  state.query = '';
  state.spaces = [];
  state.hasLoaded = true;
  state.error = null;
  state.authReady = true;
  state.authenticated = true;
  state.replace.mockReset();
  state.create.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = async () => {
  await act(async () => {
    root.render(<SpacesIndexPage locale="zh" />);
  });
};

describe('pickLatestUserSpaceOfTemplate', () => {
  it('picks the latest active one of that template only', () => {
    const spaces = [
      space('sp_old', 'ielts_prep', { last_active_at: '2026-09-01T00:00:00Z' }),
      space('sp_new', 'ielts_prep', { last_active_at: '2026-10-20T00:00:00Z' }),
      space('sp_arch', 'ielts_prep', { status: 'archived', last_active_at: '2026-10-25T00:00:00Z' }),
      space('sp_job', 'job_sprint', { last_active_at: '2026-10-26T00:00:00Z' }),
    ];
    expect(pickLatestUserSpaceOfTemplate(spaces, 'ielts_prep')?.id).toBe('sp_new');
    expect(pickLatestUserSpaceOfTemplate(spaces, 'blank_conversation')).toBeNull();
  });

  it('englishSpaceHref is the resolver with the English template', () => {
    vi.stubEnv('NEXT_PUBLIC_SPACES_ENABLED', 'true');
    expect(englishSpaceHref('en')).toBe('/en/spaces?template=ielts_prep');
    vi.unstubAllEnvs();
  });

  it('englishSpaceHref falls back to the main chat with Spaces off, like the Space tab', () => {
    vi.stubEnv('NEXT_PUBLIC_SPACES_ENABLED', 'false');
    expect(englishSpaceHref('en')).toBe('/en/chat');
    vi.unstubAllEnvs();
  });
});

describe('/spaces?template=', () => {
  it('reuses the existing English Space', async () => {
    state.query = 'template=ielts_prep';
    state.spaces = [space('sp_job', 'job_sprint'), space('sp_en', 'ielts_prep')];
    await render();
    expect(state.replace).toHaveBeenCalledWith('/zh/spaces/sp_en');
    expect(state.create).not.toHaveBeenCalled();
  });

  it('creates one when there is none, then opens it', async () => {
    state.query = 'template=ielts_prep';
    state.spaces = [space('sp_job', 'job_sprint')];
    state.create.mockResolvedValue({ success: true, data: space('sp_created', 'ielts_prep') });
    await render();
    expect(state.create).toHaveBeenCalledTimes(1);
    expect(state.create).toHaveBeenCalledWith({ template_id: 'ielts_prep' });
    expect(state.replace).toHaveBeenCalledWith('/zh/spaces/sp_created');
  });

  // UAT 14221: a created Space without an id sent the page to `/spaces/` → `/spaces`, stuck loading.
  it('never navigates to /spaces/ when the created Space has no id; goes to the main chat', async () => {
    state.query = 'template=ielts_prep';
    state.create.mockResolvedValue({ success: true, data: { ...space('', 'ielts_prep') } });
    await render();
    expect(state.replace).not.toHaveBeenCalledWith('/zh/spaces/');
    expect(state.replace).toHaveBeenCalledWith('/zh/chat');
  });

  it('falls back to the main chat when it cannot create one', async () => {
    state.query = 'template=ielts_prep';
    state.create.mockResolvedValue({ success: false, error: 'boom' });
    await render();
    expect(state.replace).toHaveBeenCalledWith('/zh/chat');
  });

  // UAT 14205: before the first load `spaces` is [] — acting on it created a new English
  // Space on every visit and sent the Space tab to /chat.
  it.each(['template=ielts_prep', ''])(
    'does nothing before the first list load settles (%s)',
    async (query) => {
      state.query = query;
      state.hasLoaded = false;
      await render();
      expect(state.create).not.toHaveBeenCalled();
      expect(state.replace).not.toHaveBeenCalled();
    }
  );

  it('does nothing before auth is ready', async () => {
    state.authReady = false;
    state.hasLoaded = false;
    await render();
    expect(state.replace).not.toHaveBeenCalled();
  });

  it('reuses the existing English Space once the list arrives, never creates', async () => {
    state.query = 'template=ielts_prep';
    state.hasLoaded = false;
    await render();
    state.hasLoaded = true;
    state.spaces = [space('sp_en', 'ielts_prep')];
    await render();
    expect(state.create).not.toHaveBeenCalled();
    expect(state.replace).toHaveBeenCalledTimes(1);
    expect(state.replace).toHaveBeenCalledWith('/zh/spaces/sp_en');
  });

  it('Space tab opens the latest Space once the list arrives, not /chat', async () => {
    state.hasLoaded = false;
    await render();
    state.hasLoaded = true;
    state.spaces = [space('sp_job', 'job_sprint')];
    await render();
    expect(state.replace).toHaveBeenCalledTimes(1);
    expect(state.replace).toHaveBeenCalledWith('/zh/spaces/sp_job');
  });

  it('decides once: a later list refresh does not route again', async () => {
    state.query = 'template=ielts_prep';
    state.spaces = [space('sp_en', 'ielts_prep')];
    await render();
    state.spaces = [
      space('sp_en', 'ielts_prep'),
      space('sp_en2', 'ielts_prep', { last_active_at: '2026-10-30T00:00:00Z' }),
    ];
    await render();
    expect(state.replace).toHaveBeenCalledTimes(1);
  });

  it('does not create when the list failed to load; goes to the main chat', async () => {
    state.query = 'template=ielts_prep';
    state.error = 'boom';
    await render();
    expect(state.create).not.toHaveBeenCalled();
    expect(state.replace).toHaveBeenCalledWith('/zh/chat');
  });

  it('signed out goes to the main chat without waiting for a list', async () => {
    state.authenticated = false;
    state.hasLoaded = false;
    await render();
    expect(state.replace).toHaveBeenCalledWith('/zh/chat');
  });

  // UAT 14213: the Space tab landed on a Space archived minutes earlier.
  it('Space tab skips a just-archived Space and opens the latest in-progress one', async () => {
    state.spaces = [
      space('sp_archived', 'ielts_prep', { status: 'archived', last_active_at: '2026-10-26T12:00:00Z' }),
      space('sp_active', 'blank_conversation', { last_active_at: '2026-10-18T09:09:00Z' }),
    ];
    await render();
    expect(state.replace).toHaveBeenCalledWith('/zh/spaces/sp_active');
  });

  it('Space tab goes to the main chat when every Space is archived', async () => {
    state.spaces = [space('sp_archived', 'ielts_prep', { status: 'archived' })];
    await render();
    expect(state.replace).toHaveBeenCalledWith('/zh/chat');
  });

  it('ignores an unknown template and behaves as before', async () => {
    state.query = 'template=nope';
    state.spaces = [space('sp_job', 'job_sprint')];
    await render();
    expect(state.create).not.toHaveBeenCalled();
    expect(state.replace).toHaveBeenCalledWith('/zh/spaces/sp_job');
  });
});
