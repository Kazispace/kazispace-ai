/**
 * CV Builder entry URLs — never use `/{locale}/cv` as a user-facing route (KAZI-317).
 */

export const CV_RAIL_QUERY_PARAM = 'cv';

const CV_PATH_SEGMENT = /\/cv(?:\/|$|\?)/;

export function isLegacyCvHubHref(href: string): boolean {
  try {
    const path = href.startsWith('http') ? new URL(href).pathname : href.split('?')[0] ?? href;
    return CV_PATH_SEGMENT.test(path);
  } catch {
    return CV_PATH_SEGMENT.test(href);
  }
}

export function parseJobIdFromHref(href: string): string | null {
  try {
    const url = href.startsWith('http')
      ? new URL(href)
      : new URL(href, 'https://kazispace.local');
    const jobId = url.searchParams.get('job_id');
    return jobId?.trim() || null;
  } catch {
    return null;
  }
}

/** Clinic chat + right CV workspace rail (`?cv=1`). */
export function buildClinicCvRailHref(
  locale: string,
  jobId?: string | null
): string {
  const params = new URLSearchParams();
  params.set(CV_RAIL_QUERY_PARAM, '1');
  if (jobId?.trim()) {
    params.set('job_id', jobId.trim());
  }
  const q = params.toString();
  return `/${locale}/chat${q ? `?${q}` : ''}`;
}

/** Blank / chat-only Space — CV workspace on the right rail (`?cv=1`). */
export function buildSpaceCvRailHref(
  locale: string,
  spaceId: string,
  jobId?: string | null
): string {
  const params = new URLSearchParams();
  params.set(CV_RAIL_QUERY_PARAM, '1');
  if (jobId?.trim()) {
    params.set('job_id', jobId.trim());
  }
  return `/${locale}/spaces/${encodeURIComponent(spaceId)}?${params.toString()}`;
}

/** Job-sprint (and similar) Space — open CV panel on the right. */
export function buildSpaceCvPanelHref(
  locale: string,
  spaceId: string,
  jobId?: string | null
): string {
  const params = new URLSearchParams();
  params.set('panel', 'cv');
  if (jobId?.trim()) {
    params.set('job_id', jobId.trim());
  }
  return `/${locale}/spaces/${encodeURIComponent(spaceId)}?${params.toString()}`;
}

/** Legacy `/cv` bookmarks and BE `path` → Clinic rail entry. */
export function migrateLegacyCvHubHref(locale: string, legacyHref: string): string {
  const jobId = parseJobIdFromHref(legacyHref);
  return buildClinicCvRailHref(locale, jobId);
}
