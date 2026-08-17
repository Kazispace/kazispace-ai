import { redirect } from 'next/navigation';

import { CLINIC_SPACE_ID, isSpacesEnabled } from '@/lib/spaces/constants';

/**
 * Workspace chrome lives in `spaces/layout.tsx` (KAZI-573 keep-alive).
 * This page only guards the route.
 */
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

  return null;
}
