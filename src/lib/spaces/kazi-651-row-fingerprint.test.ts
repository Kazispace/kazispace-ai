import { describe, expect, it } from 'vitest';

import {
  preserveSpaceMessageRows,
  spaceMessageRowFingerprint,
} from '@/lib/spaces/space-history-query';
import type { SpaceChatMessage } from '@/lib/spaces/turn';

const base: SpaceChatMessage = {
  id: 'a1',
  role: 'assistant',
  content: '这个问题更适合简历专家',
};

describe('KAZI-651 Phase A review: spaceMessageRowFingerprint covers referral/upgradeCta', () => {
  it('differs when a row gains a referral', () => {
    const withReferral: SpaceChatMessage = {
      ...base,
      referral: { agentId: 'cv', reason: 'looks like a resume ask' },
    };
    expect(spaceMessageRowFingerprint(base)).not.toBe(
      spaceMessageRowFingerprint(withReferral)
    );
  });

  it('differs when a row gains an upgradeCta', () => {
    const withUpgradeCta: SpaceChatMessage = {
      ...base,
      upgradeCta: {
        upgrade_to: 'research',
        seed: { question: '深入研究竞品', citations: [] },
      },
    };
    expect(spaceMessageRowFingerprint(base)).not.toBe(
      spaceMessageRowFingerprint(withUpgradeCta)
    );
  });

  it('differs between two different referred agentIds', () => {
    const toCv: SpaceChatMessage = {
      ...base,
      referral: { agentId: 'cv', reason: '' },
    };
    const toInterview: SpaceChatMessage = {
      ...base,
      referral: { agentId: 'interview', reason: '' },
    };
    expect(spaceMessageRowFingerprint(toCv)).not.toBe(
      spaceMessageRowFingerprint(toInterview)
    );
  });

  it('preserveSpaceMessageRows picks up a referral that arrives on a later fetch instead of keeping the stale row', () => {
    const previous = [base];
    const next: SpaceChatMessage[] = [
      { ...base, referral: { agentId: 'cv', reason: 'looks like a resume ask' } },
    ];
    const result = preserveSpaceMessageRows(previous, next);
    // Before the fingerprint fix, this would incorrectly reuse the stale
    // `previous[0]` reference (without .referral) because both rows
    // fingerprinted identically.
    expect(result[0]).toBe(next[0]);
    expect(result[0]?.referral).toEqual({
      agentId: 'cv',
      reason: 'looks like a resume ask',
    });
  });

  it('still returns the previous stable reference when nothing changed', () => {
    const previous = [{ ...base }];
    const next = [{ ...base }];
    expect(preserveSpaceMessageRows(previous, next)).toBe(previous);
  });
});

describe('KAZI-651 Phase C.1a: spaceMessageRowFingerprint covers intent/citations/capabilityId/playbookId', () => {
  it('differs when a row gains an intent', () => {
    const withIntent: SpaceChatMessage = { ...base, intent: 'research' };
    expect(spaceMessageRowFingerprint(base)).not.toBe(
      spaceMessageRowFingerprint(withIntent)
    );
  });

  it('differs when a row gains citations', () => {
    const withCitations: SpaceChatMessage = {
      ...base,
      citations: [{ url: 'https://example.com/a', title: 'Example A' }],
    };
    expect(spaceMessageRowFingerprint(base)).not.toBe(
      spaceMessageRowFingerprint(withCitations)
    );
  });

  it('differs when a row gains a capabilityId', () => {
    const withCapability: SpaceChatMessage = { ...base, capabilityId: 'web_search' };
    expect(spaceMessageRowFingerprint(base)).not.toBe(
      spaceMessageRowFingerprint(withCapability)
    );
  });

  it('differs when a row gains a playbookId, including the null (unbound) case', () => {
    const withNullPlaybook: SpaceChatMessage = { ...base, playbookId: null };
    const withBoundPlaybook: SpaceChatMessage = { ...base, playbookId: 'pb_123' };
    expect(spaceMessageRowFingerprint(base)).not.toBe(
      spaceMessageRowFingerprint(withNullPlaybook)
    );
    expect(spaceMessageRowFingerprint(withNullPlaybook)).not.toBe(
      spaceMessageRowFingerprint(withBoundPlaybook)
    );
  });

  it('preserveSpaceMessageRows picks up capability fields that arrive on a later fetch instead of keeping the stale row', () => {
    const previous = [base];
    const next: SpaceChatMessage[] = [
      { ...base, intent: 'research', capabilityId: 'research', playbookId: null },
    ];
    const result = preserveSpaceMessageRows(previous, next);
    expect(result[0]).toBe(next[0]);
    expect(result[0]?.capabilityId).toBe('research');
  });
});
