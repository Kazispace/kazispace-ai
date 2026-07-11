import type {
  InterviewFeedbackSummary,
  InterviewJobContext,
  InterviewPrepCard,
} from '@/types';

type InterviewFormatLabels = {
  prepTitle: string;
  prepFocusAreas: string;
  prepSampleQuestions: string;
  prepDuration: (values: { min: number }) => string;
  prepPrompt: string;
  feedbackTitle: (values: { role: string }) => string;
  feedbackTitleGeneric: string;
  overallSummary: string;
  strengths: string;
  improvements: string;
  weaknessTags: string;
  sampleAnswer: string;
  nextStep: string;
  scores: {
    clarity: string;
    relevance: string;
    confidence: string;
  };
};

function stars(value: number) {
  const n = Math.round(value);
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

export function formatPrepMessage(
  prep: InterviewPrepCard | null | undefined,
  jobContext: InterviewJobContext | null | undefined,
  labels: InterviewFormatLabels
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

export function formatFeedbackMessage(
  feedback: InterviewFeedbackSummary,
  targetRole: string | null | undefined,
  labels: InterviewFormatLabels
): string {
  const roleLabel = targetRole?.trim();
  const lines: string[] = [
    roleLabel ? labels.feedbackTitle({ role: roleLabel }) : labels.feedbackTitleGeneric,
  ];

  const scores = feedback.scores ?? {};
  const showScores = feedback.tier !== 'free';

  if (showScores) {
    const dimensions: Array<keyof NonNullable<InterviewFeedbackSummary['scores']>> = [
      'clarity',
      'relevance',
      'confidence',
    ];
    lines.push('');
    for (const key of dimensions) {
      const val = scores[key] ?? 0;
      const label = labels.scores[key];
      lines.push(`**${label}:** ${val}/5 ${stars(val)}`);
    }
  }

  if (feedback.overall_summary) {
    lines.push('', `**${labels.overallSummary}**`, feedback.overall_summary);
  }

  if (feedback.strengths?.length) {
    lines.push('', `**${labels.strengths}**`);
    for (const s of feedback.strengths) {
      lines.push(`- ${s}`);
    }
  }

  if (feedback.improvements?.length) {
    lines.push('', `**${labels.improvements}**`);
    for (const s of feedback.improvements) {
      lines.push(`- ${s}`);
    }
  }

  if (feedback.weakness_tags?.length) {
    lines.push('', `**${labels.weaknessTags}**`);
    for (const tag of feedback.weakness_tags) {
      lines.push(`- ${tag.label}`);
    }
  }

  if (feedback.sample_better_answer && feedback.tier !== 'free') {
    lines.push('', `**${labels.sampleAnswer}**`, `_${feedback.sample_better_answer}_`);
  }

  if (feedback.next_step) {
    lines.push('', `**${labels.nextStep}**`, feedback.next_step);
  }

  return lines.join('\n');
}
