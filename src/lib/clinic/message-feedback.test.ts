import { describe, expect, it } from 'vitest';

import {
  canSubmitDownFeedback,
  extractAssistantMessageId,
  isFeedbackNotReady,
  isServerAssistantMessageId,
  normalizeFeedbackReasons,
  resolveFeedbackMessageId,
} from '@/lib/clinic/message-feedback';

describe('isServerAssistantMessageId', () => {
  it('accepts numeric chat_messages ids', () => {
    expect(isServerAssistantMessageId('10482')).toBe(true);
  });

  it('rejects local placeholders and uuids', () => {
    expect(isServerAssistantMessageId('assistant_171000')).toBe(false);
    expect(isServerAssistantMessageId('a1b2c3d4-e5f6-7890')).toBe(false);
    expect(isServerAssistantMessageId('')).toBe(false);
    expect(isServerAssistantMessageId(undefined)).toBe(false);
  });
});

describe('resolveFeedbackMessageId', () => {
  it('prefers serverMessageId', () => {
    expect(
      resolveFeedbackMessageId({
        serverMessageId: '10482',
        messageId: 'assistant_1',
      })
    ).toBe('10482');
  });

  it('falls back to numeric messageId', () => {
    expect(
      resolveFeedbackMessageId({ messageId: '99', serverMessageId: undefined })
    ).toBe('99');
  });
});

describe('extractAssistantMessageId', () => {
  it('reads top-level clinic field', () => {
    expect(extractAssistantMessageId({ assistant_message_id: '10482' })).toBe(
      '10482'
    );
  });

  it('reads spaces envelope.meta copy', () => {
    expect(
      extractAssistantMessageId({
        envelope: { meta: { assistant_message_id: 55 } },
      })
    ).toBe('55');
  });
});

describe('normalizeFeedbackReasons', () => {
  it('filters unknowns and dedupes', () => {
    expect(
      normalizeFeedbackReasons(['off_topic', 'nope', 'off_topic', 'shallow'])
    ).toEqual(['off_topic', 'shallow']);
  });
});

describe('canSubmitDownFeedback', () => {
  it('requires at least one reason', () => {
    expect(canSubmitDownFeedback([])).toBe(false);
    expect(canSubmitDownFeedback(['other'])).toBe(true);
  });
});

describe('isFeedbackNotReady', () => {
  it('matches 409 / FEEDBACK_NOT_READY', () => {
    expect(isFeedbackNotReady({ status: 409 })).toBe(true);
    expect(isFeedbackNotReady({ errorCode: 'FEEDBACK_NOT_READY' })).toBe(true);
    expect(isFeedbackNotReady({ status: 400 })).toBe(false);
  });
});
