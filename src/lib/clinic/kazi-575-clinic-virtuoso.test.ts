import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

import { CLINIC_CHAT_VIRTUALIZE_AFTER } from '@/lib/spaces/perf-policy';
import { shouldVirtualizeClinicMessages } from '@/lib/spaces/space-message-virtualize';

function readSrc(rel: string): string {
  return readFileSync(path.resolve(__dirname, rel), 'utf8');
}

describe('KAZI-575 Clinic chat virtualize after threshold', () => {
  it('virtualizes at the named policy threshold, not below', () => {
    expect(CLINIC_CHAT_VIRTUALIZE_AFTER).toBe(60);
    expect(shouldVirtualizeClinicMessages(59)).toBe(false);
    expect(shouldVirtualizeClinicMessages(60)).toBe(true);
  });

  it('clinic-shell does not statically import react-virtuoso', () => {
    const shell = readSrc('../../components/clinic/clinic-shell.tsx');
    const page = readSrc('../../app/[locale]/(workspace)/chat/page.tsx');
    expect(shell).toMatch(/ClinicMessageList/);
    expect(shell).not.toMatch(/react-virtuoso/);
    expect(shell).not.toMatch(/clinic-message-virtuoso/);
    expect(page).not.toMatch(/react-virtuoso/);
  });

  it('keeps static rows until the virtuoso chunk resolves', () => {
    const list = readSrc('../../components/clinic/clinic-message-list.tsx');
    expect(list).toMatch(/loadClinicMessageVirtuoso/);
    expect(list).toMatch(/StaticClinicMessageRows/);
    expect(list).toMatch(/shouldVirtualizeClinicMessages/);
    expect(list).not.toMatch(/from ['"]next\/dynamic['"]/);
    expect(list).not.toMatch(/from ['"]react-virtuoso['"]/);
    expect(list).not.toMatch(
      /import\s+\{[^}]*\bClinicMessageVirtuoso\b[^}]*\}\s+from/
    );
  });

  it('reuses the existing chat scroll parent instead of a second scroller', () => {
    const virtuoso = readSrc(
      '../../components/clinic/clinic-message-virtuoso.tsx'
    );
    expect(virtuoso).toMatch(/customScrollParent/);
    expect(virtuoso).toMatch(/scrollParentRef/);
    expect(virtuoso).toMatch(/StaticClinicMessageRows/);
    expect(virtuoso).toMatch(/pinChatScrollToLatest/);
    expect(virtuoso).toMatch(/shouldPinChatScrollToLatest/);
    expect(virtuoso).toMatch(/didFreezeInitialRef/);
    expect(virtuoso).not.toMatch(/followOutput/);
    expect(virtuoso).not.toMatch(/return null/);
  });
});
