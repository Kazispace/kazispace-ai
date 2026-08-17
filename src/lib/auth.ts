import { STORAGE_KEYS } from './constants';
import {
  clearSession as clearRegionSession,
  getSession as getRegionSession,
  setSession as setRegionSession,
} from './region/session';
import type { RegionSession } from './region/types';
import type { User } from '@/types';

/** Align with API spec `expires_in` (2592000s). Middleware only checks presence. */
export const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** Pending OTP phone — sessionStorage only; never localStorage (KAZI-577 R1). */
export const PENDING_OTP_PHONE_SESSION_KEY = 'kazi_pending_otp_phone';
const LEGACY_LAST_OTP_PHONE_KEY = 'kazi_last_otp_phone';

function cookieMaxAgeForToken(token: string, now = Date.now()): number {
  const expMs = decodeJwtExpMs(token);
  if (expMs == null) return AUTH_COOKIE_MAX_AGE_SECONDS;
  const remaining = Math.floor((expMs - now) / 1000);
  return Math.max(1, Math.min(AUTH_COOKIE_MAX_AGE_SECONDS, remaining));
}

function setCookie(name: string, value: string, maxAge: number) {
  if (typeof document === 'undefined') return;
  const secure =
    typeof window !== 'undefined' && window.location.protocol === 'https:'
      ? '; Secure'
      : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
}

function decodeJwtExpMs(token: string): number | null {
  const parts = token.split('.');
  if (parts.length < 2 || !parts[1]) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Opaque tokens (no `exp`) are left to the API 401 path. */
export function isAuthTokenExpired(token: string, now = Date.now()): boolean {
  const expMs = decodeJwtExpMs(token);
  if (expMs == null) return false;
  return expMs <= now + 30_000;
}

function clearCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; max-age=0`;
}

/**
 * Generate a persistent device ID for API identification
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  let deviceId = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
  if (!deviceId) {
    deviceId = 'web_' + crypto.randomUUID();
    localStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
  }
  return deviceId;
}

/**
 * Chat session ID (Master Session).
 * Logged-in: prefer cached canonical id (see master-session.ts); guest: local UUID.
 */
export function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  if (getAuthToken()) {
    const master = sessionStorage.getItem(STORAGE_KEYS.MASTER_SESSION);
    if (master) return master;
  }
  let sessionId = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId);
  }
  return sessionId;
}

export function getWebUserId(): string {
  return getDeviceId();
}

/**
 * Get the stored auth token (client).
 * KAZI-533: token lives in the atomic region session blob (not a bare key).
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const session = getRegionSession();
  if (session?.token) {
    if (isAuthTokenExpired(session.token)) {
      clearAuthToken();
      return null;
    }
    return session.token;
  }

  // Legacy bare token → invalid under IR-FE-1; force re-login.
  const legacy = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  if (legacy) {
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    clearCookie(STORAGE_KEYS.AUTH_COOKIE);
  }
  return null;
}

/**
 * Rewrite the middleware cookie from the persisted region session.
 * Returns false when there is no usable session (missing or JWT expired).
 */
export function syncAuthCookieFromSession(): boolean {
  if (typeof window === 'undefined') return false;
  const session = getRegionSession();
  if (!session?.token || isAuthTokenExpired(session.token)) {
    if (session?.token) clearAuthToken();
    return false;
  }
  setCookie(STORAGE_KEYS.AUTH_COOKIE, session.token, cookieMaxAgeForToken(session.token));
  return true;
}

export function isPersistedUser(value: unknown): value is User {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    row.id.trim() !== '' &&
    typeof row.displayName === 'string'
  );
}

export type AuthHydrateResult =
  | { status: 'authenticated'; token: string; user: User }
  | { status: 'anonymous' }
  | { status: 'invalid' };

/**
 * Resume a still-valid region session via GET /me. Never sets isLoggedIn —
 * caller must `login(token, user)` only after `authenticated` (KAZI-577 R1).
 * Cached USER_INFO is not enough: token-without-validated-user is invalid.
 */
export async function hydrateAuthFromSession(fetchMe: () => Promise<{
  success: boolean;
  data?: User;
}>): Promise<AuthHydrateResult> {
  if (!syncAuthCookieFromSession()) return { status: 'anonymous' };
  const token = getAuthToken();
  if (!token) return { status: 'anonymous' };

  const me = await fetchMe();
  if (me.success && isPersistedUser(me.data)) {
    return { status: 'authenticated', token, user: me.data };
  }

  clearAuthToken();
  return { status: 'invalid' };
}

/** Resume a still-valid login without another OTP (KAZI-577). Never reads a cached code. */
export function resumeAuthSession(): {
  token: string;
  user: User | null;
} | null {
  if (!syncAuthCookieFromSession()) return null;
  const token = getAuthToken();
  if (!token) return null;
  const user = getUserInfo();
  return { token, user: isPersistedUser(user) ? user : null };
}

export function getPendingOtpPhone(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PENDING_OTP_PHONE_SESSION_KEY);
    return raw && raw.trim() ? raw.trim() : null;
  } catch {
    return null;
  }
}

export function setPendingOtpPhone(phone: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = phone.trim();
  if (!trimmed) return;
  try {
    sessionStorage.setItem(PENDING_OTP_PHONE_SESSION_KEY, trimmed);
  } catch {
    // ignore quota / private mode
  }
}

export function clearPendingOtpPhone(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(PENDING_OTP_PHONE_SESSION_KEY);
  } catch {
    // ignore
  }
  try {
    localStorage.removeItem(LEGACY_LAST_OTP_PHONE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Persist a full region session (token + home_api_base + data_region + directory_version).
 * Dual-writes auth cookie for middleware (SDD v1.1 §7.2).
 */
export function setRegionAuthSession(session: RegionSession): void {
  if (typeof window === 'undefined') return;
  setRegionSession(session);
  // Keep legacy key cleared — session blob is SSOT.
  localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  setCookie(
    STORAGE_KEYS.AUTH_COOKIE,
    session.token,
    cookieMaxAgeForToken(session.token)
  );
}

/**
 * @deprecated Prefer setRegionAuthSession with full RegionSession (KAZI-533).
 * Token-only writes are rejected by getAuthToken after clear.
 */
export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  // Do not persist bare token as a valid session — callers must use setRegionAuthSession.
  localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  setCookie(
    STORAGE_KEYS.AUTH_COOKIE,
    token,
    cookieMaxAgeForToken(token)
  );
}

/**
 * Clear auth on logout — dual-clear region session + cookie
 */
export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;
  clearRegionSession();
  localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER_INFO);
  clearPendingOtpPhone();
  clearCookie(STORAGE_KEYS.AUTH_COOKIE);
}

export function getUserInfo<T = unknown>(): T | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEYS.USER_INFO);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setUserInfo<T>(userInfo: T): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(userInfo));
}

export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

export function getEnglishLevel(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.ENGLISH_LEVEL);
}

export function setEnglishLevel(level: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.ENGLISH_LEVEL, level);
}

/** @deprecated Sprint 2 — use useAuthStore */
export function getTelegramUser(): null {
  return null;
}
