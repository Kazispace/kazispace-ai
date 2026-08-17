import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

import { HUB_CHAT_VIRTUALIZE_AFTER } from '@/lib/spaces/perf-policy';
import { shouldVirtualizeHubMessages } from '@/lib/spaces/space-message-virtualize';

function readSrc(rel: string): string {
  return readFileSync(path.resolve(__dirname, rel), 'utf8');
}

describe('KAZI-576 hub chat virtualize after threshold', () => {
  it('virtualizes at the named policy threshold, not below', () => {
    expect(HUB_CHAT_VIRTUALIZE_AFTER).toBe(60);
    expect(shouldVirtualizeHubMessages(59)).toBe(false);
    expect(shouldVirtualizeHubMessages(60)).toBe(true);
  });

  it('interview and english pages do not statically import react-virtuoso', () => {
    const interview = readSrc(
      '../../app/[locale]/(workspace)/interview/page.tsx'
    );
    const english = readSrc('../../app/[locale]/(workspace)/english/page.tsx');
    expect(interview).toMatch(/HubMessageList/);
    expect(english).toMatch(/HubMessageList/);
    expect(interview).not.toMatch(/react-virtuoso/);
    expect(english).not.toMatch(/react-virtuoso/);
    expect(interview).not.toMatch(/hub-message-virtuoso/);
    expect(english).not.toMatch(/hub-message-virtuoso/);
    expect(interview).toMatch(/header=\{[\s\S]*HubWorkflowStrip/);
    const englishList = english.match(/<HubMessageList[\s\S]*?\/>/);
    expect(englishList?.[0]).not.toMatch(/header=/);
  });

  it('keeps static rows until the virtuoso chunk resolves', () => {
    const list = readSrc('../../components/chat/hub-message-list.tsx');
    expect(list).toMatch(/loadHubMessageVirtuoso/);
    expect(list).toMatch(/StaticHubMessageRows/);
    expect(list).toMatch(/shouldVirtualizeHubMessages/);
    expect(list).not.toMatch(/from ['"]next\/dynamic['"]/);
    expect(list).not.toMatch(/from ['"]react-virtuoso['"]/);
    expect(list).not.toMatch(
      /import\s+\{[^}]*\bHubMessageVirtuoso\b[^}]*\}\s+from/
    );
  });

  it('reuses the existing hub overflow parent instead of a second scroller', () => {
    const virtuoso = readSrc('../../components/chat/hub-message-virtuoso.tsx');
    expect(virtuoso).toMatch(/customScrollParent/);
    expect(virtuoso).toMatch(/scrollParentRef/);
    expect(virtuoso).toMatch(/StaticHubMessageRows/);
    expect(virtuoso).not.toMatch(/followOutput/);
    expect(virtuoso).not.toMatch(/return null/);
  });

  it('measures the optional header inside static rows and Virtuoso Header', () => {
    const list = readSrc('../../components/chat/hub-message-list.tsx');
    const staticRows = readSrc(
      '../../components/chat/hub-message-static-rows.tsx'
    );
    const virtuoso = readSrc('../../components/chat/hub-message-virtuoso.tsx');
    expect(list).toMatch(/header/);
    expect(staticRows).toMatch(/header/);
    expect(virtuoso).toMatch(/components=\{HUB_MESSAGE_VIRTUOSO_COMPONENTS\}/);
    expect(virtuoso).toMatch(/Header: HubMessageVirtuosoHeader/);
    expect(virtuoso).toMatch(/context=\{\{ header \}\}/);
  });
});
