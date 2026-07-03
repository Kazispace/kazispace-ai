export const CV_BUILDER_AGENT_ID = 'cv_builder';

export function isCvBuilderAgent(agentId: string | null | undefined): boolean {
  return agentId === CV_BUILDER_AGENT_ID;
}
