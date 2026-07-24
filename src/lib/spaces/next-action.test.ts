import { describe, expect, it } from 'vitest';

import { resolveNextActionHref } from '@/lib/next-action/resolve';

describe('resolveNextActionHref', () => {
  it('prefers locale-prefixed path from BE', () => {
    expect(
      resolveNextActionHref('zh', {
        type: 'open_interview',
        path: '/zh/interview',
      })
    ).toBe('/zh/interview');
  });

  it('prefixes locale onto absolute app paths', () => {
    expect(
      resolveNextActionHref('ru', {
        type: 'mock_interview',
        path: '/interview',
      })
    ).toBe('/ru/interview');
  });

  it('deep-links open_interview only (not mock_interview type alone)', () => {
    expect(
      resolveNextActionHref('en', { type: 'mock_interview' })
    ).toBeNull();
    expect(
      resolveNextActionHref('en', { type: 'open_interview' })
    ).toBe('/en/interview');
  });

  it('rejects external http(s) paths', () => {
    expect(
      resolveNextActionHref('en', {
        type: 'open_list',
        path: 'https://example.com/jobs',
      })
    ).toBeNull();
  });

  it('returns null for unknown types without path', () => {
    expect(
      resolveNextActionHref('en', { type: 'totally_unknown' })
    ).toBeNull();
  });
});
