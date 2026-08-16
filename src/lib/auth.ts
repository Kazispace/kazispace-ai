import { STORAGE_KEYS } from './constants';
import {
  clearSession as clearRegionSession,
  getSession as getRegionSession,
  setSession as setRegionSession,
} from './region/session';
import type { RegionSession } from './region/types';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function setCookie(name: string, value: string, maxAge = COOKIE_MAX_AGE) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
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
  if (session?.token) return session.token;

  // Legacy bare token → invalid under IR-FE-1; force re-login.
  const legacy = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  if (legacy) {
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    clearCookie(STORAGE_KEYS.AUTH_COOKIE);
  }
  return null;
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
  setCookie(STORAGE_KEYS.AUTH_COOKIE, session.token);
}

/**
 * @deprecated Prefer setRegionAuthSession with full RegionSession (KAZI-533).
 * Token-only writes are rejected by getAuthToken after clear.
 */
export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  // Do not persist bare token as a valid session — callers must use setRegionAuthSession.
  localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  setCookie(STORAGE_KEYS.AUTH_COOKIE, token);
}

/**
 * Clear auth on logout — dual-clear region session + cookie
 */
export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;
  clearRegionSession();
  localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER_INFO);
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
