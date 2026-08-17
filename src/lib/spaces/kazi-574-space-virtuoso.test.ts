import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

import { SPACE_CHAT_VIRTUALIZE_AFTER } from '@/lib/spaces/perf-policy';
import { shouldVirtualizeSpaceMessages } from '@/lib/spaces/space-message-virtualize';

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

  it('loads virtuoso only through next/dynamic after the threshold', () => {
    const list = readSrc('../../components/spaces/space-message-list.tsx');
    expect(list).toMatch(/next\/dynamic/);
    expect(list).toMatch(/shouldVirtualizeSpaceMessages/);
    expect(list).toMatch(/space-message-virtuoso/);
    expect(list).toMatch(/ssr:\s*false/);
    expect(list).not.toMatch(/from ['"]react-virtuoso['"]/);
  });

  it('reuses the existing chat scroll parent instead of a second scroller', () => {
    const virtuoso = readSrc('../../components/spaces/space-message-virtuoso.tsx');
    expect(virtuoso).toMatch(/customScrollParent/);
    expect(virtuoso).toMatch(/scrollParentRef/);
    expect(virtuoso).not.toMatch(/followOutput/);
  });

  it('does not virtualize the public Clinic first-paint list', () => {
    const clinic = readSrc('../../components/clinic/clinic-shell.tsx');
    expect(clinic).toMatch(/messages\.map\(/);
    expect(clinic).not.toMatch(/react-virtuoso/);
    expect(clinic).not.toMatch(/SpaceMessageList/);
    expect(clinic).not.toMatch(/shouldVirtualizeSpaceMessages/);
  });
});
