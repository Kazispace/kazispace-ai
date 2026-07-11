import { describe, expect, it } from 'vitest';

import { resolveInterviewFeedbackCtas } from '@/lib/interview-cta';

describe('resolveInterviewFeedbackCtas', () => {
  it('prefers legacy ctas array', () => {
    const ctas = resolveInterviewFeedbackCtas(
      {
        ctas: [{ cta_type: 'retry_full', label: 'Retry', primary: true }],
        assistant_response: {
          next_actions: [{ type: 'edit_cv', label: 'CV' }],
        },
      },
      'en'
    );
    expect(ctas).toHaveLength(1);
    expect(ctas[0]?.cta_type).toBe('retry_full');
  });

  it('maps assistant_response next_actions to interview CTAs', () => {
    const ctas = resolveInterviewFeedbackCtas(
      {
        assistant_response: {
          next_actions: [
            { type: 'retry_full', label: 'Practice again' },
            { type: 'edit_cv', label: 'Build CV' },
            { type: 'unknown_action', label: 'Skip' },
          ],
        },
      },
      'en'
    );
    expect(ctas).toHaveLength(2);
    expect(ctas[0]).toMatchObject({
      cta_type: 'retry_full',
      label: 'Practice again',
      primary: true,
    });
    expect(ctas[1]?.cta_type).toBe('edit_cv');
  });
});
