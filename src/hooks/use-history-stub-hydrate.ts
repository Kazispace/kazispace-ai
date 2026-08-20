'use client';

import { useEffect, useRef } from 'react';

import { capHistoryHydrateIds, isHistoryStub } from '@/lib/chat/history-window';

type StubRow = {
  id: string;
  contentPending?: boolean;
};

/** Initial fetch + one automatic retry after a rejected hydrate. */
export const HISTORY_STUB_HYDRATE_MAX_ATTEMPTS = 2;

function stubNodes(root: HTMLElement, id: string): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(`[data-history-stub="${id}"]`)
  );
}

function setStubFailed(root: HTMLElement, id: string, failed: boolean) {
  for (const el of stubNodes(root, id)) {
    if (failed) {
      el.dataset.failed = 'true';
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-busy', 'false');
      el.setAttribute('aria-label', 'Retry loading message');
    } else {
      delete el.dataset.failed;
      el.removeAttribute('tabindex');
      el.removeAttribute('role');
      el.setAttribute('aria-busy', 'true');
      el.setAttribute('aria-label', 'Loading message');
    }
  }
}

/**
 * When a stub row enters the scroll viewport, hydrate full bodies by id.
 * IntersectionObserver for visibility; MutationObserver for Virtuoso mounts.
 * Transient hydrate failures retry once, then the stub is clickable.
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
  const attemptsRef = useRef(new Map<string, number>());

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
      for (const id of capped) {
        inFlightRef.current.add(id);
        setStubFailed(root, id, false);
      }

      let retryIds: string[] = [];
      void Promise.resolve(hydrateRef.current(capped))
        .then(() => {
          for (const id of capped) attemptsRef.current.delete(id);
        })
        .catch(() => {
          retryIds = [];
          for (const id of capped) {
            const next = (attemptsRef.current.get(id) ?? 0) + 1;
            attemptsRef.current.set(id, next);
            if (next < HISTORY_STUB_HYDRATE_MAX_ATTEMPTS) {
              retryIds.push(id);
            } else {
              setStubFailed(root, id, true);
            }
          }
        })
        .finally(() => {
          for (const id of capped) inFlightRef.current.delete(id);
        })
        .then(() => {
          if (retryIds.length > 0) flush(retryIds);
        });
    };

    const retryFailedStub = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const stub = target.closest('[data-history-stub]');
      if (!(stub instanceof HTMLElement) || stub.dataset.failed !== 'true') {
        return;
      }
      if (event instanceof KeyboardEvent) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
      }
      const id = stub.dataset.historyStub;
      if (!id) return;
      attemptsRef.current.delete(id);
      setStubFailed(root, id, false);
      flush([id]);
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
    root.addEventListener('click', retryFailedStub);
    root.addEventListener('keydown', retryFailedStub);
    return () => {
      root.removeEventListener('click', retryFailedStub);
      root.removeEventListener('keydown', retryFailedStub);
      mutations.disconnect();
      observer.disconnect();
    };
  }, [opts.enabled, opts.scrollRoot, hasStubs, opts.messages]);
}
