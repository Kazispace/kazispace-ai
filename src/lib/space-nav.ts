import { getSpaceHref } from '@/lib/spaces-api';
import { CLINIC_SPACE_ID, TEMPLATE_EMOJI } from '@/lib/spaces/constants';
import type { SessionNavBadgeKind, SessionNavRow } from '@/lib/session-nav';
import type { SpaceSummary } from '@/types/spaces';

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

/** Active sidebar row: clinic id or space id. */
export function resolveActiveSpaceNavRowId(pathname: string): string {
  const spaceId = resolveSpaceIdFromPathname(pathname);
  if (spaceId) return spaceId;
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length >= 2 && segments[1] === 'chat') {
    return CLINIC_SPACE_ID;
  }
  return CLINIC_SPACE_ID;
}

function spaceStatusBadge(status: SpaceSummary['status']): SessionNavBadgeKind | undefined {
  if (status === 'active') return 'inProgress';
  if (status === 'completed') return 'pipeline';
  if (status === 'archived') return 'archived';
  return undefined;
}

function templateEmoji(templateId: string): string {
  return TEMPLATE_EMOJI[templateId] ?? '✨';
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
    surface: isClinic ? 'clinic' : 'clinic',
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
  return spaces.map((space) => spaceSummaryToNavRow(space, locale, clinicLabel));
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
