import type { RumEvent, RumMetricName, RumRating } from '@/lib/perf/budgets';
import { RUM_METRIC_NAMES } from '@/lib/perf/budgets';

const RUM_PATH = '/api/rum';
const MAX_BODY = 2048;

export function isRumMetricName(name: string): name is RumMetricName {
  return (RUM_METRIC_NAMES as readonly string[]).includes(name);
}

export function sanitizeRumEvent(raw: unknown): RumEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (!isRumMetricName(String(row.name ?? ''))) return null;
  const value = Number(row.value);
  if (!Number.isFinite(value) || value < 0 || value > 600_000) return null;
  const rating = row.rating;
  if (
    rating !== 'good' &&
    rating !== 'needs-improvement' &&
    rating !== 'poor'
  ) {
    return null;
  }
  const id = typeof row.id === 'string' ? row.id.slice(0, 64) : '';
  const route = typeof row.route === 'string' ? row.route.slice(0, 256) : '';
  if (!id || !route.startsWith('/')) return null;
  const event: RumEvent = {
    name: row.name as RumMetricName,
    value,
    rating: rating as RumRating,
    id,
    route,
  };
  if (typeof row.navigationType === 'string') {
    event.navigationType = row.navigationType.slice(0, 32);
  }
  if (typeof row.session === 'string') {
    event.session = row.session.slice(0, 64);
  }
  return event;
}

export function postRumEvent(event: RumEvent): void {
  if (typeof window === 'undefined') return;
  const body = JSON.stringify(event);
  if (body.length > MAX_BODY) return;
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(RUM_PATH, blob);
      return;
    }
  } catch {
    // fall through
  }
  void fetch(RUM_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => undefined);
}
