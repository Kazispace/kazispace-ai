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
  usePathname: () => '/en/credits',
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/hooks/use-billing', () => ({
  useBilling: () => useBillingMock(),
}));

import CreditsPage from '@/app/[locale]/credits/page';

describe('KAZI-659 /credits page', () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    useBillingMock.mockReset();
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

  it('renders the credit balances once loaded', async () => {
    useBillingMock.mockReturnValue({
      balance: { cvCredits: 3, interviewCredits: 5 },
      isLoading: false,
      error: null,
    });

    await act(async () => {
      root!.render(<CreditsPage params={{ locale: 'en' }} />);
    });

    expect(host?.textContent).toContain('title');
    // Review follow-up (PR #215): a bare `toContain('3')`/`toContain('5')`
    // still passes if cvCredits/interviewCredits render in the swapped card --
    // pin each value to its own `.text-4xl` card in DOM order instead.
    const values = Array.from(host?.querySelectorAll('.text-4xl') ?? []).map(
      (el) => el.textContent
    );
    expect(values).toEqual(['3', '5']);
    expect(host?.textContent).not.toContain('loadError');
  });

  it('shows a loading state before mount/while billing is loading', async () => {
    useBillingMock.mockReturnValue({ balance: null, isLoading: true, error: null });

    await act(async () => {
      root!.render(<CreditsPage params={{ locale: 'en' }} />);
    });

    expect(host?.textContent).toContain('loading');
  });

  it('shows an error state when billing fails to load, without crashing', async () => {
    useBillingMock.mockReturnValue({
      balance: null,
      isLoading: false,
      error: 'network error',
    });

    await act(async () => {
      root!.render(<CreditsPage params={{ locale: 'en' }} />);
    });

    expect(host?.textContent).toContain('loadError');
  });

  it('links "buy credits" to the subscription page', async () => {
    useBillingMock.mockReturnValue({
      balance: { cvCredits: 0, interviewCredits: 0 },
      isLoading: false,
      error: null,
    });

    await act(async () => {
      root!.render(<CreditsPage params={{ locale: 'ru' }} />);
    });

    const link = host?.querySelector('a[href="/ru/subscription"]');
    expect(link).not.toBeNull();
  });
});
