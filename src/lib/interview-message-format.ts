import type { InterviewJobContext, InterviewPrepCard } from '@/types';

type PrepFormatLabels = {
  prepTitle: string;
  prepFocusAreas: string;
  prepSampleQuestions: string;
  prepDuration: (values: { min: number }) => string;
  prepPrompt: string;
};

export function formatPrepMessage(
  prep: InterviewPrepCard | null | undefined,
  jobContext: InterviewJobContext | null | undefined,
  labels: PrepFormatLabels
): string {
  const lines: string[] = [labels.prepTitle];

  if (jobContext) {
    lines.push('', `**${jobContext.title}** · ${jobContext.company}`);
  }

  if (prep?.estimated_duration_min != null) {
    lines.push('', labels.prepDuration({ min: prep.estimated_duration_min }));
  }

  if (prep?.focus_areas?.length) {
    lines.push('', `**${labels.prepFocusAreas}**`);
    for (const area of prep.focus_areas) {
      lines.push(`- ${area}`);
    }
  }

  if (prep?.sample_questions?.length) {
    lines.push('', `**${labels.prepSampleQuestions}**`);
    prep.sample_questions.forEach((q, i) => {
      lines.push(`${i + 1}. ${q}`);
    });
  }

  lines.push('', labels.prepPrompt);
  return lines.join('\n');
}
