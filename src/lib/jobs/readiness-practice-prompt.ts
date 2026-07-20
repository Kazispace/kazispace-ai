/**
 * FE-built Space/Clinic prompt for "Practice for this job" from readiness gaps.
 * Stays in the current chat — does not open the dedicated Mock Interview hub.
 */
export function buildReadinessPracticePrompt(
  t: {
    (
      key: 'chatPromptWithGaps',
      values: { title: string; weaknesses: string }
    ): string;
    (key: 'chatPrompt', values: { title: string }): string;
    (
      key: 'chatPromptNoTitleWithGaps',
      values: { weaknesses: string }
    ): string;
    (key: 'chatPromptNoTitle'): string;
    (key: 'weaknessSeparator'): string;
  },
  input: {
    jobTitle?: string | null;
    weaknessLabels: string[];
  }
): string {
  const title = input.jobTitle?.trim() || null;
  const weaknesses = input.weaknessLabels
    .map((label) => label.trim())
    .filter(Boolean);
  const weaknessList = weaknesses.join(t('weaknessSeparator'));

  if (title && weaknessList) {
    return t('chatPromptWithGaps', { title, weaknesses: weaknessList });
  }
  if (title) {
    return t('chatPrompt', { title });
  }
  if (weaknessList) {
    return t('chatPromptNoTitleWithGaps', { weaknesses: weaknessList });
  }
  return t('chatPromptNoTitle');
}
