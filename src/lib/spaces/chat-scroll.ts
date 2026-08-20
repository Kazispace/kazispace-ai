const STORAGE_PREFIX = 'kazi:chat-scroll:';

/** Distance from bottom (px) treated as "viewing latest". */
export const CHAT_NEAR_BOTTOM_PX = 80;

/** @deprecated Prefer chatScrollStorageKey — kept for existing Space keys. */
export function spaceChatScrollStorageKey(spaceId: string): string {
  return `kazi:space-chat-scroll:${spaceId}`;
}

export function chatScrollStorageKey(scope: string): string {
  return `${STORAGE_PREFIX}${scope}`;
}

export function clinicChatScrollStorageKey(scope: string): string {
  return chatScrollStorageKey(`clinic:${scope}`);
}

export function readChatScrollTop(storageKey: string): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

export function writeChatScrollTop(storageKey: string, scrollTop: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      storageKey,
      String(Math.max(0, Math.round(scrollTop))),
    );
  } catch {
    // private mode / quota — ignore
  }
}

/** @deprecated Use readChatScrollTop(spaceChatScrollStorageKey(id)) */
export function readSpaceChatScrollTop(spaceId: string): number | null {
  return readChatScrollTop(spaceChatScrollStorageKey(spaceId));
}

/** @deprecated Use writeChatScrollTop(spaceChatScrollStorageKey(id), top) */
export function writeSpaceChatScrollTop(spaceId: string, scrollTop: number): void {
  writeChatScrollTop(spaceChatScrollStorageKey(spaceId), scrollTop);
}

export function isNearBottom(
  el: Pick<HTMLElement, 'scrollTop' | 'scrollHeight' | 'clientHeight'>,
  thresholdPx: number = CHAT_NEAR_BOTTOM_PX,
): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= thresholdPx;
}

export function scrollElementToBottom(
  el: HTMLElement,
  behavior: ScrollBehavior = 'smooth',
): void {
  el.scrollTo({ top: el.scrollHeight, behavior });
}

/**
 * Pin the chat parent to the latest message after Virtuoso reports height.
 * Pixel scrollTop from the static list is not comparable to virtual height
 * (KAZI-588) — that left users on early stubs.
 */
export function pinChatScrollToLatest(
  el: Pick<HTMLElement, 'scrollHeight' | 'clientHeight' | 'scrollTop'>
): boolean {
  if (el.scrollHeight <= el.clientHeight) return false;
  el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
  return true;
}

/** Clamp a saved scrollTop into the element's current scroll range. */
export function clampScrollTop(el: HTMLElement, saved: number): number {
  const max = Math.max(0, el.scrollHeight - el.clientHeight);
  return Math.min(Math.max(0, saved), max);
}
