import {
  getSurfacePath,
  resolveSurfaceForAgent,
} from '@/lib/agent-transition/surfaces';
import type { AgentSurfaceId, NavigationPlan } from '@/lib/agent-transition/types';

/**
 * SSOT navigation matrix for agent transitions (Web App SDD §18.8).
 * Cross-surface moves always use replace (caller passes router.replace).
 */
export function planNavigation(
  locale: string,
  fromSurface: AgentSurfaceId,
  targetAgentId: string | null
): NavigationPlan {
  if (targetAgentId === null) {
    const targetSurface: AgentSurfaceId = 'clinic';
    const href = getSurfacePath(locale, targetSurface);
    return {
      shouldNavigate: fromSurface !== targetSurface,
      href: fromSurface !== targetSurface ? href : null,
      targetSurface,
    };
  }

  const targetSurface = resolveSurfaceForAgent(targetAgentId);
  if (targetSurface === fromSurface) {
    return { shouldNavigate: false, href: null, targetSurface };
  }

  return {
    shouldNavigate: true,
    href: getSurfacePath(locale, targetSurface),
    targetSurface,
  };
}

const TRACKING_QUERY_KEYS = new Set(['gclid', 'fbclid']);

/** Strip UTM/ads params so incidental query noise does not block navigation. */
export function normalizeNavigationHref(href: string): string {
  const [pathname, rawQuery = ''] = href.split('?');
  const params = new URLSearchParams(rawQuery);
  for (const key of Array.from(params.keys())) {
    if (
      TRACKING_QUERY_KEYS.has(key) ||
      key.startsWith('utm_')
    ) {
      params.delete(key);
    }
  }
  const sorted = Array.from(params.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  const q = new URLSearchParams(sorted).toString();
  return `${pathname}${q ? `?${q}` : ''}`;
}

/** True when the browser is not yet on the plan's target path (client-only). */
export function isNavigationPending(plan: NavigationPlan): boolean {
  if (!plan.shouldNavigate || !plan.href) return false;
  if (typeof window === 'undefined') return false;
  const targetPath = plan.href.split('?')[0];
  if (window.location.pathname !== targetPath) return true;
  const current = normalizeNavigationHref(
    `${window.location.pathname}${window.location.search}`
  );
  return current !== normalizeNavigationHref(plan.href);
}
