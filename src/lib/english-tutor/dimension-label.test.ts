import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';

import en from '@/lib/i18n/en.json';
import zh from '@/lib/i18n/zh.json';
import { mergeMessages } from '@/lib/i18n/merge-messages';
import { dimensionLabel } from '@/lib/english-tutor/dimension-label';

import sample from './__fixtures__/kazi1064_review_components_sample.json';

// KAZI-1069 (comment 13669 ②): the real library with the real messages — a hand-written
// translator only encodes our belief about next-intl, which is what KAZI-1064 got wrong.
const zhMessages = mergeMessages(en, zh) as typeof en;
const tZh = createTranslator({ locale: 'zh', messages: zhMessages, namespace: 'english.envelope' });

const zhDims = (zh as { english: { envelope: { dimensions: Record<string, string> } } }).english
  .envelope.dimensions;

describe('dimensionLabel (KAZI-1064)', () => {
  it('localises every backend dimension id in the real sample', () => {
    const t = tZh;
    const comps = (sample as { custom_components: { dimensions?: { id: string; label: string }[] }[] })
      .custom_components;
    const dims = comps.flatMap((c) => c.dimensions ?? []);
    expect(dims.length).toBeGreaterThan(0);
    for (const d of dims) {
      const label = dimensionLabel(t, { key: d.id, label: d.label });
      expect(label).not.toMatch(/^english\.envelope/);
      expect(label).toBe(zhDims[d.id]);
    }
  });

  it('falls back to the backend label, never to the key path', () => {
    const t = tZh;
    expect(dimensionLabel(t, { key: 'Task Response', label: 'Task response' })).toBe('Task response');
    expect(dimensionLabel(t, { key: 'unknown_dim' })).toBe('unknown_dim');
  });
});

describe('the library behaviour that makes t.has necessary (KAZI-1064 · 13666)', () => {
  it('does not honour defaultValue on a missing key', () => {
    const t = createTranslator({
      locale: 'zh',
      messages: zhMessages,
      namespace: 'english.envelope',
      onError: () => undefined,
    }) as unknown as (key: string, values?: Record<string, unknown>) => string;
    const out = t('dimensions.no_such_dimension', { defaultValue: 'fallback' });
    expect(out).not.toBe('fallback');
    expect(out).toContain('no_such_dimension');
  });
});
