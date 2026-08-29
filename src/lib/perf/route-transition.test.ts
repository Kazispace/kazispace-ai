import { describe, expect, it } from 'vitest';

import { ROUTE_TRANSITION_BUDGET_MS } from '@/lib/perf/budgets';
import { resolveRouteTransitionRumEvent } from '@/lib/perf/route-transition';

describe('resolveRouteTransitionRumEvent', () => {
  it('returns null when there is no nav-intent mark', () => {
    // This is the KAZI-567 follow-up fix: without a tracked click/popstate,
    // `now - lastCommit` would just be however long the user sat reading
    // the previous page — not a navigation duration. Better to report
    // nothing than a meaningless number.
    expect(
      resolveRouteTransitionRumEvent({
        lastPath: '/en/spaces/a',
        pathname: '/en/spaces/b',
        intentAt: null,
        now: 999_999,
        session: 's1',
      })
    ).toBeNull();
  });

  it('returns null on first mount (no lastPath yet)', () => {
    expect(
      resolveRouteTransitionRumEvent({
        lastPath: null,
        pathname: '/en/chat',
        intentAt: 0,
        now: 100,
        session: 's1',
      })
    ).toBeNull();
  });

  it('returns null when the path did not actually change', () => {
    expect(
      resolveRouteTransitionRumEvent({
        lastPath: '/en/spaces/a',
        pathname: '/en/spaces/a',
        intentAt: 0,
        now: 100,
        session: 's1',
      })
    ).toBeNull();
  });

  it('measures from nav-intent time, not from the previous commit', () => {
    const event = resolveRouteTransitionRumEvent({
      lastPath: '/en/spaces/a',
      pathname: '/en/spaces/b',
      intentAt: 1_000,
      now: 1_300,
      session: 's1',
    });
    expect(event).toEqual({
      name: 'route-transition',
      value: 300,
      rating: 'good',
      id: 'rt_/en/spaces/a_/en/spaces/b',
      route: '/en/spaces/b',
      navigationType: 'navigate',
      session: 's1',
    });
  });

  it('rates good/needs-improvement/poor against the named budget', () => {
    const rate = (value: number) =>
      resolveRouteTransitionRumEvent({
        lastPath: '/a',
        pathname: '/b',
        intentAt: 0,
        now: value,
        session: 's1',
      })?.rating;

    expect(rate(ROUTE_TRANSITION_BUDGET_MS)).toBe('good');
    expect(rate(ROUTE_TRANSITION_BUDGET_MS + 1)).toBe('needs-improvement');
    expect(rate(ROUTE_TRANSITION_BUDGET_MS * 2)).toBe('needs-improvement');
    expect(rate(ROUTE_TRANSITION_BUDGET_MS * 2 + 1)).toBe('poor');
  });

  it('clamps a negative delta (clock skew) to 0 instead of a negative duration', () => {
    const event = resolveRouteTransitionRumEvent({
      lastPath: '/a',
      pathname: '/b',
      intentAt: 500,
      now: 400,
      session: 's1',
    });
    expect(event?.value).toBe(0);
  });

  it('falls back to route "/" when pathname is empty', () => {
    const event = resolveRouteTransitionRumEvent({
      lastPath: '/a',
      pathname: '',
      intentAt: 0,
      now: 10,
      session: 's1',
    });
    expect(event?.route).toBe('/');
  });
});
