'use client';

import { useEffect, useState } from 'react';

import { listSpaceTemplates } from '@/lib/spaces-api';
import { MVP_SPACE_TEMPLATE_IDS } from '@/lib/spaces/constants';
import type { SpaceTemplateItem } from '@/types/spaces';

function fallbackMvpTemplates(): SpaceTemplateItem[] {
  return MVP_SPACE_TEMPLATE_IDS.map((template_id) => ({
    template_id,
    display_name: template_id,
    mvp: true,
  }));
}

export function useSpaceTemplates(open: boolean) {
  const [templates, setTemplates] = useState<SpaceTemplateItem[]>(fallbackMvpTemplates);
  const [comingSoon, setComingSoon] = useState<SpaceTemplateItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [usedFallback, setUsedFallback] = useState(true);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setIsLoading(true);

    void (async () => {
      const res = await listSpaceTemplates();
      if (cancelled) return;
      setIsLoading(false);

      if (res.success && res.data?.templates?.length) {
        setTemplates(res.data.templates);
        setComingSoon(res.data.coming_soon ?? []);
        setUsedFallback(false);
        return;
      }

      setTemplates(fallbackMvpTemplates());
      setComingSoon([]);
      setUsedFallback(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  return { templates, comingSoon, isLoading, usedFallback };
}
