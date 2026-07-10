import type { ActiveAgentState } from '@/types';

export {
  getAgentHubPath,
  getDedicatedHubAgentFromPathname,
  isDedicatedHubAgent,
  resolveSurfaceForAgent,
  resolveSurfaceFromPathname,
} from '@/lib/agent-transition/surfaces';

export type { AgentSurfaceId } from '@/lib/agent-transition/types';

export function hasStickyActiveAgent(
  state: ActiveAgentState | null | undefined
): state is ActiveAgentState & { active_agent: string; session_id: string } {
  return Boolean(state?.active_agent && state?.session_id);
}
