import type { SpaceSummary } from '@/types/spaces';

/** `/spaces` with no spaceId — not a workspace route; needs index resolver. */
export function isSpacesIndexPath(path: string): boolean {
  return path === '/spaces';
}

/** Latest non-Clinic user space for `/spaces` → `/spaces/{id}` routing. */
export function pickLatestUserSpace(spaces: SpaceSummary[]): SpaceSummary | null {
  const userSpaces = spaces.filter((space) => !space.is_entry_point);
  if (userSpaces.length === 0) {
    return null;
  }

  return [...userSpaces].sort((a, b) => {
    const aTime = a.last_active_at ?? '';
    const bTime = b.last_active_at ?? '';
    return bTime.localeCompare(aTime);
  })[0] ?? null;
}

/**
 * Latest **active** user space of one template (KAZI-1171): where `/spaces?template=`
 * sends the user, so a second visit reuses it ⛔ creates another one.
 */
export function pickLatestUserSpaceOfTemplate(
  spaces: SpaceSummary[],
  templateId: string
): SpaceSummary | null {
  return pickLatestUserSpace(
    spaces.filter((space) => space.template_id === templateId && space.status === 'active')
  );
}

/** Where the English tutor opens now that `/english` is gone (KAZI-1171). */
export const ENGLISH_SPACE_TEMPLATE_ID = 'ielts_prep';

export function englishSpaceHref(locale: string): string {
  return `/${locale}/spaces?template=${ENGLISH_SPACE_TEMPLATE_ID}`;
}
