/**
 * @vitest-environment jsdom
 *
 * KAZI-1436 (§5.1.1 ⑤): the pop-up appears while `needs_age`, never otherwise; 「Later」 closes it for
 * this user on this browser; a save sends the year-month with the browser zone and closes it because
 * `/me` then says `needs_age: false`; an incomplete choice is not sent.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/lib/store';
import type { User } from '@/types';

const patchMe = vi.fn();

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/lib/api-client', () => ({
  patchMe: (...args: unknown[]) => patchMe(...args),
}));
vi.mock('@/lib/auth', () => ({
  setUserInfo: vi.fn(),
}));

import { AgePrompt } from '@/components/age/age-prompt';

function user(over: Partial<User> = {}): User {
  return { id: '42', displayName: 'U', createdAt: '', updatedAt: '', needsAge: true, ...over };
}

function setSelect(testId: string, value: string) {
  const el = document.querySelector(`[data-testid="${testId}"]`) as HTMLSelectElement;
  act(() => {
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('KAZI-1436 AgePrompt', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    patchMe.mockReset();
    window.localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function mount(u: User | null, isLoggedIn = true) {
    await act(async () => {
      useAuthStore.setState({ user: u, isLoggedIn, token: 't' });
      root.render(<AgePrompt />);
    });
  }

  const dialog = () => document.querySelector('[data-testid="age-prompt"]');

  it('shows while needs_age and says why', async () => {
    await mount(user());
    expect(dialog()).not.toBeNull();
    expect(dialog()!.textContent).toContain('birthWhy');
  });

  it.each([
    ['needs_age false', user({ needsAge: false }), true],
    ['needs_age missing', user({ needsAge: undefined }), true],
    ['logged out', user(), false],
  ])('stays closed: %s', async (_label, u, loggedIn) => {
    await mount(u, loggedIn);
    expect(dialog()).toBeNull();
  });

  it('「Later」 closes it and it stays closed for this user', async () => {
    await mount(user());
    const later = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'birthLater')!;
    await act(async () => later.click());
    expect(dialog()).toBeNull();
    act(() => root.unmount());
    root = createRoot(container);
    await mount(user());
    expect(dialog()).toBeNull();
    await mount(user({ id: '43' })); // another account on the same browser is still asked
    expect(dialog()).not.toBeNull();
  });

  it('Escape closes it for this page load only (#310 review 🟡2)', async () => {
    await mount(user());
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(dialog()).toBeNull();
    act(() => root.unmount());
    root = createRoot(container);
    await mount(user());
    expect(dialog()).not.toBeNull(); // not remembered: the ask comes back on the next load
  });

  describe('zone backfill (§5.1.1 ⑧, #310 review 🟡1)', () => {
    afterEach(() => vi.restoreAllMocks());
    const zone = (tz: string) =>
      vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
        timeZone: tz,
      } as Intl.ResolvedDateTimeFormatOptions);

    it('an aged account with no zone sends the browser zone once', async () => {
      zone('Asia/Almaty');
      patchMe.mockResolvedValue({ success: true, data: user({ needsAge: false, timeZone: 'Asia/Almaty' }) });
      await mount(user({ needsAge: false, birthYearMonth: '2008-05', timeZone: null }));
      expect(patchMe).toHaveBeenCalledTimes(1);
      expect(patchMe).toHaveBeenCalledWith({ time_zone: 'Asia/Almaty' });
      expect(useAuthStore.getState().user?.timeZone).toBe('Asia/Almaty');
      expect(dialog()).toBeNull();
    });

    it.each([
      ['a zone is already stored', { needsAge: false, birthYearMonth: '2008-05', timeZone: 'Asia/Shanghai' }],
      ['no age yet (the save carries the zone)', { needsAge: true, birthYearMonth: null, timeZone: null }],
      ['a backend without the fields', { needsAge: false, birthYearMonth: null, timeZone: null }],
    ])('sends nothing when %s', async (_label, over) => {
      zone('Asia/Almaty');
      await mount(user(over as Partial<User>));
      expect(patchMe).not.toHaveBeenCalled();
    });

    it('sends nothing when the browser has no IANA zone', async () => {
      zone('UTC');
      await mount(user({ needsAge: false, birthYearMonth: '2008-05', timeZone: null }));
      expect(patchMe).not.toHaveBeenCalled();
    });
  });

  it('an incomplete choice is not sent', async () => {
    await mount(user());
    setSelect('age-prompt-year', '2008');
    await act(async () => (document.querySelector('[data-testid="age-prompt-save"]') as HTMLButtonElement).click());
    expect(patchMe).not.toHaveBeenCalled();
    expect(dialog()!.querySelector('[role="alert"]')!.textContent).toBe('birthInvalid');
  });

  it('a save sends the year-month with the zone and closes it', async () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      timeZone: 'Asia/Almaty',
    } as Intl.ResolvedDateTimeFormatOptions);
    patchMe.mockResolvedValue({
      success: true,
      data: user({ needsAge: false, birthYearMonth: '2008-05', ageBand: '14_17' }),
    });
    await mount(user());
    setSelect('age-prompt-year', '2008');
    setSelect('age-prompt-month', '5');
    await act(async () => (document.querySelector('[data-testid="age-prompt-save"]') as HTMLButtonElement).click());
    expect(patchMe).toHaveBeenCalledWith({ birth_year_month: '2008-05', time_zone: 'Asia/Almaty' });
    expect(useAuthStore.getState().user?.needsAge).toBe(false);
    expect(dialog()).toBeNull();
    vi.restoreAllMocks();
  });

  it('a refused save stays open with the error', async () => {
    patchMe.mockResolvedValue({ success: false, error: 'invalid birth_year_month' });
    await mount(user());
    setSelect('age-prompt-year', '2008');
    setSelect('age-prompt-month', '5');
    await act(async () => (document.querySelector('[data-testid="age-prompt-save"]') as HTMLButtonElement).click());
    expect(dialog()).not.toBeNull();
    expect(dialog()!.querySelector('[role="alert"]')!.textContent).toBe('invalid birth_year_month');
  });
});
