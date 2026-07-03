'use client';

import { useCallback, useEffect, useState } from 'react';

import { getNextBestAction } from '@/lib/nba-api';
import { useAuthStore } from '@/lib/store';
import type { NextBestActionResponse } from '@/types';

export function useNbaAction() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const userId = useAuthStore((s) => s.user?.id);
  const [data, setData] = useState<NextBestActionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchNba = useCallback(async () => {
    if (!isLoggedIn || !userId) {
      setData(null);
      return;
    }
    setIsLoading(true);
    const res = await getNextBestAction(userId);
    if (res.success && res.data?.next_best_action?.action_type) {
      setData(res.data);
    } else {
      setData(null);
    }
    setIsLoading(false);
  }, [isLoggedIn, userId]);

  useEffect(() => {
    void fetchNba();
  }, [fetchNba]);

  return { nba: data, isLoading, refetch: fetchNba };
}
