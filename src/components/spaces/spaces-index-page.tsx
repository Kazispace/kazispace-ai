'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { SpaceWorkspaceLoading } from '@/components/spaces/space-workspace-states';
import { useAuthReady } from '@/hooks/use-auth-ready';
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
 *
 * It decides once, and only after the first list load has settled: before that the
 * list is empty because nothing was asked yet, and acting on it sent the Space tab
 * to `/chat` and created a new English Space on every visit (KAZI-1171 UAT 14205).
 * If the list cannot be loaded it goes to the main chat rather than create a
 * Space it cannot check for.
 */
export function SpacesIndexPage({ locale }: SpacesIndexPageProps) {
  const router = useRouter();
  const requested = useSearchParams()?.get('template') ?? '';
  const template = isSupportedSpaceTemplate(requested) ? requested : null;
  const { ready: authReady, authenticated } = useAuthReady();
  const { spaces, hasLoaded, error, enabled } = useSpaces({ fetchImmediately: true, locale });
  const latestUserSpace = useMemo(() => pickLatestUserSpace(spaces), [spaces]);
  const latestOfTemplate = useMemo(
    () => (template ? pickLatestUserSpaceOfTemplate(spaces, template) : null),
    [spaces, template]
  );
  // One decision per visit: later list refreshes (focus, invalidate after create) must not
  // re-route or create again.
  const decided = useRef(false);

  useEffect(() => {
    if (decided.current || !authReady) return;

    const open = (spaceId: string) =>
      router.replace(`/${locale}/spaces/${encodeURIComponent(spaceId)}`);
    const toChat = () => router.replace(`/${locale}/chat`);

    if (!authenticated || !enabled) {
      decided.current = true;
      toChat();
      return;
    }
    if (!hasLoaded) return;
    decided.current = true;

    if (template) {
      if (latestOfTemplate) {
        open(latestOfTemplate.id);
        return;
      }
      if (error) {
        toChat();
        return;
      }
      void createSpace({ template_id: template }).then((res) => {
        if (res.success && res.data) {
          open(res.data.id);
          return;
        }
        // Could not create it: fall back to the main chat rather than a dead end.
        toChat();
      });
      return;
    }

    if (latestUserSpace) {
      open(latestUserSpace.id);
      return;
    }

    toChat();
  }, [
    authReady,
    authenticated,
    enabled,
    hasLoaded,
    error,
    latestUserSpace,
    latestOfTemplate,
    template,
    locale,
    router,
  ]);

  return <SpaceWorkspaceLoading />;
}
