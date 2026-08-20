import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CHAT_NEAR_BOTTOM_PX,
  clampScrollTop,
  isNearBottom,
  pinChatScrollToLatest,
  readChatScrollTop,
  spaceChatScrollStorageKey,
  writeChatScrollTop,
} from '@/lib/spaces/chat-scroll';

describe('chat-scroll helpers', () => {
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

  it('builds a stable space sessionStorage key', () => {
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

  it('clamps saved scrollTop into range', () => {
    const el = {
      scrollHeight: 1000,
      clientHeight: 200,
      scrollTop: 0,
    } as HTMLElement;
    expect(clampScrollTop(el, 5000)).toBe(800);
    expect(clampScrollTop(el, -20)).toBe(0);
    expect(clampScrollTop(el, 100)).toBe(100);
  });

  it('round-trips scrollTop via sessionStorage', () => {
    stubSessionStorage();
    const key = spaceChatScrollStorageKey('sp_a');
    expect(readChatScrollTop(key)).toBeNull();
    writeChatScrollTop(key, 420.6);
    expect(readChatScrollTop(key)).toBe(421);
    writeChatScrollTop(key, -10);
    expect(readChatScrollTop(key)).toBe(0);
  });

  it('pins overflow to the latest message', () => {
    const el = { scrollHeight: 4000, clientHeight: 400, scrollTop: 80 };
    expect(pinChatScrollToLatest(el)).toBe(true);
    expect(el.scrollTop).toBe(3600);
    const short = { scrollHeight: 100, clientHeight: 400, scrollTop: 12 };
    expect(pinChatScrollToLatest(short)).toBe(false);
    expect(short.scrollTop).toBe(12);
  });
});
