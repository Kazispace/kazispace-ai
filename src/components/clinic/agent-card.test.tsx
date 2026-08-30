/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

import { AgentCard } from '@/components/clinic/agent-card';
import type { AgentRegistryEntry } from '@/lib/agents/registry';

function agent(overrides: Partial<AgentRegistryEntry> = {}): AgentRegistryEntry {
  return {
    agentId: 'job_search',
    emoji: '🎯',
    status: 'available',
    name: { en: 'Job Search Expert', ru: '', kk: '', uz: '', zh: '' },
    description: { en: 'Find roles that match your profile', ru: '', kk: '', uz: '', zh: '' },
    promptHint: { en: '', ru: '', kk: '', uz: '', zh: '' },
    ...overrides,
  };
}

/**
 * Found via manual UI review: the `clinicInline` badge ("Start from Clinic
 * chat") is a full sentence, not a short status word like the other badge
 * kinds -- the corner pill's `max-w-[55%] truncate` cut it off mid-word
 * ("Start from Clinic c...") on the narrower desktop card grid. The same
 * text already renders in full at the bottom of the card, so the fix skips
 * the pill entirely for this one kind rather than widening it.
 */
describe('AgentCard clinicInline badge (found via manual review)', () => {
  let root: Root;
  let host: HTMLDivElement;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it('does not render a truncating corner pill for the clinicInline badge', async () => {
    await act(async () => {
      root.render(
        <AgentCard agent={agent()} locale="en" badge="clinicInline" />
      );
    });

    expect(host.querySelector('.truncate')).toBeNull();
    // The full, untruncated hint still renders (bottom of the card).
    expect(host.textContent).toContain('clinicInlineHint');
  });

  it('still renders the corner pill for other badge kinds (e.g. resumable)', async () => {
    await act(async () => {
      root.render(
        <AgentCard agent={agent()} locale="en" badge="resumable" />
      );
    });

    expect(host.querySelector('.truncate')).not.toBeNull();
  });
});
