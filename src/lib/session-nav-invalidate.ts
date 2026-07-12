export const SESSION_NAV_INVALIDATE_EVENT = 'kazi-session-nav-invalidate';

export function publishSessionNavInvalidate(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SESSION_NAV_INVALIDATE_EVENT));
}
