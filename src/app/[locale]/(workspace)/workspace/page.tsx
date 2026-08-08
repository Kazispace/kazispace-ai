import { redirect } from 'next/navigation';

import { buildClinicHubHref } from '@/lib/hub-entry';

interface WorkspaceAliasPageProps {
  params: { locale: string };
  searchParams: Record<string, string | string[] | undefined>;
}

/** Legacy `/{locale}/workspace?asset=…` → canonical Clinic hub (KAZI-490). */
export default function WorkspaceAliasPage({
  params,
  searchParams,
}: WorkspaceAliasPageProps) {
  const rawAsset = searchParams.asset;
  const assetId =
    typeof rawAsset === 'string'
      ? rawAsset
      : Array.isArray(rawAsset)
        ? rawAsset[0]
        : null;
  redirect(buildClinicHubHref(params.locale, assetId));
}
