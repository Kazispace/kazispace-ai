export const AUTH_SESSION_CLEARED_EVENT = 'kazi:auth-session-cleared';

export function publishAuthSessionCleared(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_CLEARED_EVENT));
}
