import { describe, expect, it } from 'vitest';

import { splitMarkdownSources } from '@/lib/clinic/markdown-sources';

describe('splitMarkdownSources', () => {
  it('returns full body when no sources heading', () => {
    const content = '## 速览\n\n你好';
    expect(splitMarkdownSources(content)).toEqual({
      body: content,
      sourcesBody: null,
      sourcesSummary: null,
    });
  });

  it('splits 信息来源 and uses 📚 line as summary', () => {
    const content = [
      '## 速览',
      '',
      '结论',
      '',
      '## 信息来源',
      '📚 共 3 个来源',
      '- [官网](https://a.example)',
      '- [政策](https://b.example)',
    ].join('\n');

    const result = splitMarkdownSources(content);
    expect(result.body).toBe('## 速览\n\n结论');
    expect(result.sourcesSummary).toBe('📚 共 3 个来源');
    expect(result.sourcesBody).toContain('[官网](https://a.example)');
    expect(result.sourcesBody).not.toContain('📚');
  });

  it('falls back to link count for Sources heading', () => {
    const content = [
      'Hello',
      '',
      '## Sources',
      '- [One](https://a.example)',
      '- [Two](https://b.example)',
    ].join('\n');

    const result = splitMarkdownSources(content);
    expect(result.body).toBe('Hello');
    expect(result.sourcesSummary).toBe('📚 共 2 个来源');
    expect(result.sourcesBody).toContain('[One](https://a.example)');
  });
});
