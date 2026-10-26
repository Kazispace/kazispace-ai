'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { SpaceWorkspaceLoading } from '@/components/spaces/space-workspace-states';
import { useSpaces } from '@/hooks/use-spaces';
import { createSpace } from '@/lib/spaces-api';
import { isSupportedSpaceTemplate } from '@/lib/spaces/constants';
import { pickLatestUserSpace, pickLatestUserSpaceOfTemplate } from '@/lib/spaces/routes';

interface SpacesIndexPageProps {
  locale: string;
}

/**
 * `/spaces` resolver only — no main-area UI.
 * Latest user space → `/spaces/{id}`; otherwise Clinic (`/chat`).
 * Create space: sidebar panel 「+ 新建空间」 only (SessionNavPanel).
 *
 * `?template=<id>` (KAZI-1171): open the user's latest active Space of that
 * template, or create one when there is none. The English tutor's entry uses
 * it (`ielts_prep`) now that the `/english` page is gone.
 */
export function SpacesIndexPage({ locale }: SpacesIndexPageProps) {
  const router = useRouter();
  const requested = useSearchParams()?.get('template') ?? '';
  const template = isSupportedSpaceTemplate(requested) ? requested : null;
  const { spaces, isLoading } = useSpaces({ fetchImmediately: true, locale });
  const latestUserSpace = useMemo(() => pickLatestUserSpace(spaces), [spaces]);
  const latestOfTemplate = useMemo(
    () => (template ? pickLatestUserSpaceOfTemplate(spaces, template) : null),
    [spaces, template]
  );
  // One create per visit: the effect re-runs when the list refreshes.
  const creating = useRef(false);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const open = (spaceId: string) =>
      router.replace(`/${locale}/spaces/${encodeURIComponent(spaceId)}`);

    if (template) {
      if (latestOfTemplate) {
        open(latestOfTemplate.id);
        return;
      }
      if (creating.current) return;
      creating.current = true;
      void createSpace({ template_id: template }).then((res) => {
        if (res.success && res.data) {
          open(res.data.id);
          return;
        }
        // Could not create it: fall back to the main chat rather than a dead end.
        router.replace(`/${locale}/chat`);
      });
      return;
    }

    if (latestUserSpace) {
      open(latestUserSpace.id);
      return;
    }

    router.replace(`/${locale}/chat`);
  }, [isLoading, latestUserSpace, latestOfTemplate, template, locale, router]);

  return <SpaceWorkspaceLoading />;
}
