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
}));

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));
vi.mock('@/hooks/use-auth-ready', () => ({
  useAuthReady: () => ({ ready: state.ready, authenticated: state.authenticated }),
}));
vi.mock('@/hooks/use-workspace-assets', () => ({
  useWorkspaceAssets: ({ category }: { category: WorkspaceAssetCategory }) => {
    const d = state.data[category] ?? { items: [], count: 0, history: 0 };
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

function asset(category: WorkspaceAssetCategory, name: string): WorkspaceAsset {
  return {
    asset_id: `${category}-${name}`,
    category,
    display_name: name,
    is_current: true,
    indexing_status: 'ready',
    mime_type: 'text/markdown',
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
  onNavigate.mockReset();
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

  it('has no job listings or spaces tiles (D21)', () => {
    state.data = { resume: { items: [asset('resume', 'CV')], count: 1, history: 0 } };
    render();
    expect(container.textContent).not.toContain('tileJobs');
    expect(container.textContent).not.toContain('tileSpaces');
  });
});
