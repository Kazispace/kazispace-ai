'use client';

import { useSyncExternalStore } from 'react';

const DESKTOP_MEDIA_QUERY = '(min-width: 768px)';

function subscribe(onStoreChange: () => void): () => void {
  const media = window.matchMedia(DESKTOP_MEDIA_QUERY);
  media.addEventListener('change', onStoreChange);
  return () => media.removeEventListener('change', onStoreChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
}

/** SSR + first paint: treat as mobile so pin/layout matches until client snapshot applies. */
function getServerSnapshot(): boolean {
  return false;
}

/** Tailwind `md` breakpoint via useSyncExternalStore — no hydration mismatch warning.
 *  Keep in sync with Tailwind `screens.md` (768px default). */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
