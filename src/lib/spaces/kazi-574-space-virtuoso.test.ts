import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

import {
  SPACE_CHAT_VIRTUALIZE_AFTER,
  SPACE_CHAT_VIRTUOSO_DEFAULT_ITEM_HEIGHT,
  SPACE_CHAT_VIRTUOSO_VIEWPORT_OVERSCAN,
} from '@/lib/spaces/perf-policy';
import {
  restoreSpaceChatScrollAfterVirtualize,
  shouldVirtualizeSpaceMessages,
} from '@/lib/spaces/space-message-virtualize';

function readSrc(rel: string): string {
  return readFileSync(path.resolve(__dirname, rel), 'utf8');
}

describe('KAZI-574 Space chat virtualize after threshold', () => {
  it('virtualizes at the named policy threshold, not below', () => {
    expect(SPACE_CHAT_VIRTUALIZE_AFTER).toBe(60);
    expect(shouldVirtualizeSpaceMessages(59)).toBe(false);
    expect(shouldVirtualizeSpaceMessages(60)).toBe(true);
    expect(shouldVirtualizeSpaceMessages(200)).toBe(true);
  });

  it('space-chat-pane does not statically import react-virtuoso', () => {
    const pane = readSrc('../../components/spaces/space-chat-pane.tsx');
    expect(pane).toMatch(/SpaceMessageList/);
    expect(pane).not.toMatch(/react-virtuoso/);
    expect(pane).not.toMatch(/space-message-virtuoso/);
    expect(pane).toMatch(/isSending \? \(/);
    expect(pane).toMatch(/replyNotice \? \(/);
  });

  it('keeps static rows until the virtuoso chunk resolves', () => {
    const list = readSrc('../../components/spaces/space-message-list.tsx');
    expect(list).toMatch(/loadSpaceMessageVirtuoso/);
    expect(list).toMatch(/StaticSpaceMessageRows/);
    expect(list).toMatch(/shouldVirtualizeSpaceMessages/);
    expect(list).not.toMatch(/from ['"]next\/dynamic['"]/);
    expect(list).not.toMatch(/from ['"]react-virtuoso['"]/);
    expect(list).not.toMatch(
      /import\s+\{[^}]*\bSpaceMessageVirtuoso\b[^}]*\}\s+from/
    );
  });

  it('reuses the existing chat scroll parent instead of a second scroller', () => {
    const virtuoso = readSrc('../../components/spaces/space-message-virtuoso.tsx');
    expect(virtuoso).toMatch(/customScrollParent/);
    expect(virtuoso).toMatch(/scrollParentRef/);
    expect(virtuoso).toMatch(/SPACE_CHAT_VIRTUOSO_DEFAULT_ITEM_HEIGHT/);
    expect(virtuoso).toMatch(/SPACE_CHAT_VIRTUOSO_VIEWPORT_OVERSCAN/);
    expect(virtuoso).toMatch(/StaticSpaceMessageRows/);
    expect(virtuoso).not.toMatch(/followOutput/);
    expect(virtuoso).not.toMatch(/return null/);
  });

  it('restores the pre-swap scrollTop only after the parent has overflow', () => {
    expect(SPACE_CHAT_VIRTUOSO_DEFAULT_ITEM_HEIGHT).toBe(160);
    expect(SPACE_CHAT_VIRTUOSO_VIEWPORT_OVERSCAN).toBe(800);
    const short = { scrollHeight: 100, clientHeight: 200, scrollTop: 0 };
    expect(restoreSpaceChatScrollAfterVirtualize(short, 80)).toBe(false);
    expect(short.scrollTop).toBe(0);
    const tall = { scrollHeight: 2400, clientHeight: 200, scrollTop: 0 };
    expect(restoreSpaceChatScrollAfterVirtualize(tall, 80)).toBe(true);
    expect(tall.scrollTop).toBe(80);
    expect(restoreSpaceChatScrollAfterVirtualize(tall, 0)).toBe(false);
  });

  it('does not statically import virtuoso on the public Clinic shell', () => {
    const clinic = readSrc('../../components/clinic/clinic-shell.tsx');
    expect(clinic).toMatch(/ClinicMessageList/);
    expect(clinic).not.toMatch(/react-virtuoso/);
    expect(clinic).not.toMatch(/from ['"]react-virtuoso['"]/);
    expect(clinic).not.toMatch(/SpaceMessageList/);
  });
});
