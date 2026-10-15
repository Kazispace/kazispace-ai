/**
 * Top-level destinations: Chat · Assets · Me (kazispace-ui decisions D2,
 * navigation pattern "Information architecture").
 *
 * Desktop draws them in the icon rail, mobile in the bottom tab bar; both read
 * the destination list and the active one from here so they cannot drift.
 */
import { getSurfacePath } from '@/lib/agent-transition/surfaces';
import { buildClinicHubHref } from '@/lib/hub-entry';

export type TopLevelDestination = 'chat' | 'assets' | 'me';

export const TOP_LEVEL_DESTINATIONS: readonly TopLevelDestination[] = [
  'chat',
  'assets',
  'me',
] as const;

export function topLevelHref(locale: string, destination: TopLevelDestination): string {
  switch (destination) {
    case 'chat':
      return getSurfacePath(locale, 'clinic');
    case 'assets':
      return buildClinicHubHref(locale);
    case 'me':
      return `/${locale}/mine`;
  }
}

/** Me and its sub-pages (plan, credits, profile edit). */
const ME_SEGMENTS = ['mine', 'profile', 'credits', 'ledger', 'subscription'];

/**
 * Which destination a path belongs to. Everything in the workspace that is not
 * Assets or Me is a conversation (main chat, specialists, spaces) and so is Chat.
 */
export function resolveTopLevelDestination(
  pathname: string,
  locale: string
): TopLevelDestination {
  const rest = pathname.startsWith(`/${locale}`) ? pathname.slice(locale.length + 1) : pathname;
  const segments = rest.split('/').filter(Boolean);
  if (segments[0] === 'clinic' && segments[1] === 'hub') return 'assets';
  if (segments[0] && ME_SEGMENTS.includes(segments[0])) return 'me';
  return 'chat';
}

/** Screens reached from a top-level destination; they hide the mobile tab bar. */
const SUB_SCREEN_SEGMENTS = ['profile', 'credits', 'ledger', 'subscription', 'jobs'];

/** True on a top-level screen (Chat, Assets, Me), where the mobile tab bar shows. */
export function isTopLevelScreen(pathname: string, locale: string): boolean {
  const rest = pathname.startsWith(`/${locale}`) ? pathname.slice(locale.length + 1) : pathname;
  const first = rest.split('/').filter(Boolean)[0];
  return !(first && SUB_SCREEN_SEGMENTS.includes(first));
}
