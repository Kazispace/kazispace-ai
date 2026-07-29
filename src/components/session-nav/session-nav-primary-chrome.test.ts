import { describe, expect, it } from 'vitest';

import {
  PRIMARY_ICON_STROKE,
  creditsChipShellClass,
} from '@/components/session-nav/session-nav-primary-chrome';

describe('session-nav-primary-chrome', () => {
  it('uses heavier stroke than default nav icons', () => {
    expect(PRIMARY_ICON_STROKE).toBeGreaterThan(2);
  });

  it('creditsChipShellClass differs for low vs ok balance', () => {
    const low = creditsChipShellClass(true);
    const ok = creditsChipShellClass(false);
    expect(low).toContain('orange-50');
    expect(ok).toContain('bg-white');
    expect(low).not.toBe(ok);
  });
});
