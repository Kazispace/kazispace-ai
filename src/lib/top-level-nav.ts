/**
 * Top-level destinations: Space · Studio · Me (KAZI-1171, Owen 2026-10-26;
 * kazispace-ui decisions D2, D20). Space opens the spaces resolver, /spaces:
 * the latest Space with the Space list beside it, or the main chat when the
 * user has none. Studio keeps the old Assets address, /clinic/hub, so existing
 * links keep working.
 *
 * Desktop draws them in the icon rail, mobile in the bottom tab bar; both read
 * the destination list and the active one from here so they cannot drift.
 */
import { getSurfacePath } from '@/lib/agent-transition/surfaces';
import { buildClinicHubHref } from '@/lib/hub-entry';
import { isSpacesEnabled } from '@/lib/spaces/constants';

export type TopLevelDestination = 'space' | 'studio' | 'me';

export const TOP_LEVEL_DESTINATIONS: readonly TopLevelDestination[] = [
  'space',
  'studio',
  'me',
] as const;

export function topLevelHref(locale: string, destination: TopLevelDestination): string {
  switch (destination) {
    case 'space':
      // With Spaces off there is no Space list; the main chat is the only conversation.
      return isSpacesEnabled() ? `/${locale}/spaces` : getSurfacePath(locale, 'clinic');
    case 'studio':
      return buildClinicHubHref(locale);
    case 'me':
      return `/${locale}/mine`;
  }
}

/**
 * Plan & credits. Opened from Chat (an upgrade prompt or the paywall) it carries
 * `?return=chat`, so its back link returns to Chat instead of Me (kazispace-ui page
 * header spec, "Back target": back returns to the screen that opened this one).
 */
export function subscriptionHref(locale: string, opts: { fromChat?: boolean } = {}): string {
  return `/${locale}/subscription${opts.fromChat ? '?return=chat' : ''}`;
}

/** Sub-screens of Me (profile edit, plan, credits). */
const ME_SUB_SCREENS = ['profile', 'credits', 'ledger', 'subscription'];
/** Me and its sub-screens. */
const ME_SEGMENTS = ['mine', ...ME_SUB_SCREENS];

/**
 * Which destination a path belongs to. Everything in the workspace that is not
 * Studio or Me is a conversation (main chat, specialists, spaces) and so is Space.
 */
export function resolveTopLevelDestination(
  pathname: string,
  locale: string
): TopLevelDestination {
  const rest = pathname.startsWith(`/${locale}`) ? pathname.slice(locale.length + 1) : pathname;
  const segments = rest.split('/').filter(Boolean);
  if (segments[0] === 'clinic' && segments[1] === 'hub') return 'studio';
  if (segments[0] && ME_SEGMENTS.includes(segments[0])) return 'me';
  return 'space';
}

/** Screens reached from a top-level destination; they hide the mobile tab bar. */
// Derived from ME_SUB_SCREENS so a new Me sub-page cannot be added to only one list.
const SUB_SCREEN_SEGMENTS = [...ME_SUB_SCREENS, 'jobs'];

/** True on a top-level screen (Space, Studio, Me), where the mobile tab bar shows. */
export function isTopLevelScreen(pathname: string, locale: string): boolean {
  const rest = pathname.startsWith(`/${locale}`) ? pathname.slice(locale.length + 1) : pathname;
  const first = rest.split('/').filter(Boolean)[0];
  return !(first && SUB_SCREEN_SEGMENTS.includes(first));
}
