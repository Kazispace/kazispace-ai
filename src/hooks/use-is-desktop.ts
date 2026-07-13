'use client';

import { useEffect, useState } from 'react';

const DESKTOP_MEDIA_QUERY = '(min-width: 768px)';

/** Tailwind `md` breakpoint — false until client hydration. */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return isDesktop;
}
