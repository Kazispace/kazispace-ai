'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getRadioFacets, getRadioStories, radioAccessOf } from '@/lib/radio/api';
import {
  EMPTY_RADIO_SELECTION,
  pruneRadioSelection,
  radioCopyKey,
  radioFilterBar,
  radioSelectionIsEmpty,
  radioStoryQuery,
  RADIO_GENRES,
  type RadioFilterBar,
  type RadioFilterSelection,
} from '@/lib/radio/filters';
import { cn } from '@/lib/utils';
import type { RadioFacets, RadioStorySummary } from '@/types/radio';

export const RADIO_FACETS_KEY = ['radio-facets'] as const;
const FACET_ERRORS = new Set(['unknown_facet', 'bad_facet_value']);

async function fetchFacets(): Promise<RadioFacets | null> {
  const res = await getRadioFacets();
  return res.success && res.data ? res.data : null;
}

export interface StoryFilterState {
  bar: RadioFilterBar | null;
  selection: RadioFilterSelection;
  setSelection: (sel: RadioFilterSelection) => void;
  clear: () => void;
  /** `true` while anything is chosen: the list is `stories`, not the home's. */
  active: boolean;
  stories: RadioStorySummary[] | null;
  loading: boolean;
  failed: boolean;
  retry: () => void;
}

/**
 * Filters for the story library (kazispace-ui personal-radio.md, Filtering and sorting stories).
 * Held in component state only: leaving the radio home clears them.
 */
export function useStoryFilters({
  enabled,
  onReset,
  onClosed,
}: {
  enabled: boolean;
  /** A second `400` cleared the filters (toast `radio.home.filter.reset`). */
  onReset: () => void;
  /** `404` / `403`: read as Who sees it, not as a filter failure. */
  onClosed: () => void;
}): StoryFilterState {
  const queryClient = useQueryClient();
  const facets = useQuery({ queryKey: RADIO_FACETS_KEY, queryFn: fetchFacets, enabled, staleTime: 300_000, retry: false });
  const bar = useMemo(() => radioFilterBar(facets.data), [facets.data]);
  const [selection, setSelection] = useState<RadioFilterSelection>(EMPTY_RADIO_SELECTION);
  const [stories, setStories] = useState<RadioStorySummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const seq = useRef(0);
  // A query the 400 fallback already answered: its own effect run must not send it again.
  const answered = useRef<string | null>(null);
  const active = !!bar && !radioSelectionIsEmpty(selection);
  const queryKey = active && bar ? radioStoryQuery(selection, bar).toString() : '';
  const latest = useRef({ bar, selection, onReset, onClosed });
  latest.current = { bar, selection, onReset, onClosed };

  useEffect(() => {
    const mine = ++seq.current;
    if (!queryKey) {
      setStories(null);
      setLoading(false);
      setFailed(false);
      return;
    }
    if (answered.current === queryKey) {
      answered.current = null;
      return;
    }
    const { bar: shown, selection: sel } = latest.current;
    if (!shown) return;
    setLoading(true);
    setFailed(false);
    const isFacetError = (r: { success: boolean; status?: number; errorCode?: string }) =>
      !r.success && r.status === 400 && FACET_ERRORS.has(r.errorCode ?? '');
    const reset = () => {
      setSelection(EMPTY_RADIO_SELECTION);
      setLoading(false);
      latest.current.onReset();
    };
    void (async () => {
      let res = await getRadioStories(radioStoryQuery(sel, shown));
      if (mine !== seq.current) return;
      if (isFacetError(res)) {
        // The server's filters changed between the two requests: read them again, drop what is gone, send once more.
        const fresh = radioFilterBar(await queryClient.fetchQuery({ queryKey: RADIO_FACETS_KEY, queryFn: fetchFacets, staleTime: 0 }));
        if (mine !== seq.current) return;
        const pruned = pruneRadioSelection(sel, fresh);
        if (!fresh || radioSelectionIsEmpty(pruned)) return reset();
        const prunedQuery = radioStoryQuery(pruned, fresh);
        res = await getRadioStories(prunedQuery);
        if (mine !== seq.current) return;
        if (isFacetError(res)) return reset();
        if (res.success && res.data) {
          answered.current = prunedQuery.toString();
          setSelection(pruned);
        }
      }
      setLoading(false);
      if (res.success && res.data) {
        setStories(res.data.stories);
      } else if (radioAccessOf(res) === 'closed') {
        latest.current.onClosed();
      } else {
        setFailed(true);
      }
    })();
  }, [queryKey, attempt, queryClient]);

  const clear = useCallback(() => setSelection(EMPTY_RADIO_SELECTION), []);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { bar, selection, setSelection, clear, active, stories, loading, failed, retry };
}

