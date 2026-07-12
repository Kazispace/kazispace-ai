import { describe, expect, it } from 'vitest';

import {
  cvHubQuickActionPrompt,
  matchCvHubQuickAction,
} from '@/lib/cv-hub-quick-actions';

describe('matchCvHubQuickAction', () => {
  it('matches localized chip labels', () => {
    const labels = {
      upload: 'Upload resume',
      experience: 'Describe experience',
      tailor: 'Tailor for a job',
    } as const;

    expect(matchCvHubQuickAction('Upload resume', labels)).toBe('upload');
    expect(matchCvHubQuickAction('Tailor for a job', labels)).toBe('tailor');
    expect(matchCvHubQuickAction('unknown', labels)).toBeNull();
  });
});

describe('cvHubQuickActionPrompt', () => {
  it('returns i18n prompt keys for text actions', () => {
    const getText = (key: string) => `text:${key}`;

    expect(cvHubQuickActionPrompt('experience', getText)).toBe(
      'text:welcomePromptExperienceText'
    );
    expect(cvHubQuickActionPrompt('tailor', getText)).toBe('text:welcomePromptTailorText');
  });
});
