'use client';

import { useCallback, useEffect, useState } from 'react';
import { getJobDetail, listJobRecommendations } from '@/lib/jobs-api';
import { useAuthStore } from '@/lib/store';
import type { JobDetailResponse, JobRecommendationItem } from '@/types';

export function useJobRecommendations(page = 1, limit = 10) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const [items, setItems] = useState<JobRecommendationItem[]>([]);
  const [isProUser, setIsProUser] = useState(false);
  const [upgradeHint, setUpgradeHint] = useState<string | undefined>();
  const [engineTotal, setEngineTotal] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isLoggedIn) {
      setItems([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    const res = await listJobRecommendations(page, limit);
    if (!res.success || !res.data) {
      setError(res.error ?? 'Failed to load jobs');
      setIsLoading(false);
      return;
    }
    setItems(res.data.items ?? []);
    setIsProUser(!!res.data.is_pro_user);
    setUpgradeHint(res.data.upgrade_hint);
    setEngineTotal(res.data.engine_total ?? res.data.total);
    setIsLoading(false);
  }, [isLoggedIn, page, limit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, isProUser, upgradeHint, engineTotal, isLoading, error, refresh };
}

export function useJobDetail(jobId: string) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const [job, setJob] = useState<JobDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn || !jobId) {
      setJob(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      const res = await getJobDetail(jobId);
      if (cancelled) return;
      if (!res.success || !res.data) {
        setError(res.error ?? 'Job not found');
        setJob(null);
      } else {
        setJob(res.data);
      }
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, jobId]);

  return { job, isLoading, error };
}
