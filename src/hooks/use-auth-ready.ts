'use client';

import { useEffect, useState } from 'react';

import { getAuthToken } from '@/lib/auth';
import { useAuthStore } from '@/lib/store';

/**
 * Client auth is hydrated async in Providers — avoid treating "not yet logged in"
 * as an empty workspace-assets response (shows 简历类 · 0).
 */
export function useAuthReady(): { ready: boolean; authenticated: boolean } {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const hasToken = ready && Boolean(getAuthToken());
  return {
    ready,
    authenticated: isLoggedIn || hasToken,
  };
}
