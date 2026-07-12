import { describe, expect, it } from 'vitest';

import {
  formatSessionNavBadgeLabel,
  resolvePipelineBadgeLabel,
  sessionNavBadgePillClass,
} from '@/lib/session-nav-badges';

describe('session-nav-badges', () => {
  const t = (key: string) => key;

  it('maps badge kinds to pill classes', () => {
    expect(sessionNavBadgePillClass('inProgress')).toContain('green');
    expect(sessionNavBadgePillClass('resumable')).toContain('amber');
    expect(sessionNavBadgePillClass('clinicInline')).toContain('gray');
  });

  it('formats pipeline labels via i18n, not raw state keys', () => {
    expect(formatSessionNavBadgeLabel('pipeline', 'feedback_pending', t)).toBe(
      'pipelineFeedbackPending'
    );
    expect(formatSessionNavBadgeLabel('pipeline', 'collecting', t)).toBe(
      'pipelineCvBuilding'
    );
    expect(formatSessionNavBadgeLabel('pipeline', 'unknown_state', t)).toBe(
      'badgeInProgress'
    );
    expect(formatSessionNavBadgeLabel('pipeline', null, t)).toBe('badgeInProgress');
    expect(formatSessionNavBadgeLabel('clinicInline', null, t)).toBe('clinicInlineHint');
  });

  it('resolvePipelineBadgeLabel maps known states', () => {
    expect(resolvePipelineBadgeLabel('feedback_pending', t)).toBe(
      'pipelineFeedbackPending'
    );
  });
});
