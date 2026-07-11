import { deactivateToClinic } from '@/lib/deactivate-to-clinic';
import { useAgentStore } from '@/lib/store';

/**
 * User leaves a dedicated hub (/cv, /interview, /english) for Clinic.
 * Clears local agent pointer immediately; server deactivate runs in background.
 * Never blocks navigation and never surfaces errors to the user.
 */
export function leaveDedicatedHubForClinic(
  locale: string,
  hubAgentId: string
): void {
  useAgentStore.getState().setActiveAgent(null, null);
  void deactivateToClinic(locale, { agentId: hubAgentId, bestEffort: true });
}
