'use client';

import { getAuthToken } from '@/lib/auth';
import { useAuthStore } from '@/lib/store';

/**
 * Client auth is hydrated async in Providers — avoid treating "not yet logged in"
 * as an empty workspace-assets response (shows 简历类 · 0).
 *
 * UI must gate on `ready` before showing "login required" to avoid a flash
 * between SSR/hydration and localStorage token read (PR #180 P2).
 * Token-without-user is not authenticated (KAZI-577 R1).
 */
export function useAuthReady(): { ready: boolean; authenticated: boolean } {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const authReady = useAuthStore((s) => s.authReady);
  const user = useAuthStore((s) => s.user);
  const hasToken = Boolean(getAuthToken());

  return {
    ready: authReady,
    authenticated: authReady && isLoggedIn && user != null && hasToken,
  };
}
