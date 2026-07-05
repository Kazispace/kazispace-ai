'use client';

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { IRP_PROFILE_ENABLED } from '@/lib/constants';
import {
  getInterviewProfile,
  getInterviewProfileHistory,
  postInterviewReadinessCheck,
} from '@/lib/interview-profile-api';
import type { InterviewProfile, InterviewReadinessResult, IrpProfileHistory } from '@/types';

const PROFILE_KEY = ['interview-profile'] as const;
const HISTORY_KEY = ['interview-profile-history'] as const;
const readinessKey = (jobId: string) => ['interview-readiness', jobId] as const;

async function fetchProfile(): Promise<InterviewProfile> {
  const res = await getInterviewProfile();
  if (!res.success || !res.data) {
    throw new Error(res.error ?? 'Failed to load interview profile');
  }
  return res.data;
}

async function fetchHistory(limit = 20): Promise<IrpProfileHistory> {
  const res = await getInterviewProfileHistory({ limit });
  if (!res.success || !res.data) {
    throw new Error(res.error ?? 'Failed to load profile history');
  }
  return res.data;
}

export function useInterviewProfile(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const enabled = IRP_PROFILE_ENABLED && (options?.enabled ?? true);

  const profileQuery = useQuery({
    queryKey: PROFILE_KEY,
    queryFn: fetchProfile,
    enabled,
    staleTime: 30_000,
    retry: 1,
  });

  const historyQuery = useQuery({
    queryKey: HISTORY_KEY,
    queryFn: () => fetchHistory(),
    enabled: false,
    staleTime: 60_000,
  });

  const readinessMutation = useMutation({
    mutationFn: async (jobId: string): Promise<InterviewReadinessResult> => {
      const res = await postInterviewReadinessCheck({ job_id: jobId });
      if (!res.success || !res.data) {
        throw new Error(res.error ?? 'Failed to check readiness');
      }
      return res.data;
    },
  });

  const loadProfile = useCallback(async () => {
    return queryClient.fetchQuery({ queryKey: PROFILE_KEY, queryFn: fetchProfile });
  }, [queryClient]);

  /** Bypass TanStack Query staleTime — for post-diagnosis polling. */
  const loadProfileFresh = useCallback(async () => {
    const data = await fetchProfile();
    queryClient.setQueryData(PROFILE_KEY, data);
    return data;
  }, [queryClient]);

  const loadHistory = useCallback(async () => {
    return queryClient.fetchQuery({ queryKey: HISTORY_KEY, queryFn: () => fetchHistory() });
  }, [queryClient]);

  const checkReadiness = useCallback(
    async (jobId: string) => readinessMutation.mutateAsync(jobId),
    [readinessMutation]
  );

  const refreshProfile = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
  }, [queryClient]);

  return {
    irpEnabled: IRP_PROFILE_ENABLED,
    profile: profileQuery.data ?? null,
    profileStatus: profileQuery.data?.profile_status ?? null,
    isProfileLoading:
      enabled && !profileQuery.data && (profileQuery.isLoading || profileQuery.isFetching),
    profileError: profileQuery.error instanceof Error ? profileQuery.error.message : null,
    history: historyQuery.data ?? null,
    isHistoryLoading: historyQuery.isFetching,
    historyError: historyQuery.error instanceof Error ? historyQuery.error.message : null,
    readinessResult: readinessMutation.data ?? null,
    isReadinessLoading: readinessMutation.isPending,
    readinessError:
      readinessMutation.error instanceof Error ? readinessMutation.error.message : null,
    loadProfile,
    loadProfileFresh,
    loadHistory,
    checkReadiness,
    refreshProfile,
    refetchProfile: profileQuery.refetch,
  };
}

/** Cached readiness check — dedupes mini-card / page remounts for the same job. */
export function useInterviewReadiness(jobId: string | null, options?: { enabled?: boolean }) {
  const queryEnabled =
    IRP_PROFILE_ENABLED && (options?.enabled ?? true) && Boolean(jobId);

  const query = useQuery({
    queryKey: jobId ? readinessKey(jobId) : (['interview-readiness', 'disabled'] as const),
    queryFn: async (): Promise<InterviewReadinessResult> => {
      const res = await postInterviewReadinessCheck({ job_id: jobId! });
      if (!res.success || !res.data) {
        throw new Error(res.error ?? 'Failed to check readiness');
      }
      return res.data;
    },
    enabled: queryEnabled,
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  return {
    readinessResult: query.data ?? null,
    isReadinessLoading: queryEnabled && query.isLoading,
    readinessError: query.error instanceof Error ? query.error.message : null,
    refetchReadiness: query.refetch,
  };
}

/** Growth history — enabled query so errors surface in UI. */
export function useInterviewProfileHistory(options?: { enabled?: boolean }) {
  const enabled = IRP_PROFILE_ENABLED && (options?.enabled ?? true);

  const query = useQuery({
    queryKey: HISTORY_KEY,
    queryFn: () => fetchHistory(),
    enabled,
    staleTime: 60_000,
    retry: 1,
  });

  return {
    history: query.data ?? null,
    isHistoryLoading: enabled && query.isLoading,
    historyError: query.error instanceof Error ? query.error.message : null,
    refetchHistory: query.refetch,
  };
}
