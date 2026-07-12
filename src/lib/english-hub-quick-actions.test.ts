import { describe, expect, it } from 'vitest';

import {
  englishHubQuickActionHref,
  matchEnglishHubQuickAction,
} from '@/lib/english-hub-quick-actions';

describe('englishHubQuickActionHref', () => {
  it('builds assessment, training, and passport routes', () => {
    expect(englishHubQuickActionHref('en', 'assessment')).toBe('/en/english/assessment');
    expect(englishHubQuickActionHref('en', 'training')).toContain('/en/english/training');
    expect(englishHubQuickActionHref('en', 'passport')).toBe('/en/english/passport');
  });
});

describe('matchEnglishHubQuickAction', () => {
  it('matches localized chip labels', () => {
    const labels = {
      assessment: 'Quick 5-min test',
      training: 'Workplace speaking',
      passport: 'View my passport',
    } as const;

    expect(matchEnglishHubQuickAction('Workplace speaking', labels)).toBe('training');
    expect(matchEnglishHubQuickAction('unknown', labels)).toBeNull();
  });
});
