'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';

import {
  ROUTE_TRANSITION_BUDGET_MS,
  type RumEvent,
  type RumRating,
} from '@/lib/perf/budgets';
import { postRumEvent } from '@/lib/perf/rum';

function rumSessionId(): string {
  const key = 'ks.rum.session.v1';
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const next = `rum_${Math.random().toString(36).slice(2, 12)}`;
    sessionStorage.setItem(key, next);
    return next;
  } catch {
    return 'rum_anon';
  }
}

function toEvent(metric: Metric, route: string, session: string): RumEvent {
  return {
    name: metric.name as RumEvent['name'],
    value: metric.value,
    rating: metric.rating as RumRating,
    id: metric.id,
    route,
    navigationType: metric.navigationType,
    session,
  };
}

/**
 * KAZI-567: LCP/INP/CLS/TTFB/FCP + client route-transition duration.
 * First-party beacon only — does not replace Langfuse LLM traces.
 */
export function WebVitalsReporter() {
  const pathname = usePathname();
  const sessionRef = useRef<string>('rum_anon');
  const navStartedAt = useRef<number>(
    typeof performance !== 'undefined' ? performance.now() : 0
  );
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    sessionRef.current = rumSessionId();
    lastPath.current = pathname || '/';
    const report = (metric: Metric) => {
      postRumEvent(
        toEvent(metric, lastPath.current || '/', sessionRef.current)
      );
    };
    onLCP(report);
    onINP(report);
    onCLS(report);
    onTTFB(report);
    onFCP(report);
    // Register once — web-vitals observers must not stack on client navigations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const now = performance.now();
    if (lastPath.current && lastPath.current !== pathname) {
      const value = now - navStartedAt.current;
      const rating =
        value <= ROUTE_TRANSITION_BUDGET_MS
          ? 'good'
          : value <= ROUTE_TRANSITION_BUDGET_MS * 2
            ? 'needs-improvement'
            : 'poor';
      postRumEvent({
        name: 'route-transition',
        value,
        rating,
        id: `rt_${lastPath.current}_${pathname}`,
        route: pathname || '/',
        navigationType: 'navigate',
        session: sessionRef.current,
      });
    }
    lastPath.current = pathname;
    navStartedAt.current = now;
  }, [pathname]);

  return null;
}
