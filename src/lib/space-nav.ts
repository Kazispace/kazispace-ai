import { CLINIC_SPACE_ID, TEMPLATE_EMOJI } from '@/lib/spaces/constants';
import type { SessionNavBadgeKind, SessionNavRow } from '@/lib/session-nav';
import type { SpaceSummary } from '@/types/spaces';

export function getSpaceHref(locale: string, spaceId: string): string {
  if (spaceId === CLINIC_SPACE_ID) {
    return `/${locale}/chat`;
  }
  return `/${locale}/spaces/${encodeURIComponent(spaceId)}`;
}

export function resolveSpaceIdFromPathname(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 3) return null;
  if (segments[1] !== 'spaces') return null;
  try {
    return decodeURIComponent(segments[2]!);
  } catch {
    return segments[2] ?? null;
  }
}

/** True only for `/{locale}/chat` — not dedicated hub routes (`/cv`, `/interview`, `/english`). */
export function isClinicChatPathname(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  return segments.length >= 2 && segments[1] === 'chat';
}

const DEDICATED_HUB_SEGMENTS = new Set(['cv', 'interview', 'english']);

/** Workspace routes that keep the spaces list pinned on desktop (ADR-006). */
export function shouldPinSpacesNavPanel(pathname: string): boolean {
  if (isClinicChatPathname(pathname)) return true;
  if (resolveSpaceIdFromPathname(pathname)) return true;
  const segments = pathname.split('/').filter(Boolean);
  return segments.length >= 2 && DEDICATED_HUB_SEGMENTS.has(segments[1]!);
}

/** Active sidebar row for `/spaces/*` and `/chat` only; null for legacy hub routes. */
export function resolveActiveSpaceNavRowId(pathname: string): string | null {
  const spaceId = resolveSpaceIdFromPathname(pathname);
  if (spaceId) return spaceId;
  if (isClinicChatPathname(pathname)) {
    return CLINIC_SPACE_ID;
  }
  return null;
}

function spaceStatusBadge(status: SpaceSummary['status']): SessionNavBadgeKind | undefined {
  if (status === 'active') return 'inProgress';
  if (status === 'completed') return 'completed';
  if (status === 'archived') return 'archived';
  return undefined;
}

function templateEmoji(templateId: string): string {
  return TEMPLATE_EMOJI[templateId] ?? '✨';
}

function compareSpaces(a: SpaceSummary, b: SpaceSummary): number {
  if (a.is_entry_point !== b.is_entry_point) {
    return a.is_entry_point ? -1 : 1;
  }
  const aTime = a.last_active_at ?? '';
  const bTime = b.last_active_at ?? '';
  return bTime.localeCompare(aTime);
}

export function spaceSummaryToNavRow(
  space: SpaceSummary,
  locale: string,
  clinicLabel: string
): SessionNavRow {
  const isClinic = space.is_entry_point || space.id === CLINIC_SPACE_ID;
  const badge = spaceStatusBadge(space.status);

  return {
    id: space.id,
    agentId: null,
    emoji: space.template_icon ?? templateEmoji(space.template_id),
    displayName: isClinic ? clinicLabel : space.name,
    href: getSpaceHref(locale, space.id),
    // Navigation is href-only (navigateToSessionNavTarget). `surface` stays `clinic`
    // because AgentSurfaceId has no `space` variant yet — legacy field, not routing SSOT.
    surface: 'clinic',
    disabled: false,
    badge,
    badgeDetail: isClinic ? null : space.template_display_name ?? space.template_id,
  };
}

/** Panel rows: Clinic (pinned) + user spaces — ADR-006. */
export function buildSpaceNavRows(
  spaces: SpaceSummary[],
  locale: string,
  clinicLabel: string
): SessionNavRow[] {
  return [...spaces]
    .sort(compareSpaces)
    .map((space) => spaceSummaryToNavRow(space, locale, clinicLabel));
}

export function filterSpaceNavRows(
  rows: SessionNavRow[],
  query: string
): SessionNavRow[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return rows;
  return rows.filter((row) => {
    const haystack = [row.displayName, row.badgeDetail].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(trimmed);
  });
}
