import type { SpaceTemplateItem } from '@/types/spaces';

export const TEMPLATE_I18N_KEYS: Record<string, { title: string; desc: string }> = {
  blank_conversation: { title: 'templateBlank', desc: 'templateBlankDesc' },
  job_sprint: { title: 'templateJobSprint', desc: 'templateJobSprintDesc' },
  ielts_prep: { title: 'templateIelts', desc: 'templateIeltsDesc' },
};

type TranslateFn = (key: string) => string;

/**
 * Prefer API display_name for the title when present, but keep local MVP
 * descriptions so picker rows don't lose subtitle copy.
 */
export function resolveTemplateLabel(
  template: SpaceTemplateItem,
  locale: string,
  t: TranslateFn
): { title: string; desc: string } {
  const keys = TEMPLATE_I18N_KEYS[template.template_id];
  const localDesc = keys ? t(keys.desc) : '';
  const localTitle = keys ? t(keys.title) : template.template_id;

  const display = template.display_name;
  if (display && typeof display === 'object') {
    const title =
      display[locale] ?? display.zh ?? display.en ?? localTitle;
    return { title, desc: localDesc };
  }
  if (typeof display === 'string' && display.trim() && display !== template.template_id) {
    return { title: display, desc: localDesc };
  }

  return { title: localTitle, desc: localDesc };
}
