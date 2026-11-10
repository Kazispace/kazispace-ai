/**
 * Live Room recording rules (KAZI-1287; kazispace-ui live-room.md, Recording · Sending a recording).
 * Pure helpers, so the rules can be tested without a microphone.
 */
import { LEVEL_SAMPLE_MS } from '@/lib/radio/voice';
import type { LiveLimits } from '@/types/radio-live';

/** The time left is shown under the button during the last 10 seconds. */
export const LIVE_REMAINING_FROM_MS = 10_000;
/** A quiet moment long enough to cut at without splitting a word. */
export const LIVE_QUIET_MS = 300;
/** A `retry` notice shows above the microphone for 3 seconds. */
export const LIVE_NOTICE_MS = 3_000;

/**
 * The longest piece the app aims for: `chunk_max_ms` less two level checks. The cut is decided on a
 * 100 ms timer that runs late in a real browser, so a piece cut "at 20 s" could be reported as 20 001 ms,
 * which the server refuses (`422 invalid_request`, `duration_ms` 1..20000) and which ends the session.
 */
export function pieceMaxMs(limits: LiveLimits): number {
  return Math.max(LEVEL_SAMPLE_MS, limits.chunk_max_ms - 2 * LEVEL_SAMPLE_MS);
}

/** A piece's length as reported: never above `chunk_max_ms`, never below 1 ms. */
export function reportedPieceMs(ms: number, limits: LiveLimits): number {
  return Math.min(limits.chunk_max_ms, Math.max(1, Math.round(ms)));
}

/**
 * The earliest a piece may end, in ms into the recording (Where to cut): after piece `k` ends `e` ms in,
 * (`chunks_max` − `k`) × `chunk_max_ms` ≥ `record_max_ms` − `e` must hold, so the pieces left can still
 * hold the rest of the longest recording. Counted with `pieceMaxMs` (19.8 s), which is stricter: with 72 s,
 * 20 s and 4 pieces, 12.6 s, 32.4 s, 52.2 s (the spec's 12 / 32 / 52 s at the earliest).
 */
export function earliestCutMs(k: number, limits: LiveLimits): number {
  return Math.max(0, limits.record_max_ms - (limits.chunks_max - k) * pieceMaxMs(limits));
}

/**
 * Whether piece `k` (1-based) should end now, `elapsedMs` into the recording, the previous piece having
 * ended at `pieceStartMs`:
 * - at the latest `pieceMaxMs` after the piece began (no quiet moment fell inside the window);
 * - earlier, at a quiet moment, once the pieces left can hold the rest (`earliestCutMs`).
 * The last allowed piece is never cut: it ends at Done or at `record_max_ms`.
 */
export function shouldCutPiece({
  k,
  elapsedMs,
  pieceStartMs,
  quiet,
  limits,
}: {
  k: number;
  elapsedMs: number;
  pieceStartMs: number;
  quiet: boolean;
  limits: LiveLimits;
}): boolean {
  if (k >= limits.chunks_max) return false;
  if (elapsedMs - pieceStartMs >= pieceMaxMs(limits)) return true;
  return quiet && elapsedMs >= earliestCutMs(k, limits);
}

/** Seconds left to show under the button, or `null` before the last 10 seconds. */
export function secondsLeft(elapsedMs: number, limits: LiveLimits): number | null {
  const left = limits.record_max_ms - elapsedMs;
  if (left > LIVE_REMAINING_FROM_MS) return null;
  return Math.max(0, Math.ceil(left / 1000));
}

/** A `turn_id` for a new recording: `^[A-Za-z0-9_-]{8,40}$`. */
export function newLiveTurnId(): string {
  const raw =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `turn_${raw}`.slice(0, 40);
}

/** The key word's places in a line, case-insensitive, whole words only: `[before, word, after, …]`. */
export function splitKeyWord(text: string, keyWord: string | null | undefined): { text: string; key: boolean }[] {
  const word = (keyWord ?? '').trim();
  if (!word) return [{ text, key: false }];
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // No lookbehind: Safari before 16.4 cannot build one. The letter before the word is matched instead.
  const re = new RegExp(`(^|[^A-Za-z])(${escaped})(?![A-Za-z])`, 'gi');
  const out: { text: string; key: boolean }[] = [];
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const at = m.index + m[1].length;
    if (at > last) out.push({ text: text.slice(last, at), key: false });
    out.push({ text: m[2], key: true });
    last = at + m[2].length;
    re.lastIndex = last;
  }
  if (last < text.length) out.push({ text: text.slice(last), key: false });
  return out.length ? out : [{ text, key: false }];
}
