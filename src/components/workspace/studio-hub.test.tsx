/**
 * @vitest-environment jsdom
 *
 * Studio (kazispace-ui D20, D21): one list per kind of object, a kind with no
 * items is left out, an empty Studio points back to Chat, and job listings and
 * spaces are not in Studio.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkspaceAsset, WorkspaceAssetCategory } from '@/types/workspace-asset';

type Counts = Record<WorkspaceAssetCategory, number>;
const zero: Counts = { resume: 0, english: 0, interview: 0 };

const state = vi.hoisted(() => ({
  ready: true,
  authenticated: true,
  data: {} as Record<string, { items: WorkspaceAsset[]; count: number; history: number }>,
  loading: false,
  start: { guides: [] as { id: string; label: string; text: string }[], isLoading: false, error: false },
}));

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));
vi.mock('@/hooks/use-auth-ready', () => ({
  useAuthReady: () => ({ ready: state.ready, authenticated: state.authenticated }),
}));
const api = vi.hoisted(() => ({
  archive: vi.fn(async () => ({ success: true, data: { id: 'ca', status: 'archived' } })),
  restore: vi.fn(async () => ({ success: true, data: { id: 'ca', status: 'active' } })),
  views: vi.fn(async () => ({ success: true, data: { view_count: 1 } })),
  toast: vi.fn(),
  insert: vi.fn(),
  deactivate: vi.fn(async () => ({ ok: true, agentId: 'english_tutor' })),
}));
vi.mock('@/lib/deactivate-to-clinic', () => ({ deactivateToClinic: api.deactivate }));
vi.mock('@/lib/asset-objects-api', () => ({
  archiveAssetObject: api.archive,
  restoreAssetObject: api.restore,
  recordAssetObjectView: api.views,
}));
vi.mock('@/lib/store', () => ({
  useUIStore: (select: (s: { showToast: typeof api.toast; requestComposerInsert: typeof api.insert }) => unknown) =>
    select({ showToast: api.toast, requestComposerInsert: api.insert }),
}));
vi.mock('@/hooks/use-studio-get-started', () => ({
  useStudioGetStarted: () => state.start,
}));
vi.mock('@/hooks/use-workspace-assets', () => ({
  useWorkspaceAssets: ({
    category,
    includeArchived,
  }: {
    category: WorkspaceAssetCategory;
    includeArchived?: boolean;
  }) => {
    const key = includeArchived ? `${category}:withArchived` : category;
    const d = state.data[key] ?? { items: [], count: 0, history: 0 };
    return {
      items: d.items,
      categories: { ...zero, [category]: d.count },
      historyCounts: { ...zero, [category]: d.history },
      isLoading: state.loading,
      error: null,
      refresh: () => {},
    };
  },
  useWorkspaceAssetCategoryHistory: () => ({ items: [], isLoading: false }),
  retryWorkspaceAssetIndexing: async () => {},
}));

import { WorkspaceAssetRailHub } from '@/components/workspace/workspace-asset-rail-hub';

function asset(
  category: WorkspaceAssetCategory,
  name: string,
  extra: Partial<WorkspaceAsset> = {}
): WorkspaceAsset {
  return {
    asset_id: `${category}-${name}`,
    category,
    display_name: name,
    is_current: true,
    indexing_status: 'ready',
    mime_type: 'text/markdown',
    ...extra,
  } as WorkspaceAsset;
}

let container: HTMLDivElement;
let root: Root;
const onNavigate = vi.fn();

function render() {
  act(() => {
    root.render(
      <WorkspaceAssetRailHub locale="en" showCloseButton={false} onNavigate={onNavigate} />
    );
  });
}
const headings = () =>
  Array.from(container.querySelectorAll('section > h2')).map((h) => h.textContent);

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  state.ready = true;
  state.authenticated = true;
  state.loading = false;
  state.data = {};
  state.start = { guides: [], isLoading: false, error: false };
  onNavigate.mockReset();
  api.insert.mockClear();
  api.deactivate.mockClear();
  api.archive.mockClear();
  api.restore.mockClear();
  api.views.mockClear();
  api.toast.mockClear();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('Studio', () => {
  it('lists resumes, then assessments (English and mock interview)', () => {
    state.data = {
      resume: { items: [asset('resume', 'Data analyst — English')], count: 1, history: 0 },
      english: { items: [asset('english', 'English passport')], count: 1, history: 0 },
      interview: { items: [asset('interview', 'Mock interview')], count: 1, history: 0 },
    };
    render();
    expect(headings()).toEqual(['studio.resumes', 'studio.assessments']);
    expect(container.textContent).toContain('English passport');
    expect(container.textContent).toContain('Mock interview');
  });

  it('leaves out a kind the user has none of', () => {
    state.data = {
      interview: { items: [asset('interview', 'Mock interview')], count: 1, history: 0 },
    };
    render();
    expect(headings()).toEqual(['studio.assessments']);
    expect(container.textContent).not.toContain('cv.railHub.tileEnglish');
  });

  it('keeps a kind that only has older versions', () => {
    state.data = { resume: { items: [], count: 0, history: 2 } };
    render();
    expect(headings()).toEqual(['studio.resumes']);
  });

  it('shows the empty state with one action that opens Chat', () => {
    render();
    const empty = container.querySelector('[data-testid="studio-empty"]');
    expect(empty?.textContent).toContain('studio.empty.title');
    expect(headings()).toEqual(['studio.empty.title']);
    const button = empty?.querySelector('button');
    act(() => button?.click());
    expect(onNavigate).toHaveBeenCalledWith('/en/chat');
  });

  it('does not show the empty state while loading or signed out', () => {
    state.loading = true;
    render();
    expect(container.querySelector('[data-testid="studio-empty"]')).toBeNull();
    expect(headings()).toEqual(['studio.resumes', 'studio.assessments']);

    state.loading = false;
    state.authenticated = false;
    render();
    expect(container.querySelector('[data-testid="studio-empty"]')).toBeNull();
    expect(container.textContent).toContain('cv.railHub.assetV2.loginRequired');
  });

  describe('Get started (D25)', () => {
    const guides = [
      { id: 'cet4', label: '练习四级英语', text: '我想练习四级英语考试' },
      { id: 'search', label: '快速搜索', text: '帮我快速搜索：今年哪些技术岗位需求最大' },
    ];
    const row = () => container.querySelector('[data-testid="studio-get-started"]');

    it('shows the server\'s buttons, in order, above the lists', () => {
      state.start = { guides, isLoading: false, error: false };
      state.data = { resume: { items: [asset('resume', 'CV')], count: 1, history: 0 } };
      render();
      expect(headings()).toEqual(['studio.start.title', 'studio.resumes']);
      expect(Array.from(row()!.querySelectorAll('button')).map((b) => b.firstChild?.textContent)).toEqual([
        '练习四级英语',
        '快速搜索',
      ]);
      // The text a tap puts in the composer is there for screen readers too.
      expect(row()!.querySelector('button .sr-only')?.textContent).toBe(': 我想练习四级英语考试');
    });

    it('a tap leaves a current specialist, fills the main chat\'s composer and opens Chat; nothing is sent', async () => {
      state.start = { guides, isLoading: false, error: false };
      render();
      const button = row()!.querySelectorAll('button')[1] as HTMLButtonElement;
      await act(async () => {
        button.click();
      });
      expect(api.deactivate).toHaveBeenCalledWith('en', { bestEffort: true });
      expect(api.deactivate.mock.invocationCallOrder[0]).toBeLessThan(api.insert.mock.invocationCallOrder[0]);
      expect(api.insert).toHaveBeenCalledWith(
        '帮我快速搜索：今年哪些技术岗位需求最大',
        'clinic',
        'replace',
        'studio.start.draftReplaced'
      );
      expect(onNavigate).toHaveBeenCalledWith('/en/chat');
      // A second tap does nothing more.
      await act(async () => {
        button.click();
      });
      expect(api.insert).toHaveBeenCalledTimes(1);
      expect(api.deactivate).toHaveBeenCalledTimes(1);
    });

    it('in an empty Studio the row replaces "Start in Chat"', () => {
      state.start = { guides, isLoading: false, error: false };
      render();
      const empty = container.querySelector('[data-testid="studio-empty"]');
      expect(empty?.textContent).toContain('studio.empty.title');
      expect(empty?.querySelector('button')).toBeNull();
    });

    it('is hidden when it fails or is empty, and "Start in Chat" comes back', () => {
      for (const start of [
        { guides, isLoading: false, error: true },
        { guides: [], isLoading: false, error: false },
      ]) {
        state.start = start;
        render();
        expect(row()).toBeNull();
        expect(container.querySelector('[data-testid="studio-empty"] button')?.textContent).toBe('studio.empty.action');
      }
    });

    it('shows a skeleton while loading', () => {
      state.start = { guides: [], isLoading: true, error: false };
      render();
      expect(container.querySelector('[data-testid="studio-get-started-loading"]')).not.toBeNull();
    });

    it('is not shown signed out', () => {
      state.start = { guides, isLoading: false, error: false };
      state.authenticated = false;
      render();
      expect(row()).toBeNull();
    });
  });

  it('has no job listings or spaces tiles (D21)', () => {
    state.data = { resume: { items: [asset('resume', 'CV')], count: 1, history: 0 } };
    render();
    expect(container.textContent).not.toContain('tileJobs');
    expect(container.textContent).not.toContain('tileSpaces');
  });

  describe('archive, restore and view counts (Core Assets §6.4)', () => {
    const resume = asset('resume', 'Data analyst', {
      view_count: 14,
      object_status: 'active',
      provenance: { core_asset_id: 'ca_1' },
    });

    it('shows each resume\'s view count', () => {
      state.data = { resume: { items: [resume], count: 1, history: 0 } };
      render();
      expect(container.querySelector('[data-testid="studio-view-count"]')?.textContent).toBe('studio.views');
    });

    it('records one view when a resume is opened, and only then', async () => {
      const onOpenAsset = vi.fn();
      state.data = { resume: { items: [resume], count: 1, history: 0 } };
      act(() => {
        root.render(<WorkspaceAssetRailHub locale="en" showCloseButton={false} onOpenAsset={onOpenAsset} />);
      });
      expect(api.views).not.toHaveBeenCalled();
      const open = container.querySelector('button[title="Data analyst"]') as HTMLButtonElement;
      await act(async () => {
        open.click();
      });
      expect(onOpenAsset).toHaveBeenCalledWith(resume);
      expect(api.views).toHaveBeenCalledWith('ca_1');
    });

    it('archives a resume from its tile', async () => {
      state.data = { resume: { items: [resume], count: 1, history: 0 } };
      render();
      const archive = container.querySelector('[data-testid="studio-archive"]') as HTMLButtonElement;
      await act(async () => {
        archive.click();
      });
      expect(api.archive).toHaveBeenCalledWith('ca_1');
      expect(api.views).not.toHaveBeenCalled();
    });

    it('lists archived resumes under Archived and restores one on tap', async () => {
      const old = asset('resume', 'First draft', {
        object_status: 'archived',
        provenance: { core_asset_id: 'ca_0' },
      });
      state.data = {
        resume: { items: [resume], count: 1, history: 0 },
        'resume:withArchived': { items: [resume, old], count: 2, history: 0 },
      };
      render();
      expect(headings()).toEqual(['studio.resumes', 'studio.archived']);
      const archived = container.querySelectorAll('[data-testid="studio-archived-object"]');
      expect(archived).toHaveLength(1);
      expect(archived[0].textContent).toContain('First draft');
      await act(async () => {
        (archived[0] as HTMLButtonElement).click();
      });
      expect(api.restore).toHaveBeenCalledWith('ca_0');
    });

    it('says so when the change fails', async () => {
      api.archive.mockResolvedValueOnce({ success: false, error: 'boom' } as never);
      state.data = { resume: { items: [resume], count: 1, history: 0 } };
      render();
      await act(async () => {
        (container.querySelector('[data-testid="studio-archive"]') as HTMLButtonElement).click();
      });
      expect(api.toast).toHaveBeenCalledWith('studio.actionFailed', 'error');
    });

    it('offers no archive button on an item without an object id', () => {
      state.data = { resume: { items: [asset('resume', 'Legacy')], count: 1, history: 0 } };
      render();
      expect(container.querySelector('[data-testid="studio-archive"]')).toBeNull();
    });
  });
});
