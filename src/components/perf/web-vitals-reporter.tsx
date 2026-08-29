'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';

import type { RumEvent, RumRating } from '@/lib/perf/budgets';
import { consumeNavIntent, markNavIntent } from '@/lib/perf/nav-intent';
import { postRumEvent } from '@/lib/perf/rum';
import { resolveRouteTransitionRumEvent } from '@/lib/perf/route-transition';
import { resolveRumClientPolicy, shouldSampleRum } from '@/lib/region/rum-policy';

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
 * Observers start only when Region Profile rum.enabled is on.
 * First-party beacon only — does not replace Langfuse LLM traces.
 */
export function WebVitalsReporter() {
  const pathname = usePathname();
  const sessionRef = useRef<string>('rum_anon');
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    const policy = resolveRumClientPolicy();
    if (!policy.enabled || !shouldSampleRum(policy.sample_rate)) return;
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
    // Back/forward is not a tracked click (navigateToSessionNavTarget) — mark
    // intent here too so its transition duration is still measured.
    const onPopState = () => markNavIntent();
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
    // Register once — web-vitals observers must not stack on client navigations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const policy = resolveRumClientPolicy();
    if (!policy.enabled || !shouldSampleRum(policy.sample_rate)) {
      lastPath.current = pathname;
      return;
    }
    const event = resolveRouteTransitionRumEvent({
      lastPath: lastPath.current,
      pathname,
      intentAt: consumeNavIntent(),
      now: performance.now(),
      session: sessionRef.current,
    });
    if (event) postRumEvent(event);
    lastPath.current = pathname;
  }, [pathname]);

  return null;
}
