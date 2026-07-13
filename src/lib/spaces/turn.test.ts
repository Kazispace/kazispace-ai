import { describe, expect, it } from 'vitest';

import {
  extractSpaceTurnEnvelopeText,
  isPlaceholderReply,
  mapSpaceHistoryMessages,
  mergeSpaceMessagesAfterSend,
  resolveSpaceTurnReply,
} from '@/lib/spaces/turn';

describe('isPlaceholderReply', () => {
  it('treats ellipsis placeholders as empty', () => {
    expect(isPlaceholderReply('…')).toBe(true);
    expect(isPlaceholderReply('...')).toBe(true);
    expect(isPlaceholderReply('')).toBe(true);
    expect(isPlaceholderReply('Hello')).toBe(false);
  });
});

describe('resolveSpaceTurnReply', () => {
  it('prefers reply_text', () => {
    expect(resolveSpaceTurnReply({ reply_text: 'Hi there' })).toBe('Hi there');
  });

  it('ignores placeholder reply_text and reads envelope', () => {
    expect(
      resolveSpaceTurnReply({
        reply_text: '…',
        envelope: {
          assistant_response: { content: 'Real answer' },
        },
      })
    ).toBe('Real answer');
  });

  it('reads assistant_message.content', () => {
    expect(
      resolveSpaceTurnReply({
        assistant_message: { content: 'From assistant_message' },
      })
    ).toBe('From assistant_message');
  });

  it('reads envelope.components text parts', () => {
    expect(
      resolveSpaceTurnReply({
        envelope: {
          components: [{ type: 'text', text: 'Hello from space turn' }],
          meta: { space_id: 'sp_test' },
        },
      })
    ).toBe('Hello from space turn');
  });
});

describe('extractSpaceTurnEnvelopeText', () => {
  it('joins multiple text components', () => {
    expect(
      extractSpaceTurnEnvelopeText({
        components: [
          { type: 'text', text: 'Line one' },
          { type: 'text', text: 'Line two' },
        ],
      })
    ).toBe('Line one\n\nLine two');
  });
});

describe('mergeSpaceMessagesAfterSend', () => {
  it('keeps local assistant rows when server history lags', () => {
    const local = [
      { id: 'u1', role: 'user' as const, content: 'hi' },
      { id: 'a1', role: 'assistant' as const, content: 'hello' },
    ];
    const server = [{ id: 'u1', role: 'user' as const, content: 'hi' }];
    expect(mergeSpaceMessagesAfterSend(local, server)).toEqual(local);
  });
});

describe('mapSpaceHistoryMessages', () => {
  it('normalizes text/content fields and drops placeholder assistant rows', () => {
    expect(
      mapSpaceHistoryMessages([
        { id: 'u1', role: 'user', text: 'hello' },
        { id: 'a1', role: 'assistant', content: '…' },
        { id: 'a2', role: 'assistant', content: 'world' },
      ])
    ).toEqual([
      { id: 'u1', role: 'user', content: 'hello' },
      { id: 'a2', role: 'assistant', content: 'world' },
    ]);
  });

  it('uses stable fallback ids when server omits message ids', () => {
    const rows = [{ role: 'user', text: 'hello' }];
    expect(mapSpaceHistoryMessages(rows)).toEqual(mapSpaceHistoryMessages(rows));
  });
});
