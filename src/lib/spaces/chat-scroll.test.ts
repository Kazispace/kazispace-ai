import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CHAT_NEAR_BOTTOM_PX,
  isNearBottom,
  readSpaceChatScrollTop,
  spaceChatScrollStorageKey,
  writeSpaceChatScrollTop,
} from '@/lib/spaces/chat-scroll';

describe('space chat-scroll helpers', () => {
  const store = new Map<string, string>();

  afterEach(() => {
    store.clear();
    vi.unstubAllGlobals();
  });

  function stubSessionStorage() {
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
      },
    });
  }

  it('builds a stable sessionStorage key', () => {
    expect(spaceChatScrollStorageKey('sp_1')).toBe('kazi:space-chat-scroll:sp_1');
  });

  it('detects near-bottom within threshold', () => {
    expect(
      isNearBottom({
        scrollTop: 900,
        scrollHeight: 1000,
        clientHeight: 100,
      }),
    ).toBe(true);

    expect(
      isNearBottom({
        scrollTop: 0,
        scrollHeight: 1000,
        clientHeight: 100,
      }),
    ).toBe(false);

    expect(
      isNearBottom(
        {
          scrollTop: 1000 - 100 - CHAT_NEAR_BOTTOM_PX,
          scrollHeight: 1000,
          clientHeight: 100,
        },
        CHAT_NEAR_BOTTOM_PX,
      ),
    ).toBe(true);
  });

  it('round-trips scrollTop via sessionStorage', () => {
    stubSessionStorage();
    expect(readSpaceChatScrollTop('sp_a')).toBeNull();
    writeSpaceChatScrollTop('sp_a', 420.6);
    expect(readSpaceChatScrollTop('sp_a')).toBe(421);
    writeSpaceChatScrollTop('sp_a', -10);
    expect(readSpaceChatScrollTop('sp_a')).toBe(0);
  });

  it('ignores corrupt storage values', () => {
    stubSessionStorage();
    store.set(spaceChatScrollStorageKey('sp_b'), 'nope');
    expect(readSpaceChatScrollTop('sp_b')).toBeNull();
  });
});
