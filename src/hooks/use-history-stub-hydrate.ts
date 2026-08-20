'use client';

import { useEffect, useRef } from 'react';

import { capHistoryHydrateIds, isHistoryStub } from '@/lib/chat/history-window';

type StubRow = {
  id: string;
  contentPending?: boolean;
};

/**
 * When a stub row enters the scroll viewport, hydrate full bodies by id.
 * IntersectionObserver for visibility; MutationObserver for Virtuoso mounts.
 * No setTimeout/debounce to fake smoothness.
 */
export function useHistoryStubHydrate(opts: {
  enabled: boolean;
  messages: StubRow[];
  scrollRoot: { readonly current: HTMLElement | null };
  hydrate: (ids: string[]) => Promise<void> | void;
}) {
  const hydrateRef = useRef(opts.hydrate);
  hydrateRef.current = opts.hydrate;
  const inFlightRef = useRef(new Set<string>());

  const hasStubs = opts.messages.some((row) => isHistoryStub(row));

  useEffect(() => {
    if (!opts.enabled || !hasStubs) return;
    const root = opts.scrollRoot.current;
    if (!root) return;

    const flush = (ids: string[]) => {
      const capped = capHistoryHydrateIds(
        ids.filter((id) => !inFlightRef.current.has(id))
      );
      if (capped.length === 0) return;
      for (const id of capped) inFlightRef.current.add(id);
      void Promise.resolve(hydrateRef.current(capped)).finally(() => {
        for (const id of capped) inFlightRef.current.delete(id);
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const ids: string[] = [];
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = (entry.target as HTMLElement).dataset.historyStub;
          if (id) ids.push(id);
        }
        if (ids.length > 0) flush(ids);
      },
      { root, rootMargin: '160px 0px', threshold: 0 }
    );

    // Virtuoso only mounts rows in/near the viewport. Re-scan when those
    // nodes appear — MutationObserver, not setTimeout.
    const scan = () => {
      root.querySelectorAll('[data-history-stub]').forEach((node) => {
        observer.observe(node);
      });
    };
    scan();
    const mutations = new MutationObserver(scan);
    mutations.observe(root, { childList: true, subtree: true });
    return () => {
      mutations.disconnect();
      observer.disconnect();
    };
  }, [opts.enabled, opts.scrollRoot, hasStubs, opts.messages]);
}
