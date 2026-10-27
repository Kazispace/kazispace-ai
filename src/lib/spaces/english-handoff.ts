/**
 * KAZI-1190 (Owen 2026-10-27: 「自动发出」) — when the clinic hands a message to the English
 * tutor, that same message is sent again as the first user turn in the English Space.
 *
 * One-shot, per tab: the clinic primes it right before navigating; the English Space consumes
 * it once (read = delete), so a reload, a second tab or a later visit never re-sends it.
 * ⛔ Not in the URL — a reload or a shared link would send it again.
 */
const ENGLISH_HANDOFF_KEY = 'kazi.englishSpace.handoff';
/** Long enough to cover resolving / creating the Space; short enough that a stale one dies. */
export const ENGLISH_HANDOFF_TTL_MS = 60_000;

type EnglishHandoff = { text: string; at: number };

export function primeEnglishHandoff(text: string, now: number = Date.now()): void {
  const trimmed = text.trim();
  if (!trimmed || typeof window === 'undefined') return;
  try {
    const payload: EnglishHandoff = { text: trimmed, at: now };
    sessionStorage.setItem(ENGLISH_HANDOFF_KEY, JSON.stringify(payload));
  } catch {
    /* storage unavailable: the Space simply opens without the message */
  }
}

/** Returns the pending message once, then forgets it. Expired or malformed ⇒ dropped, `null`. */
export function consumeEnglishHandoff(now: number = Date.now()): string | null {
  if (typeof window === 'undefined') return null;
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(ENGLISH_HANDOFF_KEY);
    if (raw == null) return null;
    sessionStorage.removeItem(ENGLISH_HANDOFF_KEY);
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<EnglishHandoff>;
    if (typeof parsed?.text !== 'string' || typeof parsed.at !== 'number') return null;
    if (now - parsed.at > ENGLISH_HANDOFF_TTL_MS || now < parsed.at) return null;
    return parsed.text.trim() || null;
  } catch {
    return null;
  }
}
