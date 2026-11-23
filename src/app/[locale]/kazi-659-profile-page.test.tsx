/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore, useUIStore } from '@/lib/store';
import type { User } from '@/types';

const getMeMock = vi.hoisted(() => vi.fn());
const patchMeMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());
const showToastMock = vi.hoisted(() => vi.fn());
const searchRef = vi.hoisted(() => ({ value: '' }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  usePathname: () => '/en/profile',
  useSearchParams: () => new URLSearchParams(searchRef.value),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/lib/api-client', () => ({
  getMe: () => getMeMock(),
  patchMe: (body: unknown) => patchMeMock(body),
}));

// React tracks the last value it set on a controlled input via a wrapped
// property setter; assigning `.value` directly and dispatching 'input' is a
// no-op from React's perspective. Go through the native setter instead.
function setInputValue(input: HTMLInputElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )!.set!;
  nativeSetter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

import ProfilePage from '@/app/[locale]/(workspace)/profile/page';

function sampleUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    displayName: 'Ada',
    createdAt: '2026-08-17T00:00:00Z',
    updatedAt: '2026-08-17T00:00:00Z',
    targetRole: '',
    ...overrides,
  };
}

describe('KAZI-659 /profile page', () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    getMeMock.mockReset();
    patchMeMock.mockReset();
    pushMock.mockReset();
    replaceMock.mockReset();
    showToastMock.mockReset();
    getMeMock.mockResolvedValue({ success: true, data: sampleUser() });
    useUIStore.setState({ isTelegramMiniApp: false, showToast: showToastMock });
    useAuthStore.setState({
      token: 'tok',
      user: sampleUser(),
      isLoggedIn: true,
      authReady: true,
    });
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
    useAuthStore.setState({ token: null, user: null, isLoggedIn: false, authReady: false });
  });

  // Page header spec 0.2, "Back target": opened from Chat (`?return=chat` from a reply
  // button, `?return=cv` from the CV gate) the back link returns to Chat.
  it.each([
    ['', '/en/mine'],
    ['?return=chat', '/en/chat'],
    ['?return=cv', '/en/chat'],
  ])('back link for %j goes to %s', async (search, href) => {
    searchRef.value = search;
    useAuthStore.setState({ token: null, user: null, isLoggedIn: false, authReady: true });
    await act(async () => {
      root!.render(<ProfilePage params={{ locale: 'en' }} />);
    });
    const backLinks = host?.querySelectorAll('a[aria-label="backTo"]') ?? [];
    expect(backLinks).toHaveLength(1);
    expect(backLinks[0].getAttribute('href')).toBe(href);
    searchRef.value = '';
  });

  it('prompts sign-in instead of the form when logged out', async () => {
    useAuthStore.setState({ token: null, user: null, isLoggedIn: false, authReady: true });

    await act(async () => {
      root!.render(<ProfilePage params={{ locale: 'en' }} />);
    });

    expect(host?.textContent).toContain('loginRequired');
    expect(host?.querySelector('form')).toBeNull();
    expect(getMeMock).not.toHaveBeenCalled();
  });

  it('loads the current user via getMe and renders the form once logged in', async () => {
    getMeMock.mockResolvedValue({
      success: true,
      data: sampleUser({ targetRole: 'Backend Engineer' }),
    });

    await act(async () => {
      root!.render(<ProfilePage params={{ locale: 'en' }} />);
    });
    // Flush the async getMe().then(...) chain inside the load effect.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getMeMock).toHaveBeenCalled();
    const form = host?.querySelector('form');
    expect(form).not.toBeNull();
    const targetRoleInput = host?.querySelector('input[placeholder="targetRolePlaceholder"]') as
      | HTMLInputElement
      | undefined;
    expect(targetRoleInput?.value).toBe('Backend Engineer');
  });

  it('saves a changed field and shows a success toast', async () => {
    getMeMock.mockResolvedValue({
      success: true,
      data: sampleUser({ targetRole: 'Backend Engineer' }),
    });
    patchMeMock.mockResolvedValue({
      success: true,
      data: sampleUser({ targetRole: 'Staff Engineer' }),
    });

    await act(async () => {
      root!.render(<ProfilePage params={{ locale: 'en' }} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const targetRoleInput = host!.querySelector(
      'input[placeholder="targetRolePlaceholder"]'
    ) as HTMLInputElement;
    await act(async () => {
      setInputValue(targetRoleInput, 'Staff Engineer');
    });

    const form = host!.querySelector('form') as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(patchMeMock).toHaveBeenCalledWith(
      expect.objectContaining({ target_role: 'Staff Engineer' })
    );
    expect(showToastMock).toHaveBeenCalledWith('saveSuccess', 'info');
  });

  it('shows a save-failed toast and keeps the form editable when patchMe fails', async () => {
    getMeMock.mockResolvedValue({
      success: true,
      data: sampleUser({ targetRole: 'Backend Engineer' }),
    });
    patchMeMock.mockResolvedValue({ success: false, error: 'saveFailed' });

    await act(async () => {
      root!.render(<ProfilePage params={{ locale: 'en' }} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const targetRoleInput = host!.querySelector(
      'input[placeholder="targetRolePlaceholder"]'
    ) as HTMLInputElement;
    await act(async () => {
      setInputValue(targetRoleInput, 'Staff Engineer');
    });

    const form = host!.querySelector('form') as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(showToastMock).toHaveBeenCalledWith('saveFailed', 'error');
    expect(host?.querySelector('form')).not.toBeNull();
  });

  // KAZI-1443 — native language: a seven-item single-choice list (personal-radio.md, Story list by
  // native language). Not set clears it with null; an unchanged value is not sent.
  describe('native language', () => {
    function setSelect(select: HTMLSelectElement, value: string) {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!;
      nativeSetter.call(select, value);
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    async function load(nativeLanguage: User['nativeLanguage']) {
      getMeMock.mockResolvedValue({ success: true, data: sampleUser({ targetRole: 'Dev', nativeLanguage }) });
      await act(async () => {
        root!.render(<ProfilePage params={{ locale: 'en' }} />);
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      return host!.querySelector('[data-testid="profile-native-language"]') as HTMLSelectElement;
    }
    async function submit() {
      const form = host!.querySelector('form') as HTMLFormElement;
      await act(async () => {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await Promise.resolve();
      });
    }

    it('lists the seven items in spec order and shows the stored value', async () => {
      const select = await load('ru');
      expect(Array.from(select.options).map((o) => o.value)).toEqual(['zh', 'ru', 'kk', 'uz', 'en', 'other', '']);
      expect(Array.from(select.options).map((o) => o.textContent)).toEqual([
        'nativeLanguageOptions.zh',
        'nativeLanguageOptions.ru',
        'nativeLanguageOptions.kk',
        'nativeLanguageOptions.uz',
        'nativeLanguageOptions.en',
        'nativeLanguageOptions.other',
        'nativeLanguageUnset',
      ]);
      expect(select.value).toBe('ru');
    });

    it('sends a newly picked language', async () => {
      patchMeMock.mockResolvedValue({ success: true, data: sampleUser({ nativeLanguage: 'kk' }) });
      const select = await load(null);
      expect(select.value).toBe('');
      await act(async () => setSelect(select, 'kk'));
      await submit();
      expect(patchMeMock).toHaveBeenCalledWith({ native_language: 'kk' });
    });

    it('Not set sends null', async () => {
      patchMeMock.mockResolvedValue({ success: true, data: sampleUser({ nativeLanguage: null }) });
      const select = await load('en');
      await act(async () => setSelect(select, ''));
      await submit();
      expect(patchMeMock).toHaveBeenCalledWith({ native_language: null });
    });

    it('an unchanged value is not sent with other changes', async () => {
      patchMeMock.mockResolvedValue({ success: true, data: sampleUser({ nativeLanguage: 'uz', targetRole: 'Lead' }) });
      await load('uz');
      const input = host!.querySelector('input[placeholder="targetRolePlaceholder"]') as HTMLInputElement;
      await act(async () => setInputValue(input, 'Lead'));
      await submit();
      expect(patchMeMock).toHaveBeenCalledWith({ target_role: 'Lead' });
    });
  });
});
