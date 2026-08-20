'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { SpaceWorkspaceLoading } from '@/components/spaces/space-workspace-states';
import { useSpaces } from '@/hooks/use-spaces';
import { pickLatestUserSpace } from '@/lib/spaces/routes';

interface SpacesIndexPageProps {
  locale: string;
}

/**
 * `/spaces` resolver only — no main-area UI.
 * Latest user space → `/spaces/{id}`; otherwise Clinic (`/chat`).
 * Create space: sidebar panel 「+ 新建空间」 only (SessionNavPanel).
 */
export function SpacesIndexPage({ locale }: SpacesIndexPageProps) {
  const router = useRouter();
  const { spaces, isLoading } = useSpaces({ fetchImmediately: true, locale });
  const latestUserSpace = useMemo(() => pickLatestUserSpace(spaces), [spaces]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (latestUserSpace) {
      router.replace(`/${locale}/spaces/${encodeURIComponent(latestUserSpace.id)}`);
      return;
    }

    router.replace(`/${locale}/chat`);
  }, [isLoading, latestUserSpace, locale, router]);

  return <SpaceWorkspaceLoading />;
}
