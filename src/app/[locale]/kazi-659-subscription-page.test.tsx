/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUIStore } from '@/lib/store';

const useBillingMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/subscription',
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/hooks/use-billing', () => ({
  useBilling: () => useBillingMock(),
}));

import SubscriptionPage from '@/app/[locale]/subscription/page';

describe('KAZI-659 /subscription page', () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    useBillingMock.mockReset();
    useBillingMock.mockReturnValue({ plan: null, isLoading: false });
    useUIStore.setState({ isTelegramMiniApp: false });
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

  it('renders the PRO tab by default with its features and price', async () => {
    await act(async () => {
      root!.render(<SubscriptionPage params={{ locale: 'en' }} />);
    });

    expect(host?.textContent).toContain('proMonthlyName');
    expect(host?.textContent).toContain('proFeature1');
    expect(host?.textContent).not.toContain('sprint7dName');
  });

  it('switches to the Sprint tab on click and shows sprint plans instead', async () => {
    await act(async () => {
      root!.render(<SubscriptionPage params={{ locale: 'en' }} />);
    });

    const buttons = Array.from(host?.querySelectorAll('button') ?? []);
    const sprintTabButton = buttons.find((b) => b.textContent === 'sprintTab');
    expect(sprintTabButton).toBeDefined();

    await act(async () => {
      sprintTabButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(host?.textContent).toContain('sprint7dName');
    expect(host?.textContent).toContain('sprint14dName');
    expect(host?.textContent).toContain('sprint28dName');
    expect(host?.textContent).not.toContain('proFeature1');
  });

  // Review follow-up (PR #215): the original version of this test counted
  // `.rounded-full` elements (a base class every `Badge` carries, including
  // the always-rendered "savePercentage" badge inside the PRO card) instead
  // of asserting the badge's own copy, and its `loaded` fixture used a
  // `tier` field the page never reads -- `planBadgeKey()` reads `plan_type`
  // (see api-mappers.ts), so that fixture was silently exercising the same
  // `freeTrialBadge` fallback as `plan: null`, not a real "loaded" plan.
  it('renders no plan badge copy while billing is loading, then the free-tier badge once loaded', async () => {
    useBillingMock.mockReturnValue({ plan: null, isLoading: true });
    await act(async () => {
      root!.render(<SubscriptionPage params={{ locale: 'en' }} />);
    });
    expect(host?.textContent).not.toContain('freeTrialBadge');
    expect(host?.textContent).not.toContain('proBadge');
    expect(host?.textContent).not.toContain('sprintBadge');

    act(() => {
      root!.unmount();
    });
    root = createRoot(host!);
    useBillingMock.mockReturnValue({ plan: { plan_type: 'free' }, isLoading: false });
    await act(async () => {
      root!.render(<SubscriptionPage params={{ locale: 'en' }} />);
    });

    expect(host?.textContent).toContain('freeTrialBadge');
  });

  it('renders the pro-tier badge for a pro plan_type', async () => {
    useBillingMock.mockReturnValue({ plan: { plan_type: 'pro_monthly' }, isLoading: false });
    await act(async () => {
      root!.render(<SubscriptionPage params={{ locale: 'en' }} />);
    });

    expect(host?.textContent).toContain('proBadge');
    expect(host?.textContent).not.toContain('freeTrialBadge');
  });
});
