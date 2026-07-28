import { describe, expect, it } from 'vitest';

import {
  creditRailTotal,
  formatCreditRailAmount,
  isCreditRailLow,
} from '@/lib/billing/credit-rail-display';

describe('credit-rail-display', () => {
  it('sums credit buckets', () => {
    expect(creditRailTotal({ cvCredits: 2, interviewCredits: 3 })).toBe(5);
  });

  it('formats compact amounts', () => {
    expect(formatCreditRailAmount(139100)).toBe('139k');
    expect(formatCreditRailAmount(1500)).toBe('1.5k');
    expect(formatCreditRailAmount(12)).toBe('12');
  });

  it('flags low balance', () => {
    expect(isCreditRailLow({ cvCredits: 3, interviewCredits: 0 })).toBe(true);
    expect(isCreditRailLow({ cvCredits: 4, interviewCredits: 0 })).toBe(false);
  });
});
