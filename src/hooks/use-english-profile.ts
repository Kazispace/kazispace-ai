'use client';

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { EPP_PROFILE_ENABLED } from '@/lib/constants';
import {
  getEnglishProfile,
  getEnglishProfileHistory,
  getEnglishSampleJobs,
  postEnglishOnboarding,
} from '@/lib/english-api';
import type {
  EnglishOnboardingRequest,
  EnglishProfile,
  EnglishProfileHistory,
  EnglishSampleJobs,
} from '@/types';

const PROFILE_KEY = ['english-profile'] as const;
const HISTORY_KEY = ['english-profile-history'] as const;
const SAMPLE_JOBS_KEY = ['english-sample-jobs'] as const;

async function fetchProfile(): Promise<EnglishProfile> {
  const res = await getEnglishProfile();
  if (!res.success || !res.data) {
    throw new Error(res.error ?? 'Failed to load English profile');
  }
  return res.data;
}

async function fetchHistory(limit = 20): Promise<EnglishProfileHistory> {
  const res = await getEnglishProfileHistory({ limit });
  if (!res.success || !res.data) {
    throw new Error(res.error ?? 'Failed to load profile history');
  }
  return res.data;
}

export function useEnglishProfile(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const enabled = EPP_PROFILE_ENABLED && (options?.enabled ?? true);

  const profileQuery = useQuery({
    queryKey: PROFILE_KEY,
    queryFn: fetchProfile,
    enabled,
    staleTime: 30_000,
    retry: 1,
  });

  const onboardingMutation = useMutation({
    mutationFn: async (body: EnglishOnboardingRequest) => {
      const res = await postEnglishOnboarding(body);
      if (!res.success) {
        throw new Error(res.error ?? 'Failed to save onboarding');
      }
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
    },
  });

  const refreshProfile = useCallback(async () => {
    await invalidateEnglishEppCaches(queryClient);
  }, [queryClient]);

  const submitOnboarding = useCallback(
    async (body: EnglishOnboardingRequest) => onboardingMutation.mutateAsync(body),
    [onboardingMutation]
  );

  return {
    eppEnabled: EPP_PROFILE_ENABLED,
    profile: profileQuery.data ?? null,
    profileStatus: profileQuery.data?.profile_status ?? null,
    isProfileLoading:
      enabled && !profileQuery.data && (profileQuery.isLoading || profileQuery.isFetching),
    profileError: profileQuery.error instanceof Error ? profileQuery.error.message : null,
    refreshProfile,
    refetchProfile: profileQuery.refetch,
    submitOnboarding,
    isOnboardingSaving: onboardingMutation.isPending,
    onboardingError:
      onboardingMutation.error instanceof Error ? onboardingMutation.error.message : null,
  };
}

export function useEnglishProfileHistory(options?: { enabled?: boolean }) {
  const enabled = EPP_PROFILE_ENABLED && (options?.enabled ?? true);

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

export function useEnglishSampleJobs(
  displayLevel?: number | null,
  options?: { enabled?: boolean }
) {
  const enabled = EPP_PROFILE_ENABLED && (options?.enabled ?? true);

  const query = useQuery({
    queryKey: [...SAMPLE_JOBS_KEY, displayLevel ?? 'current'] as const,
    queryFn: async (): Promise<EnglishSampleJobs> => {
      const res = await getEnglishSampleJobs(
        displayLevel != null ? { display_level: displayLevel } : undefined
      );
      if (!res.success || !res.data) {
        throw new Error(res.error ?? 'Failed to load sample jobs');
      }
      return res.data;
    },
    enabled,
    staleTime: 60_000,
    retry: 1,
  });

  return {
    sampleJobs: query.data ?? null,
    isSampleJobsLoading: enabled && query.isLoading,
    sampleJobsError: query.error instanceof Error ? query.error.message : null,
    refetchSampleJobs: query.refetch,
  };
}

export function invalidateEnglishEppCaches(
  queryClient: ReturnType<typeof useQueryClient>
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: PROFILE_KEY }),
    queryClient.invalidateQueries({ queryKey: HISTORY_KEY }),
    queryClient.invalidateQueries({ queryKey: SAMPLE_JOBS_KEY }),
  ]);
}

/** @deprecated Use invalidateEnglishEppCaches */
export function invalidateEnglishProfile(queryClient: ReturnType<typeof useQueryClient>) {
  return invalidateEnglishEppCaches(queryClient);
}
