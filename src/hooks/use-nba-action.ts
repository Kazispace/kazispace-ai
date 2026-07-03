'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { getNextBestAction } from '@/lib/nba-api';
import { useAuthStore } from '@/lib/store';
import type { NextBestActionResponse } from '@/types';

export function useNbaAction() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const userId = useAuthStore((s) => s.user?.id);
  const [data, setData] = useState<NextBestActionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fetchGenRef = useRef(0);

  const fetchNba = useCallback(async () => {
    if (!isLoggedIn || !userId) {
      fetchGenRef.current += 1;
      setData(null);
      setIsLoading(false);
      return;
    }
    const gen = ++fetchGenRef.current;
    setIsLoading(true);
    const res = await getNextBestAction(userId);
    if (gen !== fetchGenRef.current) {
      return;
    }
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

  useEffect(() => {
    const onFocus = () => {
      void fetchNba();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchNba]);

  return { nba: data, isLoading, refetch: fetchNba };
}
