import { STORAGE_KEYS } from './constants';

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
 * Get the stored auth token (client)
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
}

/**
 * Set auth token — dual-write localStorage + cookie (SDD v1.1 §7.2)
 */
export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
  setCookie(STORAGE_KEYS.AUTH_COOKIE, token);
}

/**
 * Clear auth on logout — dual-clear
 */
export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;
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
