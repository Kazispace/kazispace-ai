/**
 * Persist Space job cards across remount / history rehydrate.
 * GET …/messages often returns text only; cards live on turn `assistant_response`
 * (and BE session snapshot) but are omitted from history rows.
 *
 * Named job-cards for the current MVP (type=job teasers). Other card types can
 * reuse the same store once history/turn expose them — rename then if needed.
 */

import type { ChatJobCard } from '@/types/chat-envelope';
import type { SpaceChatMessage } from '@/lib/spaces/turn';

const STORAGE_PREFIX = 'ks.space.jobCards.v2.';
/** Pre-#146 key shape — removed on read so sessionStorage does not accumulate junk. */
const LEGACY_V1_PREFIX = 'ks.space.jobCards.v1.';
const CONTENT_PREFIX_LENGTH = 48;

type OrdinalEntry = {
  /** Light guard against ordinal drift (trimmed content prefix). */
  contentPrefix: string;
  cards: ChatJobCard[];
};

type SpaceJobCardsCache = {
  masterSessionId: string | null;
  /** Parallel to assistant turns (null = no cards for that turn). */
  byOrdinal: (OrdinalEntry | null)[];
  /** Prefer when history exposes persisted message ids. */
  byMessageId: Record<string, ChatJobCard[]>;
};

function normalizeMasterSessionId(
  masterSessionId: string | null | undefined
): string | null {
  return masterSessionId?.trim() || null;
}

function contentPrefix(content: string): string {
  return content.trim().slice(0, CONTENT_PREFIX_LENGTH);
}

function storageKey(spaceId: string, masterSessionId: string | null): string {
  const sessionPart = masterSessionId || '_none';
  return `${STORAGE_PREFIX}${spaceId}.${sessionPart}`;
}

function emptyCache(masterSessionId: string | null = null): SpaceJobCardsCache {
  return { masterSessionId, byOrdinal: [], byMessageId: {} };
}

function getSessionStorage(): Storage | null {
  if (typeof globalThis === 'undefined') return null;
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function purgeLegacyV1Cache(storage: Storage, spaceId: string): void {
  try {
    storage.removeItem(`${LEGACY_V1_PREFIX}${spaceId}`);
  } catch {
    // ignore
  }
}

export function loadSpaceJobCardsCache(
  spaceId: string,
  masterSessionId: string | null
): SpaceJobCardsCache {
  const normalizedSessionId = normalizeMasterSessionId(masterSessionId);
  const storage = getSessionStorage();
  if (!storage) return emptyCache(normalizedSessionId);
  purgeLegacyV1Cache(storage, spaceId);
  try {
    const raw = storage.getItem(storageKey(spaceId, normalizedSessionId));
    if (!raw) return emptyCache(normalizedSessionId);
    const parsed = JSON.parse(raw) as Partial<SpaceJobCardsCache>;
    const parsedSessionId = normalizeMasterSessionId(parsed.masterSessionId);
    // Reject stale cache if master session was rebound under the same spaceId.
    if (
      parsedSessionId !== normalizedSessionId &&
      parsedSessionId != null &&
      normalizedSessionId != null
    ) {
      return emptyCache(normalizedSessionId);
    }
    return {
      masterSessionId: normalizedSessionId,
      byOrdinal: Array.isArray(parsed.byOrdinal) ? parsed.byOrdinal : [],
      byMessageId:
        parsed.byMessageId && typeof parsed.byMessageId === 'object'
          ? parsed.byMessageId
          : {},
    };
  } catch {
    return emptyCache(normalizedSessionId);
  }
}

function saveSpaceJobCardsCache(
  spaceId: string,
  masterSessionId: string | null,
  cache: SpaceJobCardsCache
): void {
  const normalizedSessionId = normalizeMasterSessionId(masterSessionId);
  const storage = getSessionStorage();
  if (!storage) return;
  purgeLegacyV1Cache(storage, spaceId);
  try {
    storage.setItem(
      storageKey(spaceId, normalizedSessionId),
      JSON.stringify({ ...cache, masterSessionId: normalizedSessionId })
    );
  } catch {
    // Quota / private mode — cards still work until remount.
  }
}

/** Snapshot assistant cards from the current thread into sessionStorage. */
export function rememberSpaceJobCards(
  spaceId: string,
  masterSessionId: string | null,
  messages: SpaceChatMessage[]
): void {
  const normalizedSessionId = normalizeMasterSessionId(masterSessionId);
  const prev = loadSpaceJobCardsCache(spaceId, normalizedSessionId);
  const byOrdinal: (OrdinalEntry | null)[] = [];
  const byMessageId = { ...prev.byMessageId };

  let ordinal = 0;
  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    const cards =
      message.cards && message.cards.length > 0 ? message.cards : null;
    const prior = prev.byOrdinal[ordinal] ?? null;
    const nextCards = cards ?? prior?.cards ?? null;
    const prefix = contentPrefix(message.content);
    byOrdinal.push(
      nextCards && nextCards.length > 0
        ? { contentPrefix: prefix, cards: nextCards }
        : null
    );
    if (nextCards && nextCards.length > 0) {
      byMessageId[message.id] = nextCards;
      if (message.serverMessageId) {
        byMessageId[message.serverMessageId] = nextCards;
      }
    }
    ordinal += 1;
  }

  saveSpaceJobCardsCache(spaceId, normalizedSessionId, {
    masterSessionId: normalizedSessionId,
    byOrdinal,
    byMessageId,
  });
}

