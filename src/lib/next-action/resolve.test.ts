import { describe, expect, it } from 'vitest';

import { resolveInSpaceChatPrompt } from '@/lib/next-action/i18n-prompts';
import {
  resolveNextActionChatPrompt,
  resolveNextActionHref,
} from '@/lib/next-action/resolve';

describe('next-action resolve (KAZI-321)', () => {
  it('does not deep-link mock_interview by type alone', () => {
    expect(
      resolveNextActionHref('en', { type: 'mock_interview' })
    ).toBeNull();
  });

  it('deep-links open_interview and explicit paths', () => {
    expect(
      resolveNextActionHref('en', { type: 'open_interview' })
    ).toBe('/en/interview');
    expect(
      resolveNextActionHref('ru', {
        type: 'mock_interview',
        path: '/interview',
      })
    ).toBe('/ru/interview');
  });

  it('resolves locale-specific in-chat prompts', () => {
    expect(
      resolveNextActionChatPrompt({ type: 'mock_interview' }, 'zh')
    ).toContain('面试');
    expect(
      resolveNextActionChatPrompt({ type: 'mock_interview' }, 'en')
    ).toMatch(/mock interview|practice interview/i);
    expect(
      resolveNextActionChatPrompt({
        type: 'cv_builder',
        payload: '  Tailor my CV  ',
      }, 'en')
    ).toBe('Tailor my CV');
  });

  it('returns null prompt for navigation-only actions', () => {
    expect(
      resolveNextActionChatPrompt({ type: 'open_interview' }, 'en')
    ).toBeNull();
  });

  it('falls back to English prompts for unknown locale keys', () => {
    const enPrompt = resolveInSpaceChatPrompt('en', 'job_search');
    expect(enPrompt).toBeTruthy();
    expect(resolveInSpaceChatPrompt('xx' as 'en', 'job_search')).toBe(enPrompt);
  });
});
