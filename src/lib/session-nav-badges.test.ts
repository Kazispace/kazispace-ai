import { describe, expect, it, vi } from 'vitest';

import {
  formatSessionNavBadgeLabel,
  PIPELINE_STATE_LABEL_KEYS,
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

  it('maps every PIPELINE_STATE_LABEL_KEYS entry to its i18n key', () => {
    for (const [state, labelKey] of Object.entries(PIPELINE_STATE_LABEL_KEYS)) {
      expect(resolvePipelineBadgeLabel(state, t)).toBe(labelKey);
      expect(formatSessionNavBadgeLabel('pipeline', state, t)).toBe(labelKey);
    }
  });

  it('falls back to badgeInProgress for unknown pipeline states', () => {
    expect(formatSessionNavBadgeLabel('pipeline', 'unknown_state', t)).toBe(
      'badgeInProgress'
    );
    expect(formatSessionNavBadgeLabel('pipeline', null, t)).toBe('badgeInProgress');
    expect(formatSessionNavBadgeLabel('clinicInline', null, t)).toBe('clinicInlineHint');
  });

  it('warns in development for unmapped pipeline states', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      resolvePipelineBadgeLabel('brand_new_state', t);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('brand_new_state')
      );
    } finally {
      process.env.NODE_ENV = prev;
    }
    warn.mockRestore();
  });
});
