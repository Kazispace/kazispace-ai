'use client';

import { useCallback, useEffect, useState } from 'react';

import { getSpace } from '@/lib/spaces-api';
import { isSpacesEnabled } from '@/lib/spaces/constants';
import { useAuthStore } from '@/lib/store';
import type { SpaceDetail } from '@/types/spaces';

export function useSpaceDetail(spaceId: string | null) {
  const enabled = isSpacesEnabled();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const [space, setSpace] = useState<SpaceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !isLoggedIn || !spaceId) {
      setSpace(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    const res = await getSpace(spaceId);
    setIsLoading(false);
    if (!res.success || !res.data) {
      setError(res.error ?? 'Failed to load space');
      setSpace(null);
      return;
    }
    setSpace(res.data);
  }, [enabled, isLoggedIn, spaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { space, isLoading, error, refresh, enabled };
}
