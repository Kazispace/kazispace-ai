import { isSpacesEnabled } from '@/lib/spaces/constants';
import type { SpaceSummary } from '@/types/spaces';

/** `/spaces` with no spaceId — not a workspace route; needs index resolver. */
export function isSpacesIndexPath(path: string): boolean {
  return path === '/spaces';
}

function latestByActivity(spaces: SpaceSummary[]): SpaceSummary | null {
  return (
    [...spaces].sort((a, b) => {
      const aTime = a.last_active_at ?? '';
      const bTime = b.last_active_at ?? '';
      return bTime.localeCompare(aTime);
    })[0] ?? null
  );
}

/**
 * Where the Space tab (`/spaces`) opens: the latest non-Clinic user Space that is
 * **in progress**, else the latest completed one (still writable). ⛔ Never an archived or
 * deleted Space — archiving bumps `last_active_at`, so the one just archived sorted first
 * and the tab opened 「此空间已归档」 (KAZI-1171 UAT 14213).
 */
export function pickLatestUserSpace(spaces: SpaceSummary[]): SpaceSummary | null {
  const userSpaces = spaces.filter((space) => !space.is_entry_point);
  return (
    latestByActivity(userSpaces.filter((space) => space.status === 'active')) ??
    latestByActivity(userSpaces.filter((space) => space.status === 'completed'))
  );
}

/**
 * Latest **active** user space of one template (KAZI-1171): where `/spaces?template=`
 * sends the user, so a second visit reuses it ⛔ creates another one.
 */
export function pickLatestUserSpaceOfTemplate(
  spaces: SpaceSummary[],
  templateId: string
): SpaceSummary | null {
  return latestByActivity(
    spaces.filter(
      (space) =>
        !space.is_entry_point && space.template_id === templateId && space.status === 'active'
    )
  );
}

/** Where the English tutor opens now that `/english` is gone (KAZI-1171). */
export const ENGLISH_SPACE_TEMPLATE_ID = 'ielts_prep';

/**
 * The user's English Space, or — with Spaces off — the main chat, the same fallback the
 * Space tab uses (`topLevelHref('space')`), since there is no Space to open (#262 review 🟡1).
 */
export function englishSpaceHref(locale: string): string {
  if (!isSpacesEnabled()) return `/${locale}/chat`;
  return `/${locale}/spaces?template=${ENGLISH_SPACE_TEMPLATE_ID}`;
}
