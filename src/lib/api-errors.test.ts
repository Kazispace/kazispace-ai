import { describe, expect, it } from 'vitest';

import { isInteractiveInProgress, isLlmBusy } from '@/lib/api-errors';

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

describe('isInteractiveInProgress', () => {
  it('matches INTERACTIVE_IN_PROGRESS', () => {
    expect(
      isInteractiveInProgress({
        status: 409,
        errorCode: 'INTERACTIVE_IN_PROGRESS',
      })
    ).toBe(true);
  });

  it('matches legacy SESSION_IN_PROGRESS', () => {
    expect(
      isInteractiveInProgress({ errorCode: 'SESSION_IN_PROGRESS' })
    ).toBe(true);
  });

  it('matches code embedded in error message', () => {
    expect(
      isInteractiveInProgress({
        error:
          'Another interactive Capability is still Current. Set confirm_abandon=true… INTERACTIVE_IN_PROGRESS',
      })
    ).toBe(true);
  });

  it('ignores other 409 codes', () => {
    expect(
      isInteractiveInProgress({ status: 409, errorCode: 'FEEDBACK_NOT_READY' })
    ).toBe(false);
  });
});
