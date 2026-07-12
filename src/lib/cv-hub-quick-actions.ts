export type CvHubQuickAction = 'upload' | 'experience' | 'tailor';

export const CV_HUB_QUICK_ACTION_KEYS: CvHubQuickAction[] = [
  'upload',
  'experience',
  'tailor',
];

export type CvHubQuickActionLabels = Record<CvHubQuickAction, string>;

/** Map a chip label (localized) back to a CV hub quick action, if known. */
export function matchCvHubQuickAction(
  text: string,
  labels: CvHubQuickActionLabels
): CvHubQuickAction | null {
  const trimmed = text.trim();
  for (const key of CV_HUB_QUICK_ACTION_KEYS) {
    if (labels[key] === trimmed) return key;
  }
  return null;
}

/** Prompt text sent to the agent for experience / tailor chips. */
export function cvHubQuickActionPrompt(
  action: Exclude<CvHubQuickAction, 'upload'>,
  getText: (key: 'welcomePromptExperienceText' | 'welcomePromptTailorText') => string
): string {
  switch (action) {
    case 'experience':
      return getText('welcomePromptExperienceText');
    case 'tailor':
      return getText('welcomePromptTailorText');
    default:
      return '';
  }
}
