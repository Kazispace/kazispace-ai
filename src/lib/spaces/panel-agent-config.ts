import type { AgentSurfaceId } from '@/lib/agent-transition/types';
import { CV_BUILDER_AGENT_ID } from '@/lib/cv-agent-config';
import { ENGLISH_TUTOR_AGENT_ID } from '@/lib/english-tutor-config';
import { MOCK_INTERVIEW_AGENT_ID } from '@/lib/mock-interview-config';
import type { SpacePanelSurface } from '@/types/spaces';

export interface SpacePanelAgentConfig {
  fromSurface: AgentSurfaceId;
  hubAgentId: string;
}

const PANEL_AGENT_CONFIG: Record<SpacePanelSurface, SpacePanelAgentConfig> = {
  cv_workspace: { fromSurface: 'cv', hubAgentId: CV_BUILDER_AGENT_ID },
  interview_irp: {
    fromSurface: 'interview',
    hubAgentId: MOCK_INTERVIEW_AGENT_ID,
  },
  english_epp: {
    fromSurface: 'english',
    hubAgentId: ENGLISH_TUTOR_AGENT_ID,
  },
};

export function resolveSpacePanelAgentConfig(
  surface: SpacePanelSurface
): SpacePanelAgentConfig {
  return PANEL_AGENT_CONFIG[surface];
}

export function getSpacePanelReturnHref(locale: string, spaceId: string): string {
  return `/${locale}/spaces/${encodeURIComponent(spaceId)}`;
}
