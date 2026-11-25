/**
 * @vitest-environment jsdom
 *
 * KAZI-1436 (§5.1.1 ④ ⑤ ⑧): 「我的」 › profile shows the stored birth year-month and changes it any time.
 * A change is sent as `birth_year_month` with the browser zone; half a year-month is stopped before the
 * request; an untouched field sends nothing for it.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore, useUIStore } from '@/lib/store';
import type { User } from '@/types';

const getMe = vi.fn();
const patchMe = vi.fn();
const push = vi.fn();

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/en/profile',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/lib/api-client', () => ({
  getMe: (...args: unknown[]) => getMe(...args),
  patchMe: (...args: unknown[]) => patchMe(...args),
}));
vi.mock('@/lib/auth', () => ({
  setUserInfo: vi.fn(),
}));

import ProfilePage from '@/app/[locale]/(workspace)/profile/page';

function user(over: Partial<User> = {}): User {
  return { id: '42', displayName: 'U', createdAt: '', updatedAt: '', currentStatus: 'student', ...over };
}

const sel = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLSelectElement;

function setSelect(id: string, value: string) {
  act(() => {
    const el = sel(id);
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function submit() {
  const form = document.querySelector('form')!;
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

describe('KAZI-1436 profile birth year-month', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    getMe.mockReset();
    patchMe.mockReset();
    push.mockReset();
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      timeZone: 'Asia/Shanghai',
    } as Intl.ResolvedDateTimeFormatOptions);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  async function mount(u: User) {
    getMe.mockResolvedValue({ success: true, data: u });
    await act(async () => {
      useAuthStore.setState({ isLoggedIn: true, token: 't', user: u });
      root.render(<ProfilePage params={{ locale: 'en' }} />);
    });
    await act(async () => {
      await Promise.resolve();
    });
  }

  it('shows the stored value', async () => {
    await mount(user({ birthYearMonth: '1990-03' }));
    expect(sel('profile-birth-year').value).toBe('1990');
    expect(sel('profile-birth-month').value).toBe('3');
  });

  it('a change is sent with the browser zone', async () => {
    await mount(user({ birthYearMonth: '1990-03' }));
    patchMe.mockResolvedValue({ success: true, data: user({ birthYearMonth: '1991-04' }) });
    setSelect('profile-birth-year', '1991');
    setSelect('profile-birth-month', '4');
    await submit();
    expect(patchMe).toHaveBeenCalledWith({ birth_year_month: '1991-04', time_zone: 'Asia/Shanghai' });
  });

  it('a first fill-in from empty is sent too', async () => {
    await mount(user({ birthYearMonth: null, needsAge: true }));
    patchMe.mockResolvedValue({ success: true, data: user({ birthYearMonth: '2008-05' }) });
    setSelect('profile-birth-year', '2008');
    setSelect('profile-birth-month', '5');
    await submit();
    expect(patchMe).toHaveBeenCalledWith({ birth_year_month: '2008-05', time_zone: 'Asia/Shanghai' });
  });

  it('half a year-month is stopped before the request', async () => {
    const showToast = vi.fn();
    useUIStore.setState({ showToast } as never);
    await mount(user({ birthYearMonth: null }));
    setSelect('profile-birth-year', '2008');
    await submit();
    expect(patchMe).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('birthInvalid', 'error');
  });

  it('an untouched field sends nothing for it', async () => {
    await mount(user({ birthYearMonth: '1990-03', targetRole: '' }));
    patchMe.mockResolvedValue({ success: true, data: user({ birthYearMonth: '1990-03', currentStatus: 'employed' }) });
    setSelect('profile-birth-year', '1990'); // same value
    act(() => {
      const statusSelect = Array.from(document.querySelectorAll('select')).find((s) =>
        Array.from(s.options).some((o) => o.value === 'employed')
      )!;
      statusSelect.value = 'employed';
      statusSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await submit();
    expect(patchMe).toHaveBeenCalledWith({ current_status: 'employed' });
  });
});
