import { useAgentStore } from '@/lib/store';

/**
 * User leaves a dedicated hub (/cv, /interview, /english) for Clinic (ADR-005 INV-6).
 * Navigate-only: clear local UI focus so Clinic cold-opens; server session stays active.
 */
export function leaveDedicatedHubForClinic(
  _locale: string,
  _hubAgentId: string
): void {
  useAgentStore.getState().setActiveAgent(null, null);
}
