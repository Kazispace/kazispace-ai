'use client';

import { useQuery } from '@tanstack/react-query';

import { useAuthReady } from '@/hooks/use-auth-ready';
import { fetchStudioGetStarted, type GetStartedGuide } from '@/lib/studio-get-started-api';

const MAX_GUIDES = 6;

/**
 * The Get started row's data. Fetched each time Studio opens; while a refetch
 * runs, the last row stays on screen (Studio pattern, Get started — States).
 */
export function useStudioGetStarted(locale: string): {
  guides: GetStartedGuide[];
  isLoading: boolean;
  error: boolean;
} {
  const { ready, authenticated } = useAuthReady();
  const query = useQuery({
    queryKey: ['studio-get-started', locale],
    enabled: ready && authenticated,
    refetchOnMount: 'always',
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const res = await fetchStudioGetStarted();
      if (!res.success || !res.data) throw new Error(res.error ?? 'get-started failed');
      return res.data;
    },
  });
  const guides = (query.data?.guides ?? [])
    .filter((g) => g && typeof g.label === 'string' && g.label.trim() && typeof g.text === 'string' && g.text.trim())
    .slice(0, MAX_GUIDES);
  return { guides, isLoading: query.isLoading, error: Boolean(query.error) };
}
