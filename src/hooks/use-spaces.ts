'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { listSpaces } from '@/lib/spaces-api';
import { isSpacesEnabled } from '@/lib/spaces/constants';
import { useAuthStore } from '@/lib/store';
import type { SpaceSummary } from '@/types/spaces';

const STALE_TIME_MS = 10_000;

export function useSpaces(options?: { panelOpen?: boolean; enabled?: boolean }) {
  const enabled = (options?.enabled ?? true) && isSpacesEnabled();
  const panelOpen = options?.panelOpen ?? false;
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  const [spaces, setSpaces] = useState<SpaceSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchedAt = useRef(0);

  const refresh = useCallback(
    async (force = false) => {
      if (!enabled || !isLoggedIn) {
        setSpaces([]);
        setError(null);
        return;
      }

      const now = Date.now();
      if (!force && now - lastFetchedAt.current < STALE_TIME_MS) return;

      setIsLoading(true);
      setError(null);
      const res = await listSpaces();
      setIsLoading(false);

      if (!res.success || !res.data) {
        setError(res.error ?? 'Failed to load spaces');
        return;
      }

      lastFetchedAt.current = now;
      setSpaces(res.data.spaces);
    },
    [enabled, isLoggedIn]
  );

  useEffect(() => {
    if (!enabled || !isLoggedIn) return;
    void refresh(panelOpen);
  }, [enabled, isLoggedIn, panelOpen, refresh]);

  useEffect(() => {
    if (!enabled || !isLoggedIn) return;
    const onFocus = () => void refresh(true);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [enabled, isLoggedIn, refresh]);

  return { spaces, isLoading, error, refresh, enabled };
}
