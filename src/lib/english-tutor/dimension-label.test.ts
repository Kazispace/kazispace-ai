import { describe, expect, it } from 'vitest';

import zh from '@/lib/i18n/zh.json';
import { dimensionLabel, type DimensionTranslator } from '@/lib/english-tutor/dimension-label';

import sample from './__fixtures__/kazi1064_review_components_sample.json';

function translatorFrom(messages: Record<string, string>): DimensionTranslator {
  const t = ((key: string) => {
    const leaf = key.replace(/^dimensions\./, '');
    return messages[leaf] ?? `english.envelope.${key}`; // next-intl renders the key path on a miss
  }) as DimensionTranslator;
  t.has = (key: string) => key.replace(/^dimensions\./, '') in messages;
  return t;
}

const zhDims = (zh as { english: { envelope: { dimensions: Record<string, string> } } }).english
  .envelope.dimensions;

describe('dimensionLabel (KAZI-1064)', () => {
  it('localises every backend dimension id in the real sample', () => {
    const t = translatorFrom(zhDims);
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
    const t = translatorFrom(zhDims);
    expect(dimensionLabel(t, { key: 'Task Response', label: 'Task response' })).toBe('Task response');
    expect(dimensionLabel(t, { key: 'unknown_dim' })).toBe('unknown_dim');
  });
});
