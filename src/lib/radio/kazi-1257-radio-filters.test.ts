/**
 * KAZI-1257 E — story filters from GET /radio/facets (kazispace-ui personal-radio.md, Filtering and sorting stories).
 */
import { describe, expect, it } from 'vitest';

import {
  EMPTY_RADIO_SELECTION,
  pruneRadioSelection,
  radioCopyKey,
  radioFilterBar,
  radioSelectionIsEmpty,
  radioStoryQuery,
} from '@/lib/radio/filters';
import type { RadioFacets } from '@/types/radio';

/** The shape the server returns today (backend facets.public, vocabulary 1). */
const FACETS: RadioFacets = {
  vocab_version: 1,
  source: 'chengdu',
  fetched_at: '2026-11-07T03:05:00Z',
  filters: [
    { key: 'suspense', type: 'int_range', values: { min: 0, max: 3 }, params: ['suspense_min', 'suspense_max'] },
    { key: 'age_range', type: 'enum_multi', values: ['kids', 'teens', 'adults'], params: ['age_range'] },
    { key: 'genre', type: 'enum', values: ['mystery', 'adventure', 'comedy', 'daily_life', 'scifi', 'history'], params: ['genre'] },
    { key: 'base_cefr', type: 'enum', values: ['A2', 'B1', 'B2', 'C1'], params: ['cefr'] },
    { key: 'duration_s_est', type: 'int', values: { min: 0 }, params: ['duration_max_s'] },
  ],
  sorts: ['suspense', 'popularity', 'novelty', 'completion_rate', 'updated'],
};

describe('radioFilterBar', () => {
  it('offers the four known controls in order, and every known sort', () => {
    const bar = radioFilterBar(FACETS)!;
    expect(bar.controls.map((c) => [c.key, c.param])).toEqual([
      ['genre', 'genre'],
      ['suspense', 'suspense_min'],
      ['age_range', 'age_range'],
      ['base_cefr', 'cefr'],
    ]);
    expect(bar.controls[1]).toMatchObject({ kind: 'atLeast', options: [1, 2, 3] });
    expect(bar.sorts).toEqual(FACETS.sorts);
  });

  it('a key, value or sort the app has no copy for gets no control (never a raw value)', () => {
    const bar = radioFilterBar({
      ...FACETS,
      filters: [
        { key: 'genre', type: 'enum', values: ['mystery', 'romance'], params: ['genre'] },
        { key: 'mood', type: 'enum', values: ['calm'], params: ['mood'] },
      ],
      sorts: ['suspense', 'trending'],
    })!;
    expect(bar.controls).toEqual([{ kind: 'multi', key: 'genre', param: 'genre', options: ['mystery'] }]);
    expect(bar.sorts).toEqual(['suspense']);
  });

  it('parameter names come from params, not from the app', () => {
    const bar = radioFilterBar({
      ...FACETS,
      filters: [{ key: 'suspense', type: 'int_range', values: { min: 1, max: 2 }, params: ['s_max', 'tension_min'] }],
    })!;
    expect(bar.controls[0]).toMatchObject({ param: 'tension_min', options: [2] });
  });

  it('nothing the app knows, or no facets at all ⇒ no filter row', () => {
    expect(radioFilterBar(null)).toBeNull();
    expect(radioFilterBar({ ...FACETS, filters: [FACETS.filters[4]], sorts: [] })).toBeNull();
  });
});

describe('selection and query', () => {
  const bar = radioFilterBar(FACETS)!;

  it('builds the GET /stories query: comma = any of, suspense as a minimum, sort', () => {
    const q = radioStoryQuery(
      { multi: { genre: ['mystery', 'comedy'], base_cefr: ['B1'] }, suspenseAtLeast: 2, sort: 'popularity' },
      bar
    );
    expect(q.toString()).toBe('genre=mystery%2Ccomedy&suspense_min=2&cefr=B1&sort=popularity');
    expect(radioStoryQuery(EMPTY_RADIO_SELECTION, bar).toString()).toBe('');
    expect(radioSelectionIsEmpty(EMPTY_RADIO_SELECTION)).toBe(true);
    expect(radioSelectionIsEmpty({ ...EMPTY_RADIO_SELECTION, multi: { genre: [] } })).toBe(true);
  });

  it('pruning keeps only what the new filters still offer', () => {
    const narrower = radioFilterBar({
      ...FACETS,
      filters: [{ key: 'genre', type: 'enum', values: ['comedy'], params: ['genre'] }],
      sorts: ['updated'],
    });
    expect(
      pruneRadioSelection({ multi: { genre: ['mystery', 'comedy'], age_range: ['kids'] }, suspenseAtLeast: 2, sort: 'popularity' }, narrower)
    ).toEqual({ multi: { genre: ['comedy'] }, suspenseAtLeast: null, sort: null });
    expect(pruneRadioSelection({ ...EMPTY_RADIO_SELECTION, sort: 'updated' }, null)).toEqual(EMPTY_RADIO_SELECTION);
  });

  it('copy keys: snake_case values become camelCase', () => {
    expect(radioCopyKey('daily_life')).toBe('dailyLife');
    expect(radioCopyKey('completion_rate')).toBe('completionRate');
    expect(radioCopyKey('mystery')).toBe('mystery');
  });
});
