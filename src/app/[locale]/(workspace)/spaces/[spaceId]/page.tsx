import { redirect } from 'next/navigation';

import { SpaceWorkspace } from '@/components/spaces/space-workspace';
import { CLINIC_SPACE_ID, isSpacesEnabled } from '@/lib/spaces/constants';

export default function SpacePage({
  params,
}: {
  params: { locale: string; spaceId: string };
}) {
  if (!isSpacesEnabled()) {
    redirect(`/${params.locale}/chat`);
  }

  if (params.spaceId === CLINIC_SPACE_ID) {
    redirect(`/${params.locale}/chat`);
  }

  return <SpaceWorkspace spaceId={params.spaceId} />;
}
