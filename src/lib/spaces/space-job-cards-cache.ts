/**
 * Persist Space job cards across remount / history rehydrate.
 * GET …/messages often returns text only; cards live on turn `assistant_response`
 * (and BE session snapshot) but are omitted from history rows.
 */

import type { ChatJobCard } from '@/types/chat-envelope';
import {
  mergeSpaceMessagesAfterSend,
  type SpaceChatMessage,
} from '@/lib/spaces/turn';

const STORAGE_PREFIX = 'ks.space.jobCards.v1.';

type SpaceJobCardsCache = {
  /** Parallel to assistant turns in the space thread (null = no cards for that turn). */
  byOrdinal: (ChatJobCard[] | null)[];
  /** Prefer when history exposes persisted message ids. */
  byMessageId: Record<string, ChatJobCard[]>;
};

function storageKey(spaceId: string): string {
  return `${STORAGE_PREFIX}${spaceId}`;
}

function emptyCache(): SpaceJobCardsCache {
  return { byOrdinal: [], byMessageId: {} };
}

function getSessionStorage(): Storage | null {
  if (typeof globalThis === 'undefined') return null;
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export function loadSpaceJobCardsCache(spaceId: string): SpaceJobCardsCache {
  const storage = getSessionStorage();
  if (!storage) return emptyCache();
  try {
    const raw = storage.getItem(storageKey(spaceId));
    if (!raw) return emptyCache();
    const parsed = JSON.parse(raw) as Partial<SpaceJobCardsCache>;
    return {
      byOrdinal: Array.isArray(parsed.byOrdinal) ? parsed.byOrdinal : [],
      byMessageId:
        parsed.byMessageId && typeof parsed.byMessageId === 'object'
          ? parsed.byMessageId
          : {},
    };
  } catch {
    return emptyCache();
  }
}

function saveSpaceJobCardsCache(spaceId: string, cache: SpaceJobCardsCache): void {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    storage.setItem(storageKey(spaceId), JSON.stringify(cache));
  } catch {
    // Quota / private mode — cards still work until remount.
  }
}

/** Snapshot assistant cards from the current thread into sessionStorage. */
export function rememberSpaceJobCards(
  spaceId: string,
  messages: SpaceChatMessage[]
): void {
  const prev = loadSpaceJobCardsCache(spaceId);
  const byOrdinal: (ChatJobCard[] | null)[] = [];
  const byMessageId = { ...prev.byMessageId };

  let ordinal = 0;
  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    const cards =
      message.cards && message.cards.length > 0 ? message.cards : null;
    const prior = prev.byOrdinal[ordinal] ?? null;
    const nextCards = cards ?? prior;
    byOrdinal.push(nextCards);
    if (nextCards && nextCards.length > 0) {
      byMessageId[message.id] = nextCards;
      if (message.serverMessageId) {
        byMessageId[message.serverMessageId] = nextCards;
      }
    }
    ordinal += 1;
  }

  saveSpaceJobCardsCache(spaceId, { byOrdinal, byMessageId });
}

/** Attach cached cards onto history rows that only have text. */
export function applyCachedSpaceJobCards(
  spaceId: string,
  messages: SpaceChatMessage[]
): SpaceChatMessage[] {
  const cache = loadSpaceJobCardsCache(spaceId);
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
    if (byOrd && byOrd.length > 0) {
      return { ...message, cards: byOrd };
    }

    return message;
  });
}

/**
 * Rehydrate Space messages: keep in-memory cards, then sessionStorage cache.
 * History API typically drops cards.
 */
export function rehydrateSpaceMessagesWithCards(
  spaceId: string,
  history: SpaceChatMessage[],
  previous: SpaceChatMessage[]
): SpaceChatMessage[] {
  const merged = mergeSpaceMessagesAfterSend(previous, history);
  const withCache = applyCachedSpaceJobCards(spaceId, merged);
  rememberSpaceJobCards(spaceId, withCache);
  return withCache;
}
