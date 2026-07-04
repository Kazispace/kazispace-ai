export const MOCK_INTERVIEW_AGENT_ID = 'mock_interview';

export function isMockInterviewAgent(agentId: string | null | undefined): boolean {
  return agentId === MOCK_INTERVIEW_AGENT_ID;
}