/** Attach cached cards onto history rows that only have text. */
export function applyCachedSpaceJobCards(
  spaceId: string,
  masterSessionId: string | null,
  messages: SpaceChatMessage[]
): SpaceChatMessage[] {
  const cache = loadSpaceJobCardsCache(spaceId, masterSessionId);
  if (cache.byOrdinal.length === 0 && Object.keys(cache.byMessageId).length === 0) {
    return messages;
  }

  let ordinal = 0;
  return messages.map((message) => {
    if (message.role !== 'assistant') return message;
    const index = ordinal;
    ordinal += 1;
    if (message.cards && message.cards.length > 0) return message;

    const byId =
      cache.byMessageId[message.id] ??
      (message.serverMessageId
        ? cache.byMessageId[message.serverMessageId]
        : undefined);
    if (byId && byId.length > 0) {
      return { ...message, cards: byId };
    }

    const byOrd = cache.byOrdinal[index];
    if (
      byOrd &&
      byOrd.cards.length > 0 &&
      byOrd.contentPrefix === contentPrefix(message.content)
    ) {
      return { ...message, cards: byOrd.cards };
    }

    return message;
  });
}

/**
 * Copy cards from in-memory previous onto history rows only.
 * Does **not** append previous-only messages (unlike mergeSpaceMessagesAfterSend).
 * History is SSOT for which turns exist.
 *
 * Ordinal fallback assumes the nth assistant in `history` corresponds to the nth
 * assistant in `previous`. If that drifts (e.g. a user turn dropped on the server),
 * contentPrefix must still match or cards are not copied.
 */
export function enrichHistoryWithPreviousCards(
  history: SpaceChatMessage[],
  previous: SpaceChatMessage[]
): SpaceChatMessage[] {
  if (previous.length === 0) return history;

  const prevById = new Map<string, ChatJobCard[]>();
  for (const message of previous) {
    if (message.role !== 'assistant' || !message.cards?.length) continue;
    prevById.set(message.id, message.cards);
    if (message.serverMessageId) {
      prevById.set(message.serverMessageId, message.cards);
    }
  }

  const prevAssistants = previous.filter((message) => message.role === 'assistant');
  let ordinal = 0;

  return history.map((message) => {
    if (message.role !== 'assistant') return message;
    const index = ordinal;
    ordinal += 1;
    if (message.cards && message.cards.length > 0) return message;

    const byId =
      prevById.get(message.id) ??
      (message.serverMessageId ? prevById.get(message.serverMessageId) : undefined);
    if (byId && byId.length > 0) {
      return { ...message, cards: byId };
    }

    const prev = prevAssistants[index];
    if (
      prev?.cards &&
      prev.cards.length > 0 &&
      contentPrefix(prev.content) === contentPrefix(message.content)
    ) {
      return { ...message, cards: prev.cards };
    }

    return message;
  });
}

/**
 * Rehydrate Space messages: enrich history with in-memory cards, then sessionStorage.
 * History remains the message list SSOT (no resurrecting deleted local turns).
 */
export function rehydrateSpaceMessagesWithCards(
  spaceId: string,
  masterSessionId: string | null,
  history: SpaceChatMessage[],
  previous: SpaceChatMessage[]
): SpaceChatMessage[] {
  const fromPrevious = enrichHistoryWithPreviousCards(history, previous);
  const withCache = applyCachedSpaceJobCards(
    spaceId,
    masterSessionId,
    fromPrevious
  );
  rememberSpaceJobCards(spaceId, masterSessionId, withCache);
  return withCache;
}
