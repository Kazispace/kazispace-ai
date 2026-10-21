import { describe, expect, it } from 'vitest';

import {
  looksLikeResearchRequest,
  playbookChipTitle,
  resolveSearchCapability,
} from '@/lib/clinic/search-capability';
import { parseAssistantEnvelope } from '@/lib/chat-envelope';
import zh from '@/lib/i18n/zh.json';
import en from '@/lib/i18n/en.json';
import ru from '@/lib/i18n/ru.json';
import kk from '@/lib/i18n/kk.json';
import uz from '@/lib/i18n/uz.json';

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

describe('looksLikeResearchRequest (waiting copy only)', () => {
  it('matches explicit research phrasings', () => {
    expect(looksLikeResearchRequest('帮我深入研究入驻')).toBe(true);
    expect(looksLikeResearchRequest('Please do in-depth research')).toBe(true);
    expect(looksLikeResearchRequest('查一下天气')).toBe(false);
  });
});

describe('deep-research upgrade offer (KAZI-1137)', () => {
  it('is not read from assistant_response.meta any more', () => {
    const envelope = parseAssistantEnvelope({
      assistant_response: {
        content: '短答',
        meta: {
          capability_id: 'web_search',
          upgrade_cta: {
            upgrade_to: 'research',
            seed: { question: '入驻政策', citations: [] },
          },
        },
      },
    });
    expect(envelope).not.toHaveProperty('upgradeCta');
    expect(envelope?.capabilityId).toBe('web_search');
  });
});

describe('one search label in every locale file (KAZI-1137)', () => {
  const files = { zh, en, ru, kk, uz } as Record<string, Record<string, unknown>>;

  it('has chat.capability.search and no separate quick/deep labels or upgrade copy', () => {
    for (const [locale, messages] of Object.entries(files)) {
      const chat = (messages.chat ?? {}) as Record<string, unknown>;
      const capability = (chat.capability ?? {}) as Record<string, unknown>;
      if (Object.keys(capability).length > 0) {
        expect(typeof capability.search, locale).toBe('string');
      }
      expect(capability, locale).not.toHaveProperty('web_search');
      expect(capability, locale).not.toHaveProperty('research');
      expect(chat, locale).not.toHaveProperty('upgradeResearch');
      expect(chat, locale).not.toHaveProperty('processingResearch');
      expect(chat, locale).not.toHaveProperty('processingWebSearch');
    }
    expect((zh.chat as { capability: { search: string } }).capability.search).toBe('查询资料');
  });
});
