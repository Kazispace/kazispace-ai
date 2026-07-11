import { describe, expect, it } from 'vitest';

import { formatPrepMessage } from '@/lib/interview-message-format';

const prepLabels = {
  prepTitle: 'Interview prep',
  prepFocusAreas: 'Focus areas',
  prepSampleQuestions: 'Sample questions',
  prepDuration: ({ min }: { min: number }) => `About ${min} min`,
  prepPrompt: 'Tap start or skip.',
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
      prepLabels
    );

    expect(text).toContain('Interview prep');
    expect(text).toContain('IT Support');
    expect(text).toContain('Communication');
    expect(text).toContain('Tell me about yourself');
    expect(text).toContain('Tap start or skip.');
  });
});
