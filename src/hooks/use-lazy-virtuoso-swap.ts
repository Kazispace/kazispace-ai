'use client';

import { useEffect, useRef, useState, type ComponentType } from 'react';

/**
 * Shared "keep static rows mounted until the Virtuoso chunk resolves" state
 * machine. Previously reimplemented identically in ClinicMessageList,
 * SpaceMessageList, and HubMessageList (KAZI-575/574/576) — every fix to
 * this swap logic needed three parallel patches. `loadComponent` must be a
 * referentially stable (module-scope) function; it is not re-invoked once
 * the chunk has resolved.
 */
export function useLazyVirtuosoSwap<TProps extends object>(
  virtualize: boolean,
  loadComponent: () => Promise<ComponentType<TProps>>,
  scrollParentRef: { readonly current: HTMLElement | null }
): {
  VirtuosoComponent: ComponentType<TProps> | null;
  showVirtuoso: boolean;
  preservedScrollTop: number;
} {
  const [VirtuosoComponent, setVirtuosoComponent] = useState<ComponentType<TProps> | null>(
    null
  );
  const showingVirtuosoRef = useRef(false);
  const preservedScrollTopRef = useRef(0);

  useEffect(() => {
    if (!virtualize || VirtuosoComponent) return;
    let cancelled = false;
    void loadComponent()
      .then((comp) => {
        if (!cancelled) setVirtuosoComponent(() => comp);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [virtualize, VirtuosoComponent, loadComponent]);

  const showVirtuoso = virtualize && VirtuosoComponent != null;
  if (showVirtuoso && !showingVirtuosoRef.current) {
    preservedScrollTopRef.current = scrollParentRef.current?.scrollTop ?? 0;
  }
  showingVirtuosoRef.current = showVirtuoso;

  return {
    VirtuosoComponent,
    showVirtuoso,
    preservedScrollTop: preservedScrollTopRef.current,
  };
}
