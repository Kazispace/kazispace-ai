/**
 * Clinic workspace hub routes (KAZI-490).
 *
 * Primary entry: `/{locale}/clinic/hub`
 * Legacy aliases: `/{locale}/hub`, `/{locale}/workspace?asset=…`
 */

export const CLINIC_HUB_ASSET_QUERY_PARAM = 'asset';

export function buildClinicHubHref(
  locale: string,
  assetId?: string | null
): string {
  const base = `/${locale}/clinic/hub`;
  if (!assetId?.trim()) return base;
  const params = new URLSearchParams();
  params.set(CLINIC_HUB_ASSET_QUERY_PARAM, assetId.trim());
  return `${base}?${params.toString()}`;
}

/** Legacy BE `hub_preview_path` → canonical Clinic hub URL. */
export function migrateLegacyWorkspaceHubHref(
  locale: string,
  legacyHref: string
): string {
  try {
    const url = legacyHref.startsWith('http')
      ? new URL(legacyHref)
      : new URL(legacyHref, 'https://kazispace.local');
    const assetId = url.searchParams.get(CLINIC_HUB_ASSET_QUERY_PARAM);
    return buildClinicHubHref(locale, assetId);
  } catch {
    return buildClinicHubHref(locale);
  }
}

export function isClinicHubPathname(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  return segments.length >= 3 && segments[1] === 'clinic' && segments[2] === 'hub';
}

export function isLegacyHubAliasPathname(pathname: string): boolean {
  if (isClinicHubPathname(pathname)) return false;
  const segments = pathname.split('/').filter(Boolean);
  return segments.length >= 2 && (segments[1] === 'hub' || segments[1] === 'workspace');
}

export function stripClinicHubAssetParam(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  next.delete(CLINIC_HUB_ASSET_QUERY_PARAM);
  return next;
}

export function parseClinicHubAssetId(
  params: URLSearchParams
): string | null {
  const raw = params.get(CLINIC_HUB_ASSET_QUERY_PARAM);
  return raw?.trim() || null;
}
