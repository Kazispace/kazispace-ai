/**
 * Connectivity helpers for D16 (kazispace-ui decisions): messages typed
 * offline are queued and sent in order when the connection returns.
 */

/** True only when the browser reports it is offline. Unknown counts as online. */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/** Seconds left until `retryAt` (epoch ms), rounded up; 0 once it has passed. */
export function secondsUntil(retryAt: number | undefined, now = Date.now()): number {
  if (!retryAt) return 0;
  return Math.max(0, Math.ceil((retryAt - now) / 1000));
}

/** Epoch ms when a busy retry may start, or undefined when there is no wait. */
export function retryAtFrom(retryAfterSeconds: number | undefined, now = Date.now()) {
  return retryAfterSeconds && retryAfterSeconds > 0
    ? now + retryAfterSeconds * 1000
    : undefined;
}
