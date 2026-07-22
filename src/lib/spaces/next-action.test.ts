import { describe, expect, it } from 'vitest';

import { resolveSpaceNextActionHref } from '@/lib/spaces/next-action';

describe('resolveSpaceNextActionHref', () => {
  it('prefers locale-prefixed path from BE', () => {
    expect(
      resolveSpaceNextActionHref('zh', {
        type: 'open_interview',
        path: '/zh/interview',
      })
    ).toBe('/zh/interview');
  });

  it('prefixes locale onto absolute app paths', () => {
    expect(
      resolveSpaceNextActionHref('ru', {
        type: 'mock_interview',
        path: '/interview',
      })
    ).toBe('/ru/interview');
  });

  it('maps interview CTAs without path', () => {
    expect(
      resolveSpaceNextActionHref('en', { type: 'mock_interview' })
    ).toBe('/en/interview');
    expect(
      resolveSpaceNextActionHref('en', { type: 'open_interview' })
    ).toBe('/en/interview');
  });

  it('rejects external http(s) paths', () => {
    expect(
      resolveSpaceNextActionHref('en', {
        type: 'open_list',
        path: 'https://example.com/jobs',
      })
    ).toBeNull();
  });

  it('returns null for unknown types without path', () => {
    expect(
      resolveSpaceNextActionHref('en', { type: 'totally_unknown' })
    ).toBeNull();
  });
});
