/**
 * KAZI-567 follow-up: the `route-transition` RUM metric previously measured
 * wall-clock time between one route committing and the next — which is
 * dominated by however long the user sat reading the previous page, not by
 * how slow the navigation itself was. That made it useless for exactly the
 * thing it was meant to catch (e.g. Space-switch latency).
 *
 * Call `markNavIntent()` at the moment a client-side navigation is actually
 * triggered (a nav-row click, a `popstate`); `consumeNavIntent()` reads and
 * clears it so `WebVitalsReporter` can measure real click-to-paint duration.
 */
let pendingNavIntentAt: number | null = null;

export function markNavIntent(): void {
  pendingNavIntentAt = typeof performance !== 'undefined' ? performance.now() : null;
}

/** Reads and clears the pending mark; null if no intent was recorded (e.g. first load). */
export function consumeNavIntent(): number | null {
  const at = pendingNavIntentAt;
  pendingNavIntentAt = null;
  return at;
}
