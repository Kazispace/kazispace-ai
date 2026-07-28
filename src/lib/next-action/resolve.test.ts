import { describe, expect, it } from 'vitest';

import {
  type InSpaceChatPromptType,
  resolveInSpaceChatPrompt,
} from '@/lib/next-action/i18n-prompts';
import en from '@/lib/i18n/en.json';
import kk from '@/lib/i18n/kk.json';
import ru from '@/lib/i18n/ru.json';
import uz from '@/lib/i18n/uz.json';
import zh from '@/lib/i18n/zh.json';
import { SUPPORTED_LOCALES } from '@/lib/constants';
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
    expect(
      resolveNextActionHref('en', {
        type: 'cv_builder',
        path: '/en/cv?job_id=job-1',
      })
    ).toBe('/en/chat?open_cv=1&job_id=job-1');
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

  it('uses only known inSpacePrompts keys in every locale bundle', () => {
    const bundles = { en, ru, kk, uz, zh };
    const allowed = new Set<InSpaceChatPromptType>([
      'mock_interview',
      'cv_builder',
      'edit_cv',
      'english_tutor',
      'job_search',
    ]);
    for (const locale of SUPPORTED_LOCALES) {
      const prompts = bundles[locale].chat.inSpacePrompts;
      if (!prompts) continue;
      for (const key of Object.keys(prompts)) {
        expect(
          allowed.has(key as InSpaceChatPromptType),
          `${locale}: unknown inSpacePrompts key "${key}"`
        ).toBe(true);
      }
    }
  });
});
