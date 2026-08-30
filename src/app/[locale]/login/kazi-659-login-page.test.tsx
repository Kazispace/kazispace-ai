/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { getPendingOtpPhone } from '@/lib/auth';
import { BUNDLED_DIRECTORY, setSession } from '@/lib/region';
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

function writeRegionSession(token: string) {
  setSession({
    token,
    home_api_base: 'https://bot.kazispace.ai',
    data_region: 'global',
    directory_version: BUNDLED_DIRECTORY.directory_version,
  });
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

  // Real bug found via manual review: apiRequest's catch-all network-error
  // branch (api-client.ts) sets `error` to the raw `err.message` -- for a
  // thrown fetch() failure that's the literal browser string "Failed to
  // fetch", which `result.error || t(...)` then rendered straight into the
  // UI verbatim. `errorCode: 'NETWORK_ERROR'` was already set alongside it
  // and simply never checked. Assert the translated key wins instead.
  it('shows the translated network-error message, not the raw fetch() error string', async () => {
    requestOtpMock.mockResolvedValue({
      success: false,
      error: 'Failed to fetch',
      errorCode: 'NETWORK_ERROR',
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

    expect(host?.textContent).toContain('networkError');
    expect(host?.textContent).not.toContain('Failed to fetch');
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

  // Review follow-up (PR #215): the suite above only exercised requestOtp and
  // the resume state machine, never the OTP-verify path itself -- the actual
  // "key interaction" (submit the code, log a real user in) the ticket's AC
  // asks each page to cover.
  describe('OTP verify — main path', () => {
    const validPhone = '+77001234567';

    function otpInput(): HTMLInputElement {
      return host!.querySelector('input[type="text"]') as HTMLInputElement;
    }

    function currentForm(): HTMLFormElement {
      return host!.querySelector('form') as HTMLFormElement;
    }

    async function advanceToOtpStep() {
      requestOtpMock.mockResolvedValue({ success: true, attempt: { id: 'attempt-1' } });
      await act(async () => {
        root!.render(<LoginPage params={{ locale: 'en' }} />);
      });
      await act(async () => {
        setInputValue(host!.querySelector('input[type="tel"]') as HTMLInputElement, validPhone);
      });
      await act(async () => {
        currentForm().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });
    }

    beforeEach(() => {
      // Matches the token verifyOtp will report, so useAuthStore's login()
      // doesn't warn about a session/token mismatch (KAZI-533).
      writeRegionSession('otp-session-token');
    });

    it('does not call verifyOtp before a full 6-digit code is entered', async () => {
      await advanceToOtpStep();

      await act(async () => {
        setInputValue(otpInput(), '123');
      });
      await act(async () => {
        currentForm().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });

      expect(verifyOtpMock).not.toHaveBeenCalled();
    });

    it('verifies a 6-digit code, prefers getMe over the OTP-issued user, logs in, and pushes to chat', async () => {
      await advanceToOtpStep();
      verifyOtpMock.mockResolvedValue({
        success: true,
        data: { token: 'otp-session-token', user: sampleUser({ id: 'otp-user' }) },
      });
      getMeMock.mockResolvedValue({
        success: true,
        data: sampleUser({ id: 'me-user', displayName: 'FromMe' }),
      });

      await act(async () => {
        setInputValue(otpInput(), '123456');
      });
      await act(async () => {
        currentForm().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });

      expect(verifyOtpMock).toHaveBeenCalledWith(validPhone, '123456', { id: 'attempt-1' });
      expect(getMeMock).toHaveBeenCalled();
      expect(useAuthStore.getState().isLoggedIn).toBe(true);
      expect(useAuthStore.getState().user).toMatchObject({ id: 'me-user' });
      // +7 numbers infer `ru` as the Language Preference with no manual/profile
      // override (SDD §11.2-A) -- this is not the default `/en/chat`.
      expect(pushMock).toHaveBeenCalledWith('/ru/chat');
    });

    it('falls back to the OTP-issued user when getMe fails after a successful verify', async () => {
      await advanceToOtpStep();
      verifyOtpMock.mockResolvedValue({
        success: true,
        data: { token: 'otp-session-token', user: sampleUser({ id: 'otp-fallback-user' }) },
      });
      getMeMock.mockResolvedValue({ success: false });

      await act(async () => {
        setInputValue(otpInput(), '123456');
      });
      await act(async () => {
        currentForm().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });

      expect(useAuthStore.getState().isLoggedIn).toBe(true);
      expect(useAuthStore.getState().user).toMatchObject({ id: 'otp-fallback-user' });
      expect(pushMock).toHaveBeenCalledWith('/ru/chat');
    });

    it('honors a same-origin ?redirect= target instead of the default /chat destination', async () => {
      window.history.replaceState(null, '', '/en/login?redirect=/en/jobs');
      await advanceToOtpStep();
      verifyOtpMock.mockResolvedValue({
        success: true,
        data: { token: 'otp-session-token', user: sampleUser({ id: 'otp-user' }) },
      });
      getMeMock.mockResolvedValue({ success: true, data: sampleUser({ id: 'otp-user' }) });

      await act(async () => {
        setInputValue(otpInput(), '123456');
      });
      await act(async () => {
        currentForm().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });

      // switchLocalePath rewrites the redirect's locale segment to the
      // resolved target locale (ru for a +7 phone), it doesn't drop it.
      expect(pushMock).toHaveBeenCalledWith('/ru/jobs');
    });

    it('surfaces a verify error and stays on the OTP step when verifyOtp fails', async () => {
      await advanceToOtpStep();
      verifyOtpMock.mockResolvedValue({ success: false, error: 'invalidCodeFailed' });

      await act(async () => {
        setInputValue(otpInput(), '000000');
      });
      await act(async () => {
        currentForm().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });

      expect(host?.textContent).toContain('invalidCodeFailed');
      expect(otpInput()).not.toBeNull();
      expect(pushMock).not.toHaveBeenCalled();
      expect(useAuthStore.getState().isLoggedIn).toBe(false);
    });

    it('shows the translated network-error message on verify, not the raw fetch() error string', async () => {
      await advanceToOtpStep();
      verifyOtpMock.mockResolvedValue({
        success: false,
        error: 'Failed to fetch',
        errorCode: 'NETWORK_ERROR',
      });

      await act(async () => {
        setInputValue(otpInput(), '123456');
      });
      await act(async () => {
        currentForm().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });

      expect(host?.textContent).toContain('networkError');
      expect(host?.textContent).not.toContain('Failed to fetch');
    });
  });
});
