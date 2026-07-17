const STORAGE_PREFIX = 'kazi:space-chat-scroll:';

/** Distance from bottom (px) treated as "viewing latest". */
export const CHAT_NEAR_BOTTOM_PX = 80;

export function spaceChatScrollStorageKey(spaceId: string): string {
  return `${STORAGE_PREFIX}${spaceId}`;
}

export function readSpaceChatScrollTop(spaceId: string): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(spaceChatScrollStorageKey(spaceId));
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

export function writeSpaceChatScrollTop(spaceId: string, scrollTop: number): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      spaceChatScrollStorageKey(spaceId),
      String(Math.max(0, Math.round(scrollTop))),
    );
  } catch {
    // private mode / quota — ignore
  }
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
