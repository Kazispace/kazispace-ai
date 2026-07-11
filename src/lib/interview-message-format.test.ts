import { describe, expect, it } from 'vitest';

import { formatFeedbackMessage, formatPrepMessage } from '@/lib/interview-message-format';

const labels = {
  prepTitle: 'Interview prep',
  prepFocusAreas: 'Focus areas',
  prepSampleQuestions: 'Sample questions',
  prepDuration: ({ min }: { min: number }) => `About ${min} min`,
  prepPrompt: 'Tap start or skip.',
  feedbackTitle: ({ role }: { role: string }) => `Feedback — ${role}`,
  feedbackTitleGeneric: 'Interview Feedback',
  overallSummary: 'Overall',
  strengths: 'Strengths',
  improvements: 'Improvements',
  weaknessTags: 'Focus',
  sampleAnswer: 'Sample',
  nextStep: 'Next',
  scores: {
    clarity: 'Clarity',
    relevance: 'Relevance',
    confidence: 'Confidence',
  },
};

describe('interview-message-format', () => {
  it('formats prep as markdown message', () => {
    const text = formatPrepMessage(
      {
        focus_areas: ['Communication'],
        sample_questions: ['Tell me about yourself'],
        estimated_duration_min: 10,
      },
      { jobId: '1', title: 'IT Support', company: 'Acme' },
      labels
    );

    expect(text).toContain('Interview prep');
    expect(text).toContain('IT Support');
    expect(text).toContain('Communication');
    expect(text).toContain('Tell me about yourself');
    expect(text).toContain('Tap start or skip.');
  });

  it('formats feedback scores and summary', () => {
    const text = formatFeedbackMessage(
      {
        tier: 'pro',
        overall_summary: 'Good effort',
        scores: { clarity: 4, relevance: 3, confidence: 3 },
        strengths: ['Clear structure'],
        improvements: ['More examples'],
      },
      'IT Support',
      labels
    );

    expect(text).toContain('Feedback — IT Support');
    expect(text).toContain('Clarity:** 4/5');
    expect(text).toContain('Good effort');
    expect(text).toContain('Clear structure');
  });

  it('uses generic feedback title when role is empty', () => {
    const text = formatFeedbackMessage(
      { tier: 'pro', overall_summary: 'OK' },
      null,
      labels
    );
    expect(text).toContain('Interview Feedback');
    expect(text).not.toContain('Interview Feedback —');
  });
});
