import { describe, expect, it } from 'vitest';

import {
  parseCitationList,
  stripMarkdownSourcesSection,
} from '@/lib/clinic/citation-list';

describe('parseCitationList', () => {
  it('returns null when missing or empty', () => {
    expect(parseCitationList(undefined)).toBeNull();
    expect(parseCitationList([])).toBeNull();
    expect(
      parseCitationList([{ type: 'citation_list', items: [] }]),
    ).toBeNull();
  });

  it('parses citation_list items with url + title', () => {
    const parsed = parseCitationList([
      {
        type: 'citation_list',
        items: [
          { url: 'https://a.example/path', title: '官网', snippet: 'hi' },
          { url: 'https://b.example/long/path', title: '' },
        ],
      },
    ]);
    expect(parsed?.items).toHaveLength(2);
    expect(parsed?.items[0]).toEqual({
      url: 'https://a.example/path',
      title: '官网',
    });
    expect(parsed?.items[1]?.title).toBe('b.example');
  });
});

describe('stripMarkdownSourcesSection', () => {
  it('removes trailing 信息来源 block', () => {
    const content =
      '## 正文\n\nok\n\n## 信息来源\n📚 共 1 个来源\n- [a](https://a.example)';
    expect(stripMarkdownSourcesSection(content)).toBe('## 正文\n\nok');
  });

  it('strips only from the last sources heading', () => {
    const content = [
      '## 说明',
      '',
      '前文',
      '',
      '## 信息来源',
      '',
      '仍属正文',
      '',
      '## 信息来源',
      '📚 共 1 个来源',
      '- [a](https://a.example)',
    ].join('\n');
    const stripped = stripMarkdownSourcesSection(content);
    expect(stripped).toContain('仍属正文');
    expect(stripped).toContain('## 信息来源');
    expect(stripped).not.toContain('📚');
  });
});
