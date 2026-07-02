'use client';

import { useCallback, useEffect, useState } from 'react';
import { getJobDetail, listJobRecommendations } from '@/lib/jobs-api';
import { useAuthStore } from '@/lib/store';
import type { JobDetailResponse, JobRecommendationItem } from '@/types/jobs';

export function useJobRecommendations(page = 1, limit = 10) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const [items, setItems] = useState<JobRecommendationItem[]>([]);
  const [isProUser, setIsProUser] = useState(false);
  const [upgradeHint, setUpgradeHint] = useState<string | undefined>();
  const [engineTotal, setEngineTotal] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const refresh = useCallback(async () => {
    if (!isLoggedIn) {
      setItems([]);
      setNeedsLogin(true);
      setIsLoading(false);
      return;
    }
    setNeedsLogin(false);
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
    setUpgradeHint(res.data.upgrade_hint ?? undefined);
    setEngineTotal(res.data.engine_total ?? res.data.total ?? undefined);
    setIsLoading(false);
  }, [isLoggedIn, page, limit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    items,
    isProUser,
    upgradeHint,
    engineTotal,
    isLoading,
    error,
    needsLogin,
    refresh,
  };
}

export function useJobDetail(jobId: string) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const [job, setJob] = useState<JobDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    if (!isLoggedIn || !jobId) {
      setJob(null);
      setNeedsLogin(!isLoggedIn);
      setIsLoading(false);
      return;
    }
    setNeedsLogin(false);
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

  return { job, isLoading, error, needsLogin };
}
