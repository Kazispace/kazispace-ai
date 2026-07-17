import { describe, expect, it } from 'vitest';

import { playbookChipTitle, resolveSearchCapability } from '@/lib/clinic/search-capability';
import { parseAssistantEnvelope } from '@/lib/chat-envelope';

describe('resolveSearchCapability (KAZI-234)', () => {
  it('reads meta.capability_id and playbook_id', () => {
    expect(
      resolveSearchCapability({
        meta: {
          capability_id: 'web_search',
          playbook_id: 'office_entry_policy',
        },
      })
    ).toEqual({
      capabilityId: 'web_search',
      playbookId: 'office_entry_policy',
    });
  });

  it('preserves null playbook_id (unbound)', () => {
    expect(
      resolveSearchCapability({
        meta: { capability_id: 'research', playbook_id: null },
      })
    ).toEqual({ capabilityId: 'research', playbookId: null });
  });

  it('falls back to intent / top-level capability_id', () => {
    expect(resolveSearchCapability({ intent: 'web_search' })).toEqual({
      capabilityId: 'web_search',
    });
    expect(
      resolveSearchCapability({ topLevelCapabilityId: 'research' })
    ).toEqual({ capabilityId: 'research' });
  });

  it('ignores unknown capability ids', () => {
    expect(
      resolveSearchCapability({ meta: { capability_id: 'job_search' } })
    ).toEqual({});
  });
});

describe('playbookChipTitle', () => {
  const labels = {
    bound: (id: string) => `Playbook: ${id}`,
    unbound: 'General search',
  };

  it('omits tooltip when playbookId is undefined', () => {
    expect(playbookChipTitle(undefined, labels)).toBeUndefined();
  });

  it('uses unbound label for null', () => {
    expect(playbookChipTitle(null, labels)).toBe('General search');
  });

  it('uses bound label for string id', () => {
    expect(playbookChipTitle('office_entry_policy', labels)).toBe(
      'Playbook: office_entry_policy'
    );
  });
});

describe('parseAssistantEnvelope search capability', () => {
  it('maps capability + citations from web_search envelope', () => {
    const parsed = parseAssistantEnvelope({
      intent: 'web_search',
      assistant_response: {
        content: 'Short answer',
        custom_components: [
          {
            type: 'citation_list',
            items: [{ url: 'https://a.example', title: 'A' }],
          },
        ],
        meta: {
          capability_id: 'web_search',
          playbook_id: 'office_entry_policy',
        },
      },
    });
    expect(parsed.capabilityId).toBe('web_search');
    expect(parsed.playbookId).toBe('office_entry_policy');
    expect(parsed.citations).toEqual([
      { url: 'https://a.example', title: 'A' },
    ]);
  });

  it('maps research capability without regressing markdown body', () => {
    const body = '## Guide\n\nLong research…\n\n## 信息来源\n- [x](https://x.example)';
    const parsed = parseAssistantEnvelope({
      assistant_response: {
        content: body,
        meta: { capability_id: 'research', playbook_id: null },
        custom_components: [
          {
            type: 'citation_list',
            items: [{ url: 'https://x.example', title: 'X' }],
          },
        ],
      },
    });
    expect(parsed.capabilityId).toBe('research');
    expect(parsed.playbookId).toBeNull();
    expect(parsed.reply).toBe(body);
    expect(parsed.citations?.[0]?.url).toBe('https://x.example');
  });
});
