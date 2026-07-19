import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiRequest } from '@/lib/api-client';
import {
  canSubmitDownFeedback,
  clearMessageFeedback,
  extractAssistantMessageId,
  isFeedbackNotReady,
  isServerAssistantMessageId,
  normalizeFeedbackReasons,
  resolveFeedbackMessageId,
  upsertMessageFeedback,
} from '@/lib/clinic/message-feedback';

vi.mock('@/lib/api-client', () => ({
  apiRequest: vi.fn(),
}));

const apiRequestMock = vi.mocked(apiRequest);

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
  it('filters unknowns, dedupes, and uses canonical order', () => {
    expect(
      normalizeFeedbackReasons(['other', 'shallow', 'nope', 'off_topic', 'other'])
    ).toEqual(['off_topic', 'shallow', 'other']);
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

describe('upsertMessageFeedback / clearMessageFeedback', () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    apiRequestMock.mockResolvedValue({ success: true, data: {} as never });
  });

  it('POSTs normalized body to feedback path', async () => {
    await upsertMessageFeedback('10482', {
      vote: 'down',
      reasons: ['other', 'off_topic'],
      note: 'world cup',
      surface: 'space',
      client_message_id: 'assistant_1',
    });

    expect(apiRequestMock).toHaveBeenCalledWith(
      '/api/v1/chat/messages/10482/feedback',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          vote: 'down',
          reasons: ['off_topic', 'other'],
          note: 'world cup',
          surface: 'space',
          client_message_id: 'assistant_1',
        }),
      })
    );
  });

  it('forces empty reasons on up', async () => {
    await upsertMessageFeedback('10482', {
      vote: 'up',
      reasons: ['off_topic'],
    });

    const [, options] = apiRequestMock.mock.calls[0] ?? [];
    expect(JSON.parse(String((options as { body?: string })?.body))).toEqual({
      vote: 'up',
      reasons: [],
      note: null,
      surface: 'clinic',
    });
  });

  it('DELETEs feedback path', async () => {
    await clearMessageFeedback('10482');
    expect(apiRequestMock).toHaveBeenCalledWith(
      '/api/v1/chat/messages/10482/feedback',
      { method: 'DELETE' }
    );
  });
});
