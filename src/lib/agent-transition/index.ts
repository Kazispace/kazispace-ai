export type {
  AgentSurfaceId,
  AgentSwitchContext,
  NavigationPlan,
  TransitionTrigger,
} from '@/lib/agent-transition/types';

export {
  getAgentHubPath,
  getDedicatedHubAgentFromPathname,
  getSurfacePath,
  isDedicatedHubAgent,
  resolveSurfaceForAgent,
  resolveSurfaceFromPathname,
} from '@/lib/agent-transition/surfaces';

export { planNavigation } from '@/lib/agent-transition/navigation';
