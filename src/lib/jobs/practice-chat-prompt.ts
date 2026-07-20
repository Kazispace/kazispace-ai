'use client';

/**
 * Build a Space/Clinic chat prompt that starts mock-interview practice for a job
 * without navigating to the dedicated `/interview` hub (keeps depth ≤ 3).
 */
export function buildJobPracticeChatPrompt(input: {
  jobId: string;
  jobTitle?: string | null;
}): string {
  const title = input.jobTitle?.trim();
  if (title) {
    return `Please run a mock interview practice for the role 「${title}」(job_id: ${input.jobId}). Stay in this chat — ask prep questions here and start when I'm ready.`;
  }
  return `Please run a mock interview practice for job_id ${input.jobId}. Stay in this chat — ask prep questions here and start when I'm ready.`;
}
