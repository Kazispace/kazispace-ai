import { describe, expect, it, vi, afterEach } from 'vitest';

import { parseRetryAfterSeconds } from '@/lib/retry-after';

describe('parseRetryAfterSeconds', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('parses delay-seconds', () => {
    expect(parseRetryAfterSeconds('30')).toBe(30);
    expect(parseRetryAfterSeconds('0')).toBeUndefined();
    expect(parseRetryAfterSeconds(null)).toBeUndefined();
  });

  it('parses HTTP-date into remaining seconds', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T06:00:00.000Z'));
    expect(
      parseRetryAfterSeconds('Wed, 14 Jul 2026 06:00:45 GMT')
    ).toBe(45);
  });

  it('returns undefined for past HTTP-date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T06:00:00.000Z'));
    expect(
      parseRetryAfterSeconds('Wed, 14 Jul 2026 05:59:00 GMT')
    ).toBeUndefined();
  });
});
