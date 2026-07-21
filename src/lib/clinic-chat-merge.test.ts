import { describe, expect, it } from 'vitest';

import {
  isInFlightClinicMessage,
  mergeClinicMessagesAfterHistoryLoad,
} from '@/lib/clinic-chat-merge';
import type { ChatMessage } from '@/types';

const base = (overrides: Partial<ChatMessage>): ChatMessage => ({
  id: 'm1',
  role: 'user',
  content: 'hello',
  timestamp: '2026-07-13T10:00:00Z',
  sessionId: 'sess_1',
  status: 'sent',
  streamComplete: true,
  ...overrides,
});

describe('isInFlightClinicMessage', () => {
  it('treats sending and streaming assistant rows as in-flight', () => {
    expect(isInFlightClinicMessage(base({ status: 'sending' }))).toBe(true);
    expect(
      isInFlightClinicMessage(
        base({ id: 'a1', role: 'assistant', content: '', streamComplete: false })
      )
    ).toBe(true);
  });

  it('does not treat sent or failed rows as in-flight', () => {
    expect(isInFlightClinicMessage(base({ status: 'sent' }))).toBe(false);
    expect(isInFlightClinicMessage(base({ status: 'failed' }))).toBe(false);
  });

  it('does not treat assistants already bound to serverMessageId as in-flight', () => {
    expect(
      isInFlightClinicMessage(
        base({
          id: 'a_local',
          role: 'assistant',
          content: 'soft reply',
          streamComplete: false,
          serverMessageId: '42',
        })
      )
    ).toBe(false);
  });
});

describe('mergeClinicMessagesAfterHistoryLoad', () => {
  it('returns local when server history is empty', () => {
    const local = [base({ id: 'u1' }), base({ id: 'a1', role: 'assistant', content: 'hi' })];
    expect(mergeClinicMessagesAfterHistoryLoad(local, [])).toEqual(local);
  });

  it('keeps in-flight user and assistant rows not yet on server', () => {
    const local = [
      base({ id: 'u_local', content: 'new question', status: 'sending' }),
      base({ id: 'a_local', role: 'assistant', content: '', streamComplete: false }),
    ];
    const server = [base({ id: 'u_old', content: 'previous' })];
    expect(mergeClinicMessagesAfterHistoryLoad(local, server)).toEqual([
      ...server,
      ...local,
    ]);
  });

  it('prefers server for completed local rows even when content matches', () => {
    const local = [
      base({ id: 'u1', content: 'hello' }),
      base({ id: 'a_local', role: 'assistant', content: 'world' }),
    ];
    const server = [
      base({ id: 'u_srv', content: 'hello' }),
      base({ id: 'a_srv', role: 'assistant', content: 'world' }),
    ];
    expect(mergeClinicMessagesAfterHistoryLoad(local, server)).toEqual(server);
  });

  it('does not duplicate repeated user text that is already sent locally', () => {
    const local = [
      base({ id: 'u_dup', content: '你好' }),
      base({ id: 'a_dup', role: 'assistant', content: 'reply' }),
    ];
    const server = [
      base({ id: 'u_srv', content: '你好' }),
      base({ id: 'a_srv', role: 'assistant', content: 'reply' }),
    ];
    expect(mergeClinicMessagesAfterHistoryLoad(local, server)).toEqual(server);
  });

  it('drops local streaming assistant once serverMessageId is bound (no double bubble)', () => {
    const local = [
      base({ id: 'u_local', content: '傻逼呀' }),
      base({
        id: 'a_local',
        role: 'assistant',
        content: '抱歉让你这么烦心。搜索结果…',
        streamComplete: false,
        serverMessageId: '99',
      }),
    ];
    const server = [
      base({ id: 'u_srv', content: '傻逼呀' }),
      base({
        id: '99',
        role: 'assistant',
        content: '抱歉让你这么烦心。搜索结果…\n<!--kazi:degraded-->',
      }),
    ];
    expect(mergeClinicMessagesAfterHistoryLoad(local, server)).toEqual(server);
  });
});
