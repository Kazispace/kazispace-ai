/**
 * Clinic/Space chat history window (KAZI-579 / KAZI-580).
 * First pack: latest N full rows + older id stubs. Scroll hydrates by id.
 */

import {
  CHAT_HISTORY_HYDRATE_IDS_MAX,
  CHAT_HISTORY_WINDOW_LIMIT,
} from '@/lib/spaces/perf-policy';

export const HISTORY_FIELDS_FULL = 'full' as const;

export type ChatHistoryFields = typeof HISTORY_FIELDS_FULL | 'ids';

export type ChatHistoryRawRow = Record<string, unknown>;

export type ParsedChatHistoryWindow = {
  /** Chronological: older stubs first, then the full window. */
  rows: ChatHistoryRawRow[];
  mode: 'legacy' | 'window';
  hasMore: boolean;
  oldestCursor: string | null;
  newestCursor: string | null;
};

export type FetchChatHistoryQuery = {
  limit?: number;
  fields?: ChatHistoryFields;
  ids?: string;
  before?: string;
};

export function isHistoryStub(row: {
  contentPending?: boolean;
}): boolean {
  return row.contentPending === true;
}

export function buildChatHistoryQuery(query: FetchChatHistoryQuery): string {
  const params = new URLSearchParams();
  if (query.ids?.trim()) {
    params.set('ids', query.ids.trim());
    params.set('fields', query.fields ?? HISTORY_FIELDS_FULL);
  } else {
    if (query.limit != null) params.set('limit', String(query.limit));
    if (query.fields) params.set('fields', query.fields);
    if (query.before?.trim()) params.set('before', query.before.trim());
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

export function windowedHistoryQuery(
  overrides?: FetchChatHistoryQuery
): FetchChatHistoryQuery {
  if (overrides?.ids?.trim()) {
    return {
      ids: overrides.ids.trim(),
      fields: overrides.fields ?? HISTORY_FIELDS_FULL,
    };
  }
  return {
    limit: overrides?.limit ?? CHAT_HISTORY_WINDOW_LIMIT,
    fields: overrides?.fields ?? HISTORY_FIELDS_FULL,
    ...(overrides?.before?.trim()
      ? { before: overrides.before.trim() }
      : {}),
  };
}

export function capHistoryHydrateIds(ids: string[]): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = raw.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
    if (unique.length >= CHAT_HISTORY_HYDRATE_IDS_MAX) break;
  }
  return unique;
}

function asObject(value: unknown): ChatHistoryRawRow | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as ChatHistoryRawRow;
}

function markStub(row: ChatHistoryRawRow): ChatHistoryRawRow {
  return { ...row, content_pending: true };
}

/**
 * KAZI-579 envelope, or the legacy JSON array (no-query / old BE).
 * Never drop a legacy dump — missing stubs means the pack is complete.
 */
export function parseChatHistoryResponse(
  data: unknown
): ParsedChatHistoryWindow {
  if (Array.isArray(data)) {
    return {
      rows: data.map((item) => asObject(item)).filter(Boolean) as ChatHistoryRawRow[],
      mode: 'legacy',
      hasMore: false,
      oldestCursor: null,
      newestCursor: null,
    };
  }

  const envelope = asObject(data);
  if (!envelope) {
    return {
      rows: [],
      mode: 'legacy',
      hasMore: false,
      oldestCursor: null,
      newestCursor: null,
    };
  }

  const full = Array.isArray(envelope.messages)
    ? (envelope.messages
        .map((item) => asObject(item))
        .filter(Boolean) as ChatHistoryRawRow[])
    : [];
  const stubs = Array.isArray(envelope.older_stubs)
    ? (envelope.older_stubs
        .map((item) => asObject(item))
        .filter(Boolean) as ChatHistoryRawRow[])
        .map(markStub)
    : [];

  const hasEnvelopeShape =
    'older_stubs' in envelope ||
    'has_more' in envelope ||
    'oldest_cursor' in envelope ||
    'newest_cursor' in envelope ||
    Array.isArray(envelope.messages);

  if (!hasEnvelopeShape) {
    return {
      rows: [],
      mode: 'legacy',
      hasMore: false,
      oldestCursor: null,
      newestCursor: null,
    };
  }

  return {
    rows: [...stubs, ...full],
    mode: 'window',
    hasMore: envelope.has_more === true || stubs.length > 0,
    oldestCursor:
      typeof envelope.oldest_cursor === 'string' ? envelope.oldest_cursor : null,
    newestCursor:
      typeof envelope.newest_cursor === 'string' ? envelope.newest_cursor : null,
  };
}

/**
 * Keep already-hydrated rows when a window refetch re-sends stubs.
 * Match by id, not index — stub count vs full window would otherwise clobber.
 */
export function applyHistoryWindowRows<
  T extends { id: string; contentPending?: boolean },
>(
  previous: T[],
  incoming: T[],
  fingerprint: (row: T) => string
): T[] {
  if (incoming.length === 0) return previous;

  const previousById = new Map(previous.map((row) => [row.id, row]));
  const next = incoming.map((row) => {
    const prev = previousById.get(row.id);
    if (!prev) return row;
    if (isHistoryStub(row) && !isHistoryStub(prev)) return prev;
    if (fingerprint(prev) === fingerprint(row)) return prev;
    return row;
  });

  if (
    next.length === previous.length &&
    next.every((row, index) => row === previous[index])
  ) {
    return previous;
  }
  return next;
}

export function mergeHydratedHistoryRows<T extends { id: string }>(
  previous: T[],
  hydrated: T[]
): T[] {
  if (hydrated.length === 0) return previous;
  const byId = new Map(hydrated.map((row) => [row.id, row]));
  let changed = false;
  const next = previous.map((row) => {
    const fresh = byId.get(row.id);
    if (!fresh) return row;
    changed = true;
    return fresh;
  });
  return changed ? next : previous;
}
