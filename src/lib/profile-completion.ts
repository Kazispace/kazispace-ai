/** Backend `profile_completion.missing_minimum` keys we have i18n for. */
export const KNOWN_MISSING_MINIMUM_FIELDS = [
  'primary_country',
  'primary_locale',
  'career_goal',
  'target_role',
  'english_level',
  'weekly_hours_budget',
] as const;

export type KnownMissingMinimumField = (typeof KNOWN_MISSING_MINIMUM_FIELDS)[number];

export function isKnownMissingMinimumField(
  field: string
): field is KnownMissingMinimumField {
  return (KNOWN_MISSING_MINIMUM_FIELDS as readonly string[]).includes(field);
}

/** Human-readable fallback when i18n is missing for a new backend field. */
export function formatMissingFieldFallback(field: string): string {
  return field.replace(/_/g, ' ');
}
