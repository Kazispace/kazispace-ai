import { Suspense } from 'react';
import { redirect } from 'next/navigation';

import { SpacesIndexPage } from '@/components/spaces/spaces-index-page';
import { SpaceWorkspaceLoading } from '@/components/spaces/space-workspace-states';
import { isSpacesEnabled } from '@/lib/spaces/constants';

export default function SpacesRoutePage({
  params,
}: {
  params: { locale: string };
}) {
  if (!isSpacesEnabled()) {
    redirect(`/${params.locale}/chat`);
  }

  return (
    <Suspense fallback={<SpaceWorkspaceLoading />}>
      <SpacesIndexPage locale={params.locale} />
    </Suspense>
  );
}
