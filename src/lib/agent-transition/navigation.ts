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

/** True when the browser is not yet on the plan's target path (client-only). */
export function isNavigationPending(plan: NavigationPlan): boolean {
  if (!plan.shouldNavigate || !plan.href) return false;
  if (typeof window === 'undefined') return false;
  const targetPath = plan.href.split('?')[0];
  if (window.location.pathname !== targetPath) return true;
  const current = `${window.location.pathname}${window.location.search}`;
  return current !== plan.href;
}
