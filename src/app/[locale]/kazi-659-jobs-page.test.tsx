/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUIStore } from '@/lib/store';
import type { JobRecommendationItem } from '@/types/jobs';

const useJobRecommendationsMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());
const openPaywallMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  usePathname: () => '/en/jobs',
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}));

vi.mock('@/hooks/use-jobs', () => ({
  useJobRecommendations: () => useJobRecommendationsMock(),
}));

import JobsPage from '@/app/[locale]/jobs/page';

function sampleJob(overrides: Partial<JobRecommendationItem> = {}): JobRecommendationItem {
  return {
    job_id: 'job-1',
    title: 'Backend Engineer',
    company: 'Acme',
    match_score: 88,
    match_level: 'excellent',
    primary_cta: 'edit_cv',
    is_saved: false,
    is_locked: false,
    ...overrides,
  } as JobRecommendationItem;
}

describe('KAZI-659 /jobs page', () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    useJobRecommendationsMock.mockReset();
    pushMock.mockReset();
    openPaywallMock.mockReset();
    useUIStore.setState({ isTelegramMiniApp: false, openPaywall: openPaywallMock });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    host?.remove();
    root = null;
    host = null;
  });

  it('shows the login banner and routes to /login when needsLogin is true', async () => {
    useJobRecommendationsMock.mockReturnValue({
      items: [],
      isProUser: false,
      upgradeHint: undefined,
      engineTotal: undefined,
      isLoading: false,
      error: null,
      needsLogin: true,
    });

    await act(async () => {
      root!.render(<JobsPage params={{ locale: 'en' }} />);
    });

    expect(host?.textContent).toContain('loginBanner');
    const signInButton = Array.from(host?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent === 'signIn'
    );
    expect(signInButton).toBeDefined();

    await act(async () => {
      signInButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(pushMock).toHaveBeenCalledWith('/en/login');
  });

  it('renders the job list on a normal load', async () => {
    useJobRecommendationsMock.mockReturnValue({
      items: [sampleJob(), sampleJob({ job_id: 'job-2', title: 'Data Analyst' })],
      isProUser: true,
      upgradeHint: undefined,
      engineTotal: 2,
      isLoading: false,
      error: null,
      needsLogin: false,
    });

    await act(async () => {
      root!.render(<JobsPage params={{ locale: 'en' }} />);
    });

    expect(host?.textContent).toContain('Backend Engineer');
    expect(host?.textContent).toContain('Data Analyst');
    expect(host?.textContent).toContain('Acme');
  });

  it('shows an error state when the recommendation fetch fails', async () => {
    useJobRecommendationsMock.mockReturnValue({
      items: [],
      isProUser: false,
      upgradeHint: undefined,
      engineTotal: undefined,
      isLoading: false,
      error: 'network error',
      needsLogin: false,
    });

    await act(async () => {
      root!.render(<JobsPage params={{ locale: 'en' }} />);
    });

    expect(host?.textContent).toContain('loadError');
  });

  it('opens the paywall (not a navigation) when a locked job’s unlock_pro CTA is clicked', async () => {
    useJobRecommendationsMock.mockReturnValue({
      items: [
        sampleJob({
          is_locked: true,
          primary_cta: 'unlock_pro',
        }),
      ],
      isProUser: false,
      upgradeHint: 'upgradeHint',
      engineTotal: 1,
      isLoading: false,
      error: null,
      needsLogin: false,
    });

    await act(async () => {
      root!.render(<JobsPage params={{ locale: 'en' }} />);
    });

    const unlockButton = Array.from(host?.querySelectorAll('button') ?? []).find((b) =>
      b.textContent?.includes('cta.unlock_pro')
    );
    expect(unlockButton).toBeDefined();

    await act(async () => {
      unlockButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(openPaywallMock).toHaveBeenCalledWith('PRO_FEATURE_LOCKED');
    expect(pushMock).not.toHaveBeenCalled();
  });
});
