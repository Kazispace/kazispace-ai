import { describe, expect, it } from 'vitest';

import { mergeClinicMessagesAfterHistoryLoad } from '@/lib/clinic-chat-merge';
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

  it('prefers server when assistant content already persisted', () => {
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
});
