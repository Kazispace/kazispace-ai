import { deactivateToClinic } from '@/lib/deactivate-to-clinic';
import { useAgentStore } from '@/lib/store';

const hubExitInFlight = new Set<string>();

/**
 * User leaves a dedicated hub (/cv, /interview, /english) for Clinic.
 * Sync-clears local store for immediate UI; server deactivate runs in background.
 * Dedupes rapid clicks; never blocks navigation or surfaces errors.
 */
export function leaveDedicatedHubForClinic(
  locale: string,
  hubAgentId: string
): void {
  if (hubExitInFlight.has(hubAgentId)) return;
  hubExitInFlight.add(hubAgentId);

  // Sync clear — UI responds before async deactivate; deactivateToClinic also clears (idempotent).
  useAgentStore.getState().setActiveAgent(null, null);
  void deactivateToClinic(locale, { agentId: hubAgentId, bestEffort: true }).finally(
    () => hubExitInFlight.delete(hubAgentId)
  );
}
