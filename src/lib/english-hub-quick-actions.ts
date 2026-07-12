export type EnglishHubQuickAction = 'assessment' | 'training' | 'passport';

export const ENGLISH_HUB_QUICK_ACTION_KEYS: EnglishHubQuickAction[] = [
  'assessment',
  'training',
  'passport',
];

export function englishHubQuickActionHref(
  locale: string,
  action: EnglishHubQuickAction
): string {
  const base = `/${locale}/english`;
  switch (action) {
    case 'assessment':
      return `${base}/assessment`;
    case 'training':
      return `${base}/training?scenario=${encodeURIComponent(
        'workplace_oral_interview_intro_v1'
      )}`;
    case 'passport':
      return `${base}/passport`;
    default:
      return base;
  }
}

/** Map a chip label (localized) back to a hub quick action, if known. */
export function matchEnglishHubQuickAction(
  text: string,
  labels: Record<EnglishHubQuickAction, string>
): EnglishHubQuickAction | null {
  const trimmed = text.trim();
  for (const key of ENGLISH_HUB_QUICK_ACTION_KEYS) {
    if (labels[key] === trimmed) return key;
  }
  return null;
}
