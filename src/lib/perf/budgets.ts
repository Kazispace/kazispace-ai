/**
 * KAZI-567 — named FE performance budgets (RUM + CI).
 * JS byte caps come from clinic-js-budget.json (shared with the build script).
 */

import clinicJsBudget from './clinic-js-budget.json';

/** Public Clinic first-load JS (decoded bytes of first-party chunks). */
export const PUBLIC_CLINIC_FIRST_JS_DECODED_BYTES =
  clinicJsBudget.public_clinic_first_js_decoded_bytes;

/** Soft transfer hint — not a CI gate (`transfer_hint_is_gate: false`). */
export const PUBLIC_CLINIC_FIRST_JS_TRANSFER_HINT_BYTES =
  clinicJsBudget.public_clinic_first_js_transfer_hint_bytes;

export const CLINIC_JS_BUDGET_UNIT = clinicJsBudget.unit;

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
