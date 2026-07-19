import { describe, expect, it } from 'vitest';

import {
  extractSpaceTurnEnvelopeText,
  isPlaceholderReply,
  latestAssistantAfterLastUser,
  mapSpaceHistoryMessages,
  mergeSpaceMessagesAfterSend,
  resolveSpaceTurnCards,
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

  it('reads KAZI-171 envelope with assistant_response passthrough', () => {
    expect(
      resolveSpaceTurnReply({
        envelope: {
          components: [{ type: 'text', text: 'From components' }],
          assistant_response: { content: 'From assistant_response' },
          meta: { mode: 'space_l2_delegate' },
        },
      })
    ).toBe('From components');
  });

  it('falls back to assistant_response when components are missing', () => {
    expect(
      resolveSpaceTurnReply({
        envelope: {
          assistant_response: { content: 'Only assistant_response' },
          meta: { mode: 'space_l2_delegate' },
        },
      })
    ).toBe('Only assistant_response');
  });
});

describe('resolveSpaceTurnCards', () => {
  const jobCards = [
    {
      type: 'job',
      job_id: 'j1',
      title: '贸易经理',
      company: 'Acme',
    },
    {
      type: 'job',
      job_id: 'j2',
      title: '销售经理',
      company: 'Beta',
    },
  ];

  it('reads assistant_response.cards on the turn root', () => {
    expect(
      resolveSpaceTurnCards({
        reply_text: '为「贸易经理」找到 10 个岗位。',
        assistant_response: { content: '为「贸易经理」找到 10 个岗位。', cards: jobCards },
      })
    ).toEqual(jobCards);
  });

  it('reads assistant_response.cards nested under envelope', () => {
    expect(
      resolveSpaceTurnCards({
        envelope: {
          components: [{ type: 'text', text: '为「贸易经理」找到 10 个岗位。' }],
          assistant_response: {
            content: '为「贸易经理」找到 10 个岗位。',
            cards: jobCards,
          },
        },
      })
    ).toEqual(jobCards);
  });

  it('returns empty when only text components are present', () => {
    expect(
      resolveSpaceTurnCards({
        envelope: {
          components: [{ type: 'text', text: 'Hello' }],
        },
      })
    ).toEqual([]);
  });
});

describe('latestAssistantAfterLastUser', () => {
  it('returns assistant after the last user turn by position', () => {
    expect(
      latestAssistantAfterLastUser([
        { id: 'u1', role: 'user', content: 'ok' },
        { id: 'a1', role: 'assistant', content: 'first' },
        { id: 'u2', role: 'user', content: 'ok' },
        { id: 'a2', role: 'assistant', content: 'second' },
      ])
    ).toBe('second');
  });

  it('returns empty when last user has no assistant yet', () => {
    expect(
      latestAssistantAfterLastUser([
        { id: 'u1', role: 'user', content: 'hi' },
        { id: 'a1', role: 'assistant', content: 'hello' },
        { id: 'u2', role: 'user', content: 'again' },
      ])
    ).toBe('');
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

  it('returns local when server history is empty', () => {
    const local = [
      { id: 'u1', role: 'user' as const, content: 'hi' },
      { id: 'a1', role: 'assistant' as const, content: 'hello' },
    ];
    expect(mergeSpaceMessagesAfterSend(local, [])).toEqual(local);
  });

  it('prefers server when it already has the same assistant content', () => {
    const local = [
      { id: 'u1', role: 'user' as const, content: 'hi' },
      { id: 'local_a1', role: 'assistant' as const, content: 'hello' },
    ];
    const server = [
      { id: 'u1', role: 'user' as const, content: 'hi' },
      { id: 'srv_a1', role: 'assistant' as const, content: 'hello' },
    ];
    expect(mergeSpaceMessagesAfterSend(local, server)).toEqual(server);
  });

  it('appends only assistant rows missing from server by content', () => {
    const local = [
      { id: 'u1', role: 'user' as const, content: 'one' },
      { id: 'local_a1', role: 'assistant' as const, content: 'first' },
      { id: 'u2', role: 'user' as const, content: 'two' },
      { id: 'local_a2', role: 'assistant' as const, content: 'second' },
    ];
    const server = [
      { id: 'u1', role: 'user' as const, content: 'one' },
      { id: 'srv_a1', role: 'assistant' as const, content: 'first' },
      { id: 'u2', role: 'user' as const, content: 'two' },
    ];
    expect(mergeSpaceMessagesAfterSend(local, server)).toEqual([
      ...server,
      { id: 'local_a2', role: 'assistant', content: 'second' },
    ]);
  });

  it('preserves local cards when server history omits them', () => {
    const cards = [
      { type: 'job', job_id: 'j1', title: '贸易经理', company: 'Acme' },
    ];
    const local = [
      { id: 'u1', role: 'user' as const, content: '帮我求职' },
      {
        id: 'local_a1',
        role: 'assistant' as const,
        content: '为「贸易经理」找到 10 个岗位。',
        cards,
      },
    ];
    const server = [
      { id: 'u1', role: 'user' as const, content: '帮我求职' },
      {
        id: 'srv_a1',
        role: 'assistant' as const,
        content: '为「贸易经理」找到 10 个岗位。',
      },
    ];
    expect(mergeSpaceMessagesAfterSend(local, server)).toEqual([
      { id: 'u1', role: 'user', content: '帮我求职' },
      {
        id: 'srv_a1',
        role: 'assistant',
        content: '为「贸易经理」找到 10 个岗位。',
        cards,
      },
    ]);
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

  it('keeps assistant_response.cards from history rows', () => {
    const rows = mapSpaceHistoryMessages([
      {
        id: 'a1',
        role: 'assistant',
        content: '为「贸易经理」找到 10 个岗位。',
        assistant_response: {
          content: '为「贸易经理」找到 10 个岗位。',
          cards: [
            { type: 'job', job_id: 'j1', title: '贸易经理', company: 'Acme' },
          ],
        },
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.content).toBe('为「贸易经理」找到 10 个岗位。');
    expect(rows[0]?.cards).toEqual([
      expect.objectContaining({
        type: 'job',
        job_id: 'j1',
        title: '贸易经理',
        company: 'Acme',
      }),
    ]);
  });

  it('uses stable fallback ids when server omits message ids', () => {
    const rows = [{ role: 'user', text: 'hello' }];
    expect(mapSpaceHistoryMessages(rows)).toEqual(mapSpaceHistoryMessages(rows));
  });
});
