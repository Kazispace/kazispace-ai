/**
 * Parse HTTP `Retry-After` (RFC 9110): delay-seconds or HTTP-date.
 * Returns whole seconds until retry, or undefined if missing/invalid/past.
 *
 * BE (KAZI-185) currently sends delay-seconds (default 30); HTTP-date is supported for RFC compliance.
 */
export function parseRetryAfterSeconds(header: string | null | undefined): number | undefined {
  if (!header?.trim()) return undefined;
  const trimmed = header.trim();

  if (/^\d+$/.test(trimmed)) {
    const seconds = Number.parseInt(trimmed, 10);
    return seconds > 0 ? seconds : undefined;
  }

  const dateMs = Date.parse(trimmed);
  if (Number.isNaN(dateMs)) return undefined;
  const seconds = Math.ceil((dateMs - Date.now()) / 1000);
  return seconds > 0 ? seconds : undefined;
}
