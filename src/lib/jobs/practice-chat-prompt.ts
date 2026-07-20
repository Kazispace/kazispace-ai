/**
 * Build a Space/Clinic chat prompt that starts mock-interview practice for a job
 * without navigating to the dedicated `/interview` hub (keeps depth ≤ 3).
 *
 * Callers pass a `jobs` namespace translator so the prompt matches the UI locale
 * (and still includes phrases the Clinic hub-routing regex recognizes).
 */
export function buildJobPracticeChatPrompt(
  t: {
    (
      key: 'practiceChatPromptWithTitle',
      values: { title: string; jobId: string }
    ): string;
    (key: 'practiceChatPrompt', values: { jobId: string }): string;
  },
  input: {
    jobId: string;
    jobTitle?: string | null;
  }
): string {
  const title = input.jobTitle?.trim();
  if (title) {
    return t('practiceChatPromptWithTitle', { title, jobId: input.jobId });
  }
  return t('practiceChatPrompt', { jobId: input.jobId });
}
