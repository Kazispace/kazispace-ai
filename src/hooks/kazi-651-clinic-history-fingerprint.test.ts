import { describe, expect, it } from 'vitest';

import { clinicHistoryFingerprint } from '@/hooks/use-clinic-chat';
import type { SpaceChatMessage } from '@/lib/spaces/turn';

const base: SpaceChatMessage = {
  id: 'a1',
  role: 'assistant',
  content: '这是研究结果',
};

/**
 * Review on PR #217: clinicHistoryFingerprint predates KAZI-651 and was
 * never updated when normalizeHistoryMessage started extracting
 * intent/citations/capabilityId/playbookId -- same lesson C.1a already
 * applied to spaceMessageRowFingerprint, just missed here.
 */
describe('KAZI-651 review: clinicHistoryFingerprint covers intent/citations/capabilityId/playbookId', () => {
  it('differs when a row gains an intent', () => {
    const withIntent: SpaceChatMessage = { ...base, intent: 'research' };
    expect(clinicHistoryFingerprint(base)).not.toBe(
      clinicHistoryFingerprint(withIntent)
    );
  });

  it('differs when a row gains citations', () => {
    const withCitations: SpaceChatMessage = {
      ...base,
      citations: [{ url: 'https://example.com/a', title: 'Example A' }],
    };
    expect(clinicHistoryFingerprint(base)).not.toBe(
      clinicHistoryFingerprint(withCitations)
    );
  });

  it('differs when a row gains a capabilityId', () => {
    const withCapability: SpaceChatMessage = { ...base, capabilityId: 'web_search' };
    expect(clinicHistoryFingerprint(base)).not.toBe(
      clinicHistoryFingerprint(withCapability)
    );
  });

  it('differs between undefined, null, and bound playbookId', () => {
    const withNull: SpaceChatMessage = { ...base, playbookId: null };
    const withBound: SpaceChatMessage = { ...base, playbookId: 'pb_123' };
    expect(clinicHistoryFingerprint(base)).not.toBe(clinicHistoryFingerprint(withNull));
    expect(clinicHistoryFingerprint(withNull)).not.toBe(
      clinicHistoryFingerprint(withBound)
    );
  });
});
