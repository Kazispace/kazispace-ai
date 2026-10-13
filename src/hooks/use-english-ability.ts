'use client';

import { useQuery } from '@tanstack/react-query';

import { getEnglishAbility } from '@/lib/english-api';
import type { EnglishAbility } from '@/types/english-ability';

/** Backend gate off (`ET_ABILITY_PANEL_ENABLED`) — the panel renders no ability block. */
export const ABILITY_NOT_ENABLED_CODE = 'ET_ABILITY_NOT_ENABLED';

export type EnglishAbilityState =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; ability: EnglishAbility };

class AbilityUnavailable extends Error {}

async function fetchAbility(): Promise<EnglishAbility> {
  const res = await getEnglishAbility();
  if (res.success && res.data) return res.data;
  // 503 = gate off; 404 = a host without the route. Neither is a fault to show the user.
  if (res.errorCode === ABILITY_NOT_ENABLED_CODE || res.status === 503 || res.status === 404) {
    throw new AbilityUnavailable(res.error ?? 'unavailable');
  }
  throw new Error(res.error ?? 'Failed to load ability');
}

/**
 * KAZI-1069 — passive pull: mounted only while the panel is open, so opening it fetches.
 * `refreshKey` is the id of the newest graded turn; a new one refetches while open.
 */
export function useEnglishAbility({
  enabled,
  refreshKey,
}: {
  enabled: boolean;
  refreshKey: string | null;
}) {
  const query = useQuery({
    queryKey: ['english-ability', refreshKey ?? 'none'] as const,
    queryFn: fetchAbility,
    enabled,
    staleTime: 30_000,
    retry: (count, error) => !(error instanceof AbilityUnavailable) && count < 1,
    placeholderData: (previous) => previous,
  });

  let state: EnglishAbilityState;
  if (query.error instanceof AbilityUnavailable) state = { kind: 'unavailable' };
  else if (query.data) state = { kind: 'ready', ability: query.data };
  else if (query.error) {
    state = {
      kind: 'error',
      message: query.error instanceof Error ? query.error.message : 'error',
    };
  } else state = { kind: 'loading' };

  return { state, refetch: query.refetch };
}
