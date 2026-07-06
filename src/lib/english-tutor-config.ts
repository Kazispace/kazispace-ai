export const ENGLISH_TUTOR_AGENT_ID = 'english_tutor';

export function isEnglishTutorAgent(agentId: string | null | undefined): boolean {
  return agentId === ENGLISH_TUTOR_AGENT_ID;
}
