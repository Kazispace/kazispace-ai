import { describe, expect, it } from 'vitest';

import { ABILITY_NOT_ENABLED_CODE, isAbilityUnavailable } from '@/hooks/use-english-ability';

describe('isAbilityUnavailable (#230 review ⚪②)', () => {
  it('gate off is unavailable', () => {
    expect(isAbilityUnavailable({ status: 503, errorCode: ABILITY_NOT_ENABLED_CODE })).toBe(true);
  });

  it('a host without the route is unavailable', () => {
    expect(isAbilityUnavailable({ status: 404 })).toBe(true);
  });

  it('a bare 503 (gateway) is an error that keeps the retry, not "not available yet"', () => {
    expect(isAbilityUnavailable({ status: 503 })).toBe(false);
    expect(isAbilityUnavailable({ status: 500 })).toBe(false);
  });
});
