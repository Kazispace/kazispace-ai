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

/**
 * Space templates the product no longer supports (kazispace-ui D39, KAZI-1485; Owen 2026-11-27:
 * "简历求职类会Archive。 未来暂时不支持。 聚焦在英语学习。"). Their spaces count as archived whatever
 * their status on the server: they are left out of the space list's current view, out of the
 * choices for a new space, and never the latest space. Existing ones still open from a link.
 */
export const ARCHIVED_SPACE_TEMPLATE_IDS: readonly string[] = ['job_sprint'];

export function isArchivedSpaceTemplate(templateId: string | null | undefined): boolean {
  return Boolean(templateId) && ARCHIVED_SPACE_TEMPLATE_IDS.includes(templateId as string);
}

/**
 * A space name nobody chose (kazispace-ui D39): empty, the template's id, or a generated label of
 * a code and a time such as "ET-44 04:36:41" or "KAZI-1277 04:24:33". The list shows the space
 * type's own name instead. A name the user gave (rename) is anything else, and is kept.
 */
const GENERATED_SPACE_NAME = /^[A-Za-z][A-Za-z0-9]*-\d+\s+\d{1,2}:\d{2}(:\d{2})?$/;

export function isMeaninglessSpaceName(name: string | null | undefined, templateId: string): boolean {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return true;
  if (trimmed === templateId) return true;
  return GENERATED_SPACE_NAME.test(trimmed);
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

/** next-intl key pairs under `spaces.*` for MVP template picker labels. */
export const TEMPLATE_I18N_KEYS: Record<string, { title: string; desc: string }> = {
  blank_conversation: { title: 'templateBlank', desc: 'templateBlankDesc' },
  job_sprint: { title: 'templateJobSprint', desc: 'templateJobSprintDesc' },
  ielts_prep: { title: 'templateIelts', desc: 'templateIeltsDesc' },
};
