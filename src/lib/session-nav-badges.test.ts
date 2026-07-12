import { describe, expect, it } from 'vitest';

import {
  formatSessionNavBadgeLabel,
  sessionNavBadgePillClass,
} from '@/lib/session-nav-badges';

describe('session-nav-badges', () => {
  const t = (key: string) => key;

  it('maps badge kinds to pill classes', () => {
    expect(sessionNavBadgePillClass('inProgress')).toContain('green');
    expect(sessionNavBadgePillClass('resumable')).toContain('amber');
    expect(sessionNavBadgePillClass('clinicInline')).toContain('gray');
  });

  it('formats labels with pipeline detail fallback', () => {
    expect(formatSessionNavBadgeLabel('pipeline', 'collecting', t)).toBe('collecting');
    expect(formatSessionNavBadgeLabel('pipeline', null, t)).toBe('badgeInProgress');
    expect(formatSessionNavBadgeLabel('clinicInline', null, t)).toBe('clinicInlineHint');
  });
});
