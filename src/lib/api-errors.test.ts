import { describe, expect, it } from 'vitest';

import { isLlmBusy } from '@/lib/api-errors';

describe('isLlmBusy', () => {
  it('matches error_code LLM_BUSY', () => {
    expect(isLlmBusy({ errorCode: 'LLM_BUSY' })).toBe(true);
  });

  it('matches HTTP 429 with LLM_BUSY', () => {
    expect(isLlmBusy({ status: 429, errorCode: 'LLM_BUSY' })).toBe(true);
  });

  it('matches bare HTTP 429 (BE may omit code momentarily)', () => {
    expect(isLlmBusy({ status: 429 })).toBe(true);
  });

  it('ignores unrelated errors', () => {
    expect(isLlmBusy({ status: 500, errorCode: 'INTERNAL' })).toBe(false);
    expect(isLlmBusy({ status: 400, errorCode: 'PROFILE_INCOMPLETE' })).toBe(
      false
    );
  });
});
