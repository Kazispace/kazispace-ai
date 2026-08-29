import { ROUTE_TRANSITION_BUDGET_MS, type RumEvent, type RumRating } from '@/lib/perf/budgets';

function rateRouteTransition(value: number): RumRating {
  if (value <= ROUTE_TRANSITION_BUDGET_MS) return 'good';
  if (value <= ROUTE_TRANSITION_BUDGET_MS * 2) return 'needs-improvement';
  return 'poor';
}

/**
 * Builds the `route-transition` RUM event, or null when this transition
 * should not be reported. Pulled out of WebVitalsReporter so the decision
 * logic (and the KAZI-567 f/u fix below) is unit-testable without mounting
 * web-vitals observers in jsdom.
 *
 * Only measures transitions we have a nav-intent timestamp for (a tracked
 * nav-row click or `popstate`) — otherwise `value` would be dominated by
 * however long the user sat on the previous page before clicking, not by
 * how slow the navigation itself was.
 */
export function resolveRouteTransitionRumEvent(opts: {
  lastPath: string | null;
  pathname: string | null;
  intentAt: number | null;
  now: number;
  session: string;
}): RumEvent | null {
  const { lastPath, pathname, intentAt, now, session } = opts;
  if (!lastPath || lastPath === pathname || intentAt == null) return null;

  const value = Math.max(0, now - intentAt);
  return {
    name: 'route-transition',
    value,
    rating: rateRouteTransition(value),
    id: `rt_${lastPath}_${pathname}`,
    route: pathname || '/',
    navigationType: 'navigate',
    session,
  };
}
