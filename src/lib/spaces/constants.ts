/** ADR-006 system Clinic space public id (API + URL). */
export const CLINIC_SPACE_ID = '__clinic__';

export const MVP_SPACE_TEMPLATE_IDS = [
  'blank_conversation',
  'job_sprint',
  'ielts_prep',
] as const;

export type MvpSpaceTemplateId = (typeof MVP_SPACE_TEMPLATE_IDS)[number];

export function isSupportedSpaceTemplate(templateId: string): templateId is MvpSpaceTemplateId {
  return (MVP_SPACE_TEMPLATE_IDS as readonly string[]).includes(templateId);
}

export function isSpacesEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SPACES_ENABLED === 'true';
}

export const TEMPLATE_EMOJI: Record<string, string> = {
  clinic_default: '💬',
  blank_conversation: '💬',
  job_sprint: '🎯',
  ielts_prep: '📘',
};
