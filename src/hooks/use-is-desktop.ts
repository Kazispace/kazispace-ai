'use client';

import { useEffect, useState } from 'react';

const DESKTOP_MEDIA_QUERY = '(min-width: 768px)';

function readIsDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
}

/** Tailwind `md` breakpoint — sync on first client render to avoid nav pin flash. */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(readIsDesktop);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return isDesktop;
}