function Chip({ pressed, onClick, children, testId }: { pressed: boolean; onClick: () => void; children: React.ReactNode; testId: string }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      data-testid={testId}
      className={cn(
        'min-h-11 shrink-0 rounded-full border px-3 text-xs',
        pressed ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 bg-white text-workspace-secondary hover:border-primary'
      )}
    >
      {children}
    </button>
  );
}

/** The row above the story library. Renders nothing when the server offers nothing the app knows. */
export function StoryFilterBar({ state }: { state: StoryFilterState }) {
  const t = useTranslations('radio');
  const { bar, selection, setSelection, clear, active } = state;
  if (!bar) return null;

  const valueLabel = (key: string, value: string) =>
    key === 'genre' ? t(`genre.${radioCopyKey(value)}`) : key === 'age_range' ? t(`age.${value}`) : value;
  const groupLabel = (key: string) =>
    key === 'genre' ? t('home.filter.genre') : key === 'age_range' ? t('home.filter.age') : t('home.filter.level');

  return (
    <div data-testid="radio-story-filters" role="group" aria-label={t('home.sort.title')} className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
      {bar.sorts.length ? (
        <label className="flex shrink-0 items-center gap-1 text-xs text-workspace-muted">
          {t('home.sort.title')}
          <select
            data-testid="radio-sort"
            value={selection.sort ?? ''}
            onChange={(e) => setSelection({ ...selection, sort: e.target.value || null })}
            className="min-h-11 rounded-lg border border-gray-200 bg-white px-2 text-xs text-workspace-text"
          >
            <option value="">{t('home.sort.default')}</option>
            {bar.sorts.map((s) => (
              <option key={s} value={s}>
                {t(`home.sort.${radioCopyKey(s)}`)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {bar.controls.map((c) =>
        c.kind === 'atLeast' ? (
          <label key={c.key} className="flex shrink-0 items-center gap-1 text-xs text-workspace-muted">
            {t('home.filter.suspense')}
            <select
              data-testid="radio-filter-suspense"
              value={selection.suspenseAtLeast ?? ''}
              onChange={(e) => setSelection({ ...selection, suspenseAtLeast: e.target.value ? Number(e.target.value) : null })}
              className="min-h-11 rounded-lg border border-gray-200 bg-white px-2 text-xs text-workspace-text"
            >
              <option value="">{t('home.filter.any')}</option>
              {c.options.map((n) => (
                <option key={n} value={n}>
                  {t('home.filter.atLeast', { n })}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div key={c.key} role="group" aria-label={groupLabel(c.key)} className="flex shrink-0 items-center gap-1">
            <span className="text-xs text-workspace-muted">{groupLabel(c.key)}</span>
            {c.options.map((v) => {
              const chosen = selection.multi[c.key] ?? [];
              const on = chosen.includes(v);
              return (
                <Chip
                  key={v}
                  pressed={on}
                  testId={`radio-filter-${c.key}-${v}`}
                  onClick={() =>
                    setSelection({
                      ...selection,
                      multi: { ...selection.multi, [c.key]: on ? chosen.filter((x) => x !== v) : [...chosen, v] },
                    })
                  }
                >
                  {valueLabel(c.key, v)}
                </Chip>
              );
            })}
          </div>
        )
      )}
      {active ? (
        <button type="button" onClick={clear} data-testid="radio-filter-clear" className="min-h-11 shrink-0 text-xs text-primary underline">
          {t('home.filter.clear')}
        </button>
      ) : null}
    </div>
  );
}

/** A card's genre tag, when its genre has copy. */
export function storyGenreLabel(t: (key: string) => string, story: RadioStorySummary): string | null {
  const g = story.attrs?.genre;
  return g && (RADIO_GENRES as readonly string[]).includes(g) ? t(`genre.${radioCopyKey(g)}`) : null;
}
