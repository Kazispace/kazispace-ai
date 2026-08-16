/**
 * KAZI-567 — named FE performance budgets (RUM + CI).
 * Cite these from tests and the clinic JS budget script.
 */

/** Public Clinic first-load JS (decoded bytes of first-party chunks). */
export const PUBLIC_CLINIC_FIRST_JS_DECODED_BYTES = 1_200_000;

/** Soft transfer target from the 2026-08-16 audit (~398KB). */
export const PUBLIC_CLINIC_FIRST_JS_TRANSFER_HINT_BYTES = 450_000;

/** Route transition mark — log if client navigation exceeds this. */
export const ROUTE_TRANSITION_BUDGET_MS = 1_500;

export const RUM_METRIC_NAMES = [
  'LCP',
  'INP',
  'CLS',
  'TTFB',
  'FCP',
  'route-transition',
] as const;

export type RumMetricName = (typeof RUM_METRIC_NAMES)[number];

export type RumRating = 'good' | 'needs-improvement' | 'poor';

export type RumEvent = {
  name: RumMetricName;
  value: number;
  rating: RumRating;
  id: string;
  route: string;
  navigationType?: string;
  /** Client session id (device-local, not account). */
  session?: string;
};
