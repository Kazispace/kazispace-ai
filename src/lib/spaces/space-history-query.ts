import { fetchChatHistory } from '@/lib/api-client';
import {
  applyHistoryWindowRows,
  capHistoryHydrateIds,
  mergeHydratedHistoryRows,
  parseChatHistoryResponse,
  windowedHistoryQuery,
} from '@/lib/chat/history-window';
import {
  SPACE_HISTORY_GC_MS,
  SPACE_HISTORY_STALE_MS,
} from '@/lib/spaces/perf-policy';
import {
  mapSpaceHistoryMessages,
  type SpaceChatMessage,
} from '@/lib/spaces/turn';

/** Shared TanStack Query key for master-session history (KAZI-562). */
export const spaceHistoryQueryKey = (
  masterSessionId: string,
  locale: string
) => ['space-history', masterSessionId, locale] as const;

export const SPACE_HISTORY_QUERY_DEFAULTS = {
  staleTime: SPACE_HISTORY_STALE_MS,
  gcTime: SPACE_HISTORY_GC_MS,
  /** Warm A→B→A must not refetch on remount (KAZI-566). Send path uses fetchQuery. */
  refetchOnMount: false,
  refetchOnWindowFocus: false,
} as const;

/**
 * QueryFn for Space chat history. Honors TanStack Query AbortSignal.
 */
export async function fetchSpaceHistoryMessages(
  masterSessionId: string,
  locale: string,
  signal?: AbortSignal
): Promise<SpaceChatMessage[]> {
  const res = await fetchChatHistory(masterSessionId, {
    signal,
    ...windowedHistoryQuery(),
  });
  if (signal?.aborted) {
    const err = new Error('Aborted');
    err.name = 'AbortError';
    throw err;
  }
  // Failed/aborted fetches must not become a successful `[]` — TanStack would
  // cache that empty array and Space chat would paint the blank welcome
  // (KAZI-588 R2).
  if (!res.success || res.data == null) {
    throw new Error(res.error ?? 'Failed to load space history');
  }
  const parsed = parseChatHistoryResponse(res.data);
  return mapSpaceHistoryMessages(parsed.rows, locale);
}

export async function hydrateSpaceHistoryMessages(
  masterSessionId: string,
  locale: string,
  ids: string[],
  signal?: AbortSignal
): Promise<SpaceChatMessage[]> {
  const capped = capHistoryHydrateIds(ids);
  if (capped.length === 0) return [];
  const res = await fetchChatHistory(masterSessionId, {
    signal,
    ...windowedHistoryQuery({ ids: capped.join(',') }),
  });
  if (!res.success || !res.data) return [];
  const parsed = parseChatHistoryResponse(res.data);
  return mapSpaceHistoryMessages(
    parsed.rows.filter((row) => row.content_pending !== true),
    locale
  );
}

/**
 * Window refetch must not clobber rows already hydrated by scroll.
 */
export function applySpaceHistoryWindowRows(
  previous: SpaceChatMessage[],
  incoming: SpaceChatMessage[]
): SpaceChatMessage[] {
  return applyHistoryWindowRows(
    previous,
    incoming,
    spaceMessageRowFingerprint
  );
}

export function mergeHydratedSpaceHistoryRows(
  previous: SpaceChatMessage[],
  hydrated: SpaceChatMessage[]
): SpaceChatMessage[] {
  return mergeHydratedHistoryRows(previous, hydrated);
}

/** Fingerprint for warm-switch row identity (skip replace when unchanged). */
export function spaceMessageRowFingerprint(message: SpaceChatMessage): string {
  return [
    message.id,
    message.serverMessageId ?? '',
    message.role,
    message.content,
    message.contentPending ? 'pending' : '',
    message.status ?? '',
    String(message.cards?.length ?? 0),
    String(message.nextActions?.length ?? 0),
    String(message.customComponents?.length ?? 0),
    // KAZI-651 Phase A review (PR #212): without these, a row that gains a
    // referral/upgradeCta on a later fetch fingerprints identically to the
    // earlier one without it, so preserveSpaceMessageRows/warm-cache dedup
    // would keep the stale reference and silently drop the field.
    message.referral ? message.referral.agentId : '',
    message.upgradeCta ? 'upgradeCta' : '',
    // Phase C.1a: same lesson applied up front for the four new read-path
    // parity fields, instead of waiting for review to catch it again.
    message.intent ?? '',
    // Review (PR #216): a bare `citations?.length` doesn't catch two
    // same-length citation lists with different URLs -- join the actual
    // URLs so a content change is detected, not just a count change.
    message.citations ? message.citations.map((c) => c.url).join('\0') : '',
    message.capabilityId ?? '',
    // playbookId has three meaningfully different states (resolveSearchCapability):
    // undefined = BE omitted the field, null = unbound/general search, string =
    // bound playbook. A bare `?? ''` would collapse undefined and null together.
    message.playbookId === undefined
      ? ''
      : message.playbookId === null
        ? '\0null'
        : message.playbookId,
  ].join('\0');
}

/**
 * If revalidated history matches previous rows, return the previous array
 * (stable reference) so list reconciliation does not remount every bubble.
 */
export function preserveSpaceMessageRows(
  previous: SpaceChatMessage[],
  next: SpaceChatMessage[]
): SpaceChatMessage[] {
  if (
    previous.length === next.length &&
    previous.every(
      (row, index) =>
        spaceMessageRowFingerprint(row) ===
        spaceMessageRowFingerprint(next[index]!)
    )
  ) {
    return previous;
  }

  return next.map((message, index) => {
    const prev = previous[index];
    if (
      prev &&
      spaceMessageRowFingerprint(prev) === spaceMessageRowFingerprint(message)
    ) {
      return prev;
    }
    return message;
  });
}
