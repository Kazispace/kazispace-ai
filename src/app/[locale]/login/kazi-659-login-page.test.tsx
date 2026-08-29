/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { getPendingOtpPhone } from '@/lib/auth';
import { useAuthStore } from '@/lib/store';
import type { User } from '@/types';

const requestOtpMock = vi.hoisted(() => vi.fn());
const verifyOtpMock = vi.hoisted(() => vi.fn());
const getMeMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/lib/api-client', () => ({
  requestOtp: (phone: string) => requestOtpMock(phone),
  verifyOtp: (phone: string, otp: string, attempt: unknown) =>
    verifyOtpMock(phone, otp, attempt),
  getMe: () => getMeMock(),
}));

vi.mock('@/lib/master-session', () => ({
  syncMasterSession: async () => undefined,
}));

import LoginPage from '@/app/[locale]/login/page';

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

function sampleUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    displayName: 'Ada',
    createdAt: '2026-08-17T00:00:00Z',
    updatedAt: '2026-08-17T00:00:00Z',
    ...overrides,
  };
}

describe('KAZI-659 /login page', () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    requestOtpMock.mockReset();
    verifyOtpMock.mockReset();
    getMeMock.mockReset();
    replaceMock.mockReset();
    pushMock.mockReset();
    sessionStorage.clear();
    localStorage.clear();
    window.history.replaceState(null, '', '/en/login');
    useAuthStore.setState({ token: null, user: null, isLoggedIn: false, authReady: true });
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
    sessionStorage.clear();
    localStorage.clear();
  });

  it('renders the phone entry form when logged out and session is ready', async () => {
    await act(async () => {
      root!.render(<LoginPage params={{ locale: 'en' }} />);
    });

    expect(host?.querySelector('input[type="tel"]')).not.toBeNull();
    expect(host?.textContent).toContain('sendCode');
  });

  it('shows a validation error for a phone number outside the supported regions', async () => {
    await act(async () => {
      root!.render(<LoginPage params={{ locale: 'en' }} />);
    });

    const input = host!.querySelector('input[type="tel"]') as HTMLInputElement;
    const form = host!.querySelector('form') as HTMLFormElement;

    await act(async () => {
      setInputValue(input, '+1 555 0100');
    });
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(host?.textContent).toContain('phoneInvalid');
    expect(requestOtpMock).not.toHaveBeenCalled();
  });

  it('requests an OTP for a valid phone and advances to the code entry step', async () => {
    requestOtpMock.mockResolvedValue({
      success: true,
      attempt: { id: 'attempt-1' },
    });

    await act(async () => {
      root!.render(<LoginPage params={{ locale: 'en' }} />);
    });

    const input = host!.querySelector('input[type="tel"]') as HTMLInputElement;
    const form = host!.querySelector('form') as HTMLFormElement;

    await act(async () => {
      setInputValue(input, '+77001234567');
    });
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(requestOtpMock).toHaveBeenCalledWith('+77001234567');
    expect(host?.textContent).toContain('otpLabel');
    expect(host?.querySelector('input[type="tel"]')).toBeNull();
  });

  it('surfaces the request error and stays on the phone step when requestOtp fails', async () => {
    requestOtpMock.mockResolvedValue({ success: false, error: 'sendCodeFailed' });

    await act(async () => {
      root!.render(<LoginPage params={{ locale: 'en' }} />);
    });

    const input = host!.querySelector('input[type="tel"]') as HTMLInputElement;
    const form = host!.querySelector('form') as HTMLFormElement;

    await act(async () => {
      setInputValue(input, '+77001234567');
    });
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(host?.textContent).toContain('sendCodeFailed');
    expect(host?.querySelector('input[type="tel"]')).not.toBeNull();
  });

  it('shows the "session expired" banner from ?expired=1', async () => {
    window.history.replaceState(null, '', '/en/login?expired=1');

    await act(async () => {
      root!.render(<LoginPage params={{ locale: 'en' }} />);
    });

    expect(host?.textContent).toContain('sessionExpiredContent');
  });

  it('restores a pending phone number left over from a previous OTP attempt', async () => {
    sessionStorage.setItem('kazi_pending_otp_phone', '+77001234567');
    expect(getPendingOtpPhone()).toBe('+77001234567');

    await act(async () => {
      root!.render(<LoginPage params={{ locale: 'en' }} />);
    });

    const input = host!.querySelector('input[type="tel"]') as HTMLInputElement;
    expect(input.value).toBe('+77001234567');
  });

  // Regression for KAZI-577 R1: "token-without-user is invalid" — the login
  // page must derive `resuming`/redirect purely from the auth store (authReady,
  // isLoggedIn, user), and must never redirect on isLoggedIn without a real user.
  describe('KAZI-577 R1 regression — session resume state machine', () => {
    it('shows the resuming spinner (not the form) while authReady is false', async () => {
      useAuthStore.setState({ token: null, user: null, isLoggedIn: false, authReady: false });

      await act(async () => {
        root!.render(<LoginPage params={{ locale: 'en' }} />);
      });

      expect(host?.querySelector('input[type="tel"]')).toBeNull();
      expect(replaceMock).not.toHaveBeenCalled();
    });

    it('does not redirect on isLoggedIn=true with a null user (invalid state)', async () => {
      useAuthStore.setState({
        token: 'stale-token',
        user: null,
        isLoggedIn: true,
        authReady: true,
      });

      await act(async () => {
        root!.render(<LoginPage params={{ locale: 'en' }} />);
      });

      expect(replaceMock).not.toHaveBeenCalled();
      // Falls back to the interactive phone form rather than a stuck spinner.
      expect(host?.querySelector('input[type="tel"]')).not.toBeNull();
    });

    it('redirects to /chat once authReady, isLoggedIn, and a real user all agree', async () => {
      useAuthStore.setState({
        token: 'tok',
        user: sampleUser(),
        isLoggedIn: true,
        authReady: true,
      });

      await act(async () => {
        root!.render(<LoginPage params={{ locale: 'en' }} />);
      });

      expect(replaceMock).toHaveBeenCalledWith('/en/chat');
    });
  });
});
