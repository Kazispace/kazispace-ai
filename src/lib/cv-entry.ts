/**
 * CV Builder entry URLs — never use `/{locale}/cv` as a user-facing route (KAZI-317).
 */

export const CV_RAIL_QUERY_PARAM = 'cv';
/** One-shot deep link: consumed on Clinic load, opens rail then stripped from URL. */
export const CV_OPEN_RAIL_QUERY_PARAM = 'open_cv';

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

export function searchParamsRequestCvRailOpen(params: URLSearchParams): boolean {
  return (
    params.get(CV_OPEN_RAIL_QUERY_PARAM) === '1' ||
    params.get(CV_RAIL_QUERY_PARAM) === '1'
  );
}

export function stripCvRailOpenParams(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  next.delete(CV_OPEN_RAIL_QUERY_PARAM);
  next.delete(CV_RAIL_QUERY_PARAM);
  next.delete('job_id');
  return next;
}

/** True when href targets Clinic chat with a one-shot CV rail open query. */
export function isClinicCvRailOpenHref(locale: string, href: string): boolean {
  try {
    const url = href.startsWith('http')
      ? new URL(href)
      : new URL(href, 'https://kazispace.local');
    if (!searchParamsRequestCvRailOpen(url.searchParams)) return false;
    const path = url.pathname;
    return path === `/${locale}/chat` || path === '/chat';
  } catch {
    return false;
  }
}

/** Clinic chat + open CV right rail once (`?open_cv=1`). */
export function buildClinicCvRailOpenHref(
  locale: string,
  jobId?: string | null
): string {
  const params = new URLSearchParams();
  params.set(CV_OPEN_RAIL_QUERY_PARAM, '1');
  if (jobId?.trim()) {
    params.set('job_id', jobId.trim());
  }
  const q = params.toString();
  return `/${locale}/chat${q ? `?${q}` : ''}`;
}

/** @deprecated Alias of `buildClinicCvRailOpenHref` — rename callers, then remove. */
export function buildClinicCvRailHref(
  locale: string,
  jobId?: string | null
): string {
  return buildClinicCvRailOpenHref(locale, jobId);
}

/** Clinic chat entry without opening the CV rail (session nav, Mine, etc.). */
export function buildClinicChatHref(locale: string): string {
  return `/${locale}/chat`;
}

/** Blank / chat-only Space — open CV rail once (`?open_cv=1`). */
export function buildSpaceCvRailHref(
  locale: string,
  spaceId: string,
  jobId?: string | null
): string {
  const params = new URLSearchParams();
  params.set(CV_OPEN_RAIL_QUERY_PARAM, '1');
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
