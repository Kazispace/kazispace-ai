'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { getRadioHome, radioAccessOf, type RadioAccess } from '@/lib/radio/api';
import type { RadioHome } from '@/types/radio';

export const RADIO_HOME_KEY = ['radio-home'] as const;

export interface RadioHomeState {
  access: RadioAccess;
  home: RadioHome | null;
}

/** `GET /radio/home`, read as [Who sees it] reads it: open / closed (off or not for this user) / unknown. */
export async function fetchRadioHome(): Promise<RadioHomeState> {
  const res = await getRadioHome();
  const access = radioAccessOf(res);
  return { access, home: access === 'open' && res.data ? res.data : null };
}

/**
 * The radio's status and home. `enabled` is false for a non-Chinese interface: the app does not
 * ask the server at all then (kazispace-ui personal-radio, Who sees it).
 */
export function useRadioHome({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: RADIO_HOME_KEY,
    queryFn: fetchRadioHome,
    enabled,
    staleTime: 15_000,
    retry: false,
  });
  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: RADIO_HOME_KEY }),
    [queryClient]
  );
  return {
    access: query.data?.access ?? (query.isError ? 'unknown' : null),
    home: query.data?.home ?? null,
    isLoading: enabled && query.isLoading,
    refresh,
    setHome: (home: RadioHome) =>
      queryClient.setQueryData<RadioHomeState>(RADIO_HOME_KEY, { access: 'open', home }),
  };
}
