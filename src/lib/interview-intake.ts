/** i18n keys under `interview.intakeSuggestions.*` — display-only hints, submitted verbatim to BE. */
export const INTAKE_SUGGESTION_KEYS = [
  'itSupport',
  'dataAnalyst',
  'sales',
] as const;

export type IntakeSuggestionKey = (typeof INTAKE_SUGGESTION_KEYS)[number];
