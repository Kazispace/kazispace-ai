import { describe, expect, it } from 'vitest';

import {
  MOCK_INTERVIEW_REFERRAL_OPENING,
  resolveInteractiveNextActionChatPrompt,
  resolveInteractiveNextActionHref,
} from '@/lib/interactive-in-space/next-action';

describe('interactive-in-space next-action (KAZI-321)', () => {
  it('does not deep-link mock_interview by type alone', () => {
    expect(
      resolveInteractiveNextActionHref('en', { type: 'mock_interview' })
    ).toBeNull();
  });

  it('deep-links open_interview and explicit paths', () => {
    expect(
      resolveInteractiveNextActionHref('en', { type: 'open_interview' })
    ).toBe('/en/interview');
    expect(
      resolveInteractiveNextActionHref('ru', {
        type: 'mock_interview',
        path: '/interview',
      })
    ).toBe('/ru/interview');
  });

  it('resolves in-chat prompts for interactive capabilities', () => {
    expect(
      resolveInteractiveNextActionChatPrompt({ type: 'mock_interview' })
    ).toBe(MOCK_INTERVIEW_REFERRAL_OPENING);
    expect(
      resolveInteractiveNextActionChatPrompt({
        type: 'cv_builder',
        payload: '  Tailor my CV  ',
      })
    ).toBe('Tailor my CV');
  });

  it('returns null prompt for navigation-only actions', () => {
    expect(
      resolveInteractiveNextActionChatPrompt({ type: 'open_interview' })
    ).toBeNull();
  });
});
