/**
 * Story filters and sorting (KAZI-1257 E; kazispace-ui personal-radio.md, Filtering and sorting stories).
 *
 * The server says which filters and sorts exist (`GET /radio/facets`); nothing here hard-codes a
 * value list. The app only shows what it has copy for: a filter key outside `RADIO_FILTER_KEYS`, a
 * value outside its known set, or a sort outside `RADIO_SORTS` gets no control, so a new value on the
 * server means one option fewer here, never a raw value on screen. Parameter names come from
 * `params`, never from the app.
 */
import type { RadioFacetFilter, RadioFacets } from '@/types/radio';

export const RADIO_GENRES = ['mystery', 'adventure', 'comedy', 'daily_life', 'scifi', 'history'] as const;
export const RADIO_AGES = ['kids', 'teens', 'adults'] as const;
export const RADIO_CEFRS = ['A2', 'B1', 'B2', 'C1'] as const;
export const RADIO_SORTS = ['suspense', 'popularity', 'novelty', 'completion_rate', 'updated'] as const;

/** The controls the app knows, in the order they are shown. */
export type RadioFilterKey = 'genre' | 'suspense' | 'age_range' | 'base_cefr';
const KNOWN: Record<RadioFilterKey, readonly string[] | null> = {
  genre: RADIO_GENRES,
  suspense: null,
  age_range: RADIO_AGES,
  base_cefr: RADIO_CEFRS,
};
export const RADIO_FILTER_KEYS = Object.keys(KNOWN) as RadioFilterKey[];

/** A copy key's last part: `daily_life` ⇒ `dailyLife`, `completion_rate` ⇒ `completionRate`. */
export function radioCopyKey(value: string): string {
  return value.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

export interface RadioMultiControl {
  kind: 'multi';
  key: 'genre' | 'age_range' | 'base_cefr';
  param: string;
  options: string[];
}
export interface RadioAtLeastControl {
  kind: 'atLeast';
  key: 'suspense';
  param: string;
  options: number[];
}
export type RadioFilterControl = RadioMultiControl | RadioAtLeastControl;

export interface RadioFilterBar {
  controls: RadioFilterControl[];
  sorts: string[];
}

function control(f: RadioFacetFilter): RadioFilterControl | null {
  if (!(RADIO_FILTER_KEYS as string[]).includes(f.key)) return null;
  const key = f.key as RadioFilterKey;
  if (key === 'suspense') {
    const range = f.values as { min?: unknown; max?: unknown } | null;
    const param = f.params.find((p) => p.endsWith('_min'));
    if (f.type !== 'int_range' || !param || !range) return null;
    const { min, max } = range;
    if (!Number.isInteger(min) || !Number.isInteger(max)) return null;
    const options: number[] = [];
    for (let n = (min as number) + 1; n <= (max as number); n += 1) options.push(n);
    return options.length ? { kind: 'atLeast', key, param, options } : null;
  }
  const known = KNOWN[key] as readonly string[];
  const param = f.params[0];
  if ((f.type !== 'enum' && f.type !== 'enum_multi') || !param || !Array.isArray(f.values)) return null;
  const options = (f.values as unknown[]).filter((v): v is string => typeof v === 'string' && known.includes(v));
  return options.length ? { kind: 'multi', key, param, options } : null;
}

/** The controls and sorts to show; `null` when there is nothing the app can offer (no filter row). */
export function radioFilterBar(facets: RadioFacets | null | undefined): RadioFilterBar | null {
  if (!facets || !Array.isArray(facets.filters)) return null;
  const byKey = new Map<string, RadioFilterControl>();
  for (const f of facets.filters) {
    const c = control(f);
    if (c && !byKey.has(c.key)) byKey.set(c.key, c);
  }
  const controls = RADIO_FILTER_KEYS.map((k) => byKey.get(k)).filter((c): c is RadioFilterControl => !!c);
  const sorts = (facets.sorts ?? []).filter((s) => (RADIO_SORTS as readonly string[]).includes(s));
  return controls.length || sorts.length ? { controls, sorts } : null;
}

/** What the listener chose. Empty arrays / `null` = not chosen. */
export interface RadioFilterSelection {
  multi: Partial<Record<'genre' | 'age_range' | 'base_cefr', string[]>>;
  suspenseAtLeast: number | null;
  sort: string | null;
}

export const EMPTY_RADIO_SELECTION: RadioFilterSelection = { multi: {}, suspenseAtLeast: null, sort: null };

export function radioSelectionIsEmpty(sel: RadioFilterSelection): boolean {
  return sel.suspenseAtLeast === null && sel.sort === null && Object.values(sel.multi).every((v) => !v?.length);
}

/** Keep only the choices `bar` still offers (after the server's filters changed). */
export function pruneRadioSelection(sel: RadioFilterSelection, bar: RadioFilterBar | null): RadioFilterSelection {
  if (!bar) return EMPTY_RADIO_SELECTION;
  const multi: RadioFilterSelection['multi'] = {};
  let suspenseAtLeast: number | null = null;
  for (const c of bar.controls) {
    if (c.kind === 'multi') {
      const kept = (sel.multi[c.key] ?? []).filter((v) => c.options.includes(v));
      if (kept.length) multi[c.key] = kept;
    } else if (sel.suspenseAtLeast !== null && c.options.includes(sel.suspenseAtLeast)) {
      suspenseAtLeast = sel.suspenseAtLeast;
    }
  }
  const sort = sel.sort !== null && bar.sorts.includes(sel.sort) ? sel.sort : null;
  return { multi, suspenseAtLeast, sort };
}

/** The `GET /radio/stories` query for a selection; parameter names come from `bar` (i.e. `params`). */
export function radioStoryQuery(sel: RadioFilterSelection, bar: RadioFilterBar): URLSearchParams {
  const q = new URLSearchParams();
  for (const c of bar.controls) {
    if (c.kind === 'multi') {
      const vals = sel.multi[c.key];
      if (vals?.length) q.set(c.param, vals.join(','));
    } else if (sel.suspenseAtLeast !== null) {
      q.set(c.param, String(sel.suspenseAtLeast));
    }
  }
  if (sel.sort) q.set('sort', sel.sort);
  return q;
}
