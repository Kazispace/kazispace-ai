import { redirect } from 'next/navigation';

import { buildClinicHubHref } from '@/lib/hub-entry';

interface HubAliasPageProps {
  params: { locale: string };
  searchParams: Record<string, string | string[] | undefined>;
}

/** Legacy `/{locale}/hub` → canonical Clinic hub. */
export default function HubAliasPage({ params, searchParams }: HubAliasPageProps) {
  const rawAsset = searchParams.asset;
  const assetId =
    typeof rawAsset === 'string'
      ? rawAsset
      : Array.isArray(rawAsset)
        ? rawAsset[0]
        : null;
  redirect(buildClinicHubHref(params.locale, assetId));
}
