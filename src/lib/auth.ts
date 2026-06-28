import { STORAGE_KEYS } from './constants';

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
 * Get the stored auth token
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
}

/**
 * Set the auth token after successful login
 */
export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
}

/**
 * Clear auth token on logout
 */
export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER_INFO);
}

/**
 * Get user info from localStorage
 */
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

/**
 * Set user info to localStorage
 */
export function setUserInfo<T>(userInfo: T): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(userInfo));
}

/**
 * Check if user is currently authenticated
 */
export function isAuthenticated(): boolean {
  return !!getAuthToken();
}
