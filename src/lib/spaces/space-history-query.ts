import { fetchChatHistory } from '@/lib/api-client';
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
  const res = await fetchChatHistory(masterSessionId, { signal });
  if (signal?.aborted) {
    const err = new Error('Aborted');
    err.name = 'AbortError';
    throw err;
  }
  if (!res.success || !res.data) return [];
  const list = Array.isArray(res.data) ? res.data : (res.data.messages ?? []);
  return mapSpaceHistoryMessages(list, locale);
}

/** Fingerprint for warm-switch row identity (skip replace when unchanged). */
export function spaceMessageRowFingerprint(message: SpaceChatMessage): string {
  return [
    message.id,
    message.serverMessageId ?? '',
    message.role,
    message.content,
    message.status ?? '',
    String(message.cards?.length ?? 0),
    String(message.nextActions?.length ?? 0),
    String(message.customComponents?.length ?? 0),
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
