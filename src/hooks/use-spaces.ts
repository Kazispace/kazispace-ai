'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { listSpaces } from '@/lib/spaces-api';
import { isSpacesEnabled } from '@/lib/spaces/constants';
import { seedSpaceDetailPlaceholders } from '@/lib/spaces/space-detail-from-summary';
import { SPACES_LIST_INVALIDATE_EVENT } from '@/lib/spaces-list-invalidate';
import { useAuthStore } from '@/lib/store';
import type { SpaceSummary } from '@/types/spaces';

const STALE_TIME_MS = 10_000;

export function useSpaces(options?: {
  panelOpen?: boolean;
  enabled?: boolean;
  /** Bypass stale-time on mount (e.g. `/spaces` index resolver). */
  fetchImmediately?: boolean;
}) {
  const enabled = (options?.enabled ?? true) && isSpacesEnabled();
  const panelOpen = options?.panelOpen ?? false;
  const fetchImmediately = options?.fetchImmediately ?? false;
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const queryClient = useQueryClient();

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
      seedSpaceDetailPlaceholders(queryClient, res.data.spaces);
    },
    [enabled, isLoggedIn, queryClient]
  );

  useEffect(() => {
    if (!enabled || !isLoggedIn) return;
    void refresh(fetchImmediately || panelOpen);
  }, [enabled, fetchImmediately, isLoggedIn, panelOpen, refresh]);

  useEffect(() => {
    if (!enabled || !isLoggedIn) return;
    const onInvalidate = () => void refresh(true);
    window.addEventListener(SPACES_LIST_INVALIDATE_EVENT, onInvalidate);
    return () => window.removeEventListener(SPACES_LIST_INVALIDATE_EVENT, onInvalidate);
  }, [enabled, isLoggedIn, refresh]);

  useEffect(() => {
    if (!enabled || !isLoggedIn) return;
    const onFocus = () => void refresh(true);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [enabled, isLoggedIn, refresh]);

  return { spaces, isLoading, error, refresh, enabled };
}
