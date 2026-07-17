import { describe, expect, it } from 'vitest';

import {
  CHAT_NEAR_BOTTOM_PX,
  isNearBottom,
  spaceChatScrollStorageKey,
} from '@/lib/spaces/chat-scroll';

describe('space chat-scroll helpers', () => {
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
});
