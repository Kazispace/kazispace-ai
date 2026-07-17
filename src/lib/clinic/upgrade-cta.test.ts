import { describe, expect, it } from 'vitest';

import {
  buildResearchHandoffMessage,
  looksLikeResearchRequest,
  parseUpgradeCta,
} from '@/lib/clinic/upgrade-cta';
import { parseAssistantEnvelope } from '@/lib/chat-envelope';

describe('parseUpgradeCta (KAZI-233)', () => {
  it('parses meta.upgrade_cta with seed', () => {
    const cta = parseUpgradeCta({
      upgrade_cta: {
        upgrade_to: 'research',
        label: '需要更深入研究吗？',
        seed: {
          question: '成都 OPC 入驻',
          playbook_id: 'office_entry_policy',
          citations: [
            { url: 'https://example.com/a', title: 'A', snippet: 'x' },
          ],
        },
      },
    });
    expect(cta?.upgrade_to).toBe('research');
    expect(cta?.label).toContain('深入研究');
    expect(cta?.seed.question).toBe('成都 OPC 入驻');
    expect(cta?.seed.playbook_id).toBe('office_entry_policy');
    expect(cta?.seed.citations).toEqual([
      { url: 'https://example.com/a', title: 'A', snippet: 'x' },
    ]);
  });

  it('accepts meta.cta alias', () => {
    const cta = parseUpgradeCta({
      cta: {
        upgrade_to: 'research',
        label: 'Want a deeper research report?',
        seed: { question: 'Who is X?', citations: [] },
      },
    });
    expect(cta?.seed.question).toBe('Who is X?');
  });

  it('returns null for missing / invalid payloads (no crash)', () => {
    expect(parseUpgradeCta(undefined)).toBeNull();
    expect(parseUpgradeCta({})).toBeNull();
    expect(
      parseUpgradeCta({ upgrade_cta: { upgrade_to: 'research' } })
    ).toBeNull();
    expect(
      parseUpgradeCta({
        upgrade_cta: {
          upgrade_to: 'other',
          seed: { question: 'q', citations: [] },
        },
      })
    ).toBeNull();
  });
});

describe('parseAssistantEnvelope upgrade_cta', () => {
  it('maps upgrade_cta from assistant_response.meta', () => {
    const parsed = parseAssistantEnvelope({
      assistant_response: {
        content: 'Short answer',
        meta: {
          upgrade_cta: {
            upgrade_to: 'research',
            label: '需要更深入研究吗？',
            seed: {
              question: 'q',
              citations: [{ url: 'https://x.example', title: 'X' }],
            },
          },
        },
      },
    });
    expect(parsed.upgradeCta?.seed.question).toBe('q');
    expect(parsed.upgradeCta?.seed.citations[0]?.url).toBe('https://x.example');
  });
});

describe('research handoff helpers', () => {
  it('looksLikeResearchRequest matches BE markers', () => {
    expect(looksLikeResearchRequest('帮我深入研究入驻')).toBe(true);
    expect(looksLikeResearchRequest('Please do in-depth research')).toBe(true);
    expect(looksLikeResearchRequest('查一下天气')).toBe(false);
  });

  it('buildResearchHandoffMessage packs seed for zh', () => {
    const text = buildResearchHandoffMessage(
      {
        question: 'OPC 入驻',
        citations: [{ url: 'https://a.example', title: '官网' }],
      },
      'zh'
    );
    expect(text).toContain('帮我深入研究：OPC 入驻');
    expect(text).toContain('https://a.example');
    expect(text).toContain('官网');
  });

  it('buildResearchHandoffMessage uses English marker for non-zh', () => {
    const text = buildResearchHandoffMessage(
      { question: 'OPC entry', citations: [] },
      'en'
    );
    expect(text).toBe('Please do in-depth research: OPC entry');
  });
});
