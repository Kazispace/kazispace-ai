import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import {
  applyCachedSpaceJobCards,
  enrichHistoryWithPreviousCards,
  rehydrateSpaceMessagesWithCards,
  rememberSpaceJobCards,
} from '@/lib/spaces/space-job-cards-cache';
import type { SpaceChatMessage } from '@/lib/spaces/turn';

const spaceId = 'sp_test_cards';
const masterSessionId = 'ms_test_1';

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
    rememberSpaceJobCards(spaceId, masterSessionId, withCards);

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
      masterSessionId,
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
      masterSessionId,
      history,
      previous
    );
    expect(rehydrated[1]?.cards).toEqual(cards);
  });

  it('does not resurrect previous-only messages after server delete', () => {
    const cards = [
      { type: 'job', job_id: 'j3', title: 'Gone', company: 'X' },
    ];
    const previous: SpaceChatMessage[] = [
      { id: 'u1', role: 'user', content: 'old' },
      { id: 'a1', role: 'assistant', content: 'deleted turn', cards },
      { id: 'u2', role: 'user', content: 'keep' },
      { id: 'a2', role: 'assistant', content: 'kept', cards },
    ];
    const history: SpaceChatMessage[] = [
      { id: 'u2', role: 'user', content: 'keep' },
      { id: 'a2', role: 'assistant', content: 'kept' },
    ];
    const enriched = enrichHistoryWithPreviousCards(history, previous);
    expect(enriched).toHaveLength(2);
    expect(enriched[1]?.cards).toEqual(cards);
    expect(enriched.some((m) => m.content === 'deleted turn')).toBe(false);
  });

  it('applies byOrdinal only when content prefix matches', () => {
    const cards = [
      { type: 'job', job_id: 'j4', title: 'A', company: 'B' },
    ];
    rememberSpaceJobCards(spaceId, masterSessionId, [
      {
        id: 'a1',
        role: 'assistant',
        content: '为「贸易经理」找到 10 个岗位。',
        cards,
      },
    ]);

    const mismatched = applyCachedSpaceJobCards(spaceId, masterSessionId, [
      {
        id: 'a2',
        role: 'assistant',
        content: '完全不同的回复内容',
      },
    ]);
    expect(mismatched[0]?.cards).toBeUndefined();

    const matched = applyCachedSpaceJobCards(spaceId, masterSessionId, [
      {
        id: 'a3',
        role: 'assistant',
        content: '为「贸易经理」找到 10 个岗位。',
      },
    ]);
    expect(matched[0]?.cards).toEqual(cards);
  });

  it('isolates cache by masterSessionId', () => {
    const cards = [
      { type: 'job', job_id: 'j5', title: 'X', company: 'Y' },
    ];
    rememberSpaceJobCards(spaceId, 'ms_old', [
      { id: 'a1', role: 'assistant', content: 'hello cards', cards },
    ]);

    const otherSession = applyCachedSpaceJobCards(spaceId, 'ms_new', [
      { id: 'a1', role: 'assistant', content: 'hello cards' },
    ]);
    expect(otherSession[0]?.cards).toBeUndefined();
  });

  it('treats corrupt sessionStorage as empty cache', () => {
    store.set(`ks.space.jobCards.v2.${spaceId}.${masterSessionId}`, '{not-json');
    const messages: SpaceChatMessage[] = [
      { id: 'a1', role: 'assistant', content: 'hello' },
    ];
    expect(applyCachedSpaceJobCards(spaceId, masterSessionId, messages)).toEqual(
      messages
    );
  });

  it('applyCachedSpaceJobCards is a no-op without cache', () => {
    const messages: SpaceChatMessage[] = [
      { id: 'a1', role: 'assistant', content: 'hello' },
    ];
    expect(
      applyCachedSpaceJobCards(spaceId, masterSessionId, messages)
    ).toEqual(messages);
  });
});
