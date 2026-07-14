import { SUPPORTED_LOCALES } from '@/lib/constants';
import { TEMPLATE_I18N_KEYS } from '@/lib/spaces/constants';
import type { SpaceTemplateItem } from '@/types/spaces';

type TranslateFn = (key: string) => string;

/**
 * Resolve title/desc for a template picker row.
 *
 * Contract with BE / client fallback:
 * - Missing / empty / `display_name === template_id` → treat as unset and use local i18n.
 *   (`useSpaceTemplates` fallback intentionally seeds `display_name: template_id`.)
 * - Object map or a distinct string → prefer API title, keep local MVP desc when available.
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
    const title = resolveLocalizedDisplayName(display, locale) ?? localTitle;
    return { title, desc: localDesc };
  }

  // Placeholder seed (`display_name === template_id`) → local i18n, not the raw id.
  if (
    typeof display === 'string' &&
    display.trim() &&
    display !== template.template_id
  ) {
    return { title: display, desc: localDesc };
  }

  return { title: localTitle, desc: localDesc };
}

function resolveLocalizedDisplayName(
  display: Record<string, string>,
  locale: string
): string | undefined {
  if (display[locale]?.trim()) return display[locale];
  // Prefer English over Chinese for unknown locales (ru/kk/uz), then any supported key.
  if (display.en?.trim()) return display.en;
  for (const code of SUPPORTED_LOCALES) {
    if (code === locale || code === 'en') continue;
    if (display[code]?.trim()) return display[code];
  }
  const first = Object.values(display).find((value) => value?.trim());
  return first?.trim() || undefined;
}
