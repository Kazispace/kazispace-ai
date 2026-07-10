export type AgentSurfaceId = 'clinic' | 'cv' | 'interview' | 'english';

export interface NavigationPlan {
  shouldNavigate: boolean;
  href: string | null;
  targetSurface: AgentSurfaceId;
}

/** React hook context: current UI surface + cross-surface navigator (always replace). */
export interface AgentSwitchContext {
  fromSurface: AgentSurfaceId;
  navigate: (href: string) => void;
}
