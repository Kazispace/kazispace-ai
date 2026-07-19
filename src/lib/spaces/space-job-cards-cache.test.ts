import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import {
  applyCachedSpaceJobCards,
  rehydrateSpaceMessagesWithCards,
  rememberSpaceJobCards,
} from '@/lib/spaces/space-job-cards-cache';
import type { SpaceChatMessage } from '@/lib/spaces/turn';

const spaceId = 'sp_test_cards';

describe('space-job-cards-cache', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('remembers and rehydrates cards when history drops them', () => {
    const cards = [
      { type: 'job', job_id: 'j1', title: '贸易经理', company: 'Acme' },
    ];
    const withCards: SpaceChatMessage[] = [
      { id: 'u1', role: 'user', content: '帮我求职' },
      {
        id: 'local_a1',
        role: 'assistant',
        content: '为「帮我求职」找到 10 个岗位。',
        cards,
        serverMessageId: '10482',
      },
    ];
    rememberSpaceJobCards(spaceId, withCards);

    const historyOnlyText: SpaceChatMessage[] = [
      { id: 'u1', role: 'user', content: '帮我求职' },
      {
        id: '10482',
        role: 'assistant',
        content: '为「帮我求职」找到 10 个岗位。',
        serverMessageId: '10482',
      },
    ];

    const rehydrated = rehydrateSpaceMessagesWithCards(
      spaceId,
      historyOnlyText,
      []
    );
    expect(rehydrated[1]?.cards).toEqual(cards);
  });

  it('prefers in-memory previous cards over empty history', () => {
    const cards = [
      { type: 'job', job_id: 'j2', title: '销售', company: 'Beta' },
    ];
    const previous: SpaceChatMessage[] = [
      { id: 'u1', role: 'user', content: 'hi' },
      { id: 'a1', role: 'assistant', content: 'found 10', cards },
    ];
    const history: SpaceChatMessage[] = [
      { id: 'u1', role: 'user', content: 'hi' },
      { id: 'srv', role: 'assistant', content: 'found 10' },
    ];
    const rehydrated = rehydrateSpaceMessagesWithCards(
      spaceId,
      history,
      previous
    );
    expect(rehydrated[1]?.cards).toEqual(cards);
  });

  it('applyCachedSpaceJobCards is a no-op without cache', () => {
    const messages: SpaceChatMessage[] = [
      { id: 'a1', role: 'assistant', content: 'hello' },
    ];
    expect(applyCachedSpaceJobCards(spaceId, messages)).toEqual(messages);
  });
});
