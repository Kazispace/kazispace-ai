/**
 * Top-level destinations: Exam · Radio · Scenes · Messages · Me (KAZI-1485, Owen
 * 2026-11-26; kazispace-ui decisions D36, D38). Exam opens the latest Space with the Space
 * list beside it (D38: its Chat mode is the spaces); Radio is the personal radio's home; Scenes and Messages are their own pages;
 * Studio is no longer a destination: it is the first row of Me and keeps its address,
 * /clinic/hub, as a sub-screen of Me.
 *
 * ❌ Former (D27): Space · Studio · Me.
 *
 * Desktop draws them in the icon rail, mobile in the bottom tab bar; both read
 * the destination list and the active one from here so they cannot drift.
 */
import { buildClinicHubHref } from '@/lib/hub-entry';
import { getSurfacePath } from '@/lib/agent-transition/surfaces';
import { isSpacesEnabled } from '@/lib/spaces/constants';
import { RADIO_SEGMENT, radioHomeHref } from '@/lib/radio/routes';

export type TopLevelDestination = 'exam' | 'radio' | 'scenes' | 'messages' | 'me';

export const TOP_LEVEL_DESTINATIONS: readonly TopLevelDestination[] = [
  'exam',
  'radio',
  'scenes',
  'messages',
  'me',
] as const;

export const SCENES_SEGMENT = 'scenes';
export const MESSAGES_SEGMENT = 'messages';

export function topLevelHref(locale: string, destination: TopLevelDestination): string {
  switch (destination) {
    case 'exam':
      // Exam's Chat mode is the spaces (D38): the latest Space with the Space list beside it,
      // the old Space destination's resolver. With Spaces off, the main chat.
      // ❌ Former (D36): the English Space (`englishSpaceHref`).
      return isSpacesEnabled() ? `/${locale}/spaces` : getSurfacePath(locale, 'clinic');
    case 'radio':
      return radioHomeHref(locale);
    case 'scenes':
      return `/${locale}/${SCENES_SEGMENT}`;
    case 'messages':
      return `/${locale}/${MESSAGES_SEGMENT}`;
    case 'me':
      return `/${locale}/mine`;
  }
}

/** Studio, now a sub-screen of Me (D36): Me's first row opens it, its back link returns to Me. */
export function studioHref(locale: string): string {
  return buildClinicHubHref(locale);
}

/**
 * Plan & credits. Opened from Chat (an upgrade prompt or the paywall) it carries
 * `?return=chat`, so its back link returns to Chat instead of Me (kazispace-ui page
 * header spec, "Back target": back returns to the screen that opened this one).
 */
export function subscriptionHref(
  locale: string,
  opts: { fromChat?: boolean; fromRadio?: boolean } = {}
): string {
  // From the Radio destination's plan line (kazispace-ui D37), back returns to Radio.
  const from = opts.fromChat ? '?return=chat' : opts.fromRadio ? '?return=radio' : '';
  return `/${locale}/subscription${from}`;
}

/** Sub-screens of Me (profile edit, plan, credits). */
const ME_SUB_SCREENS = ['profile', 'credits', 'ledger', 'subscription'];
/** Me and its sub-screens. */
const ME_SEGMENTS = ['mine', ...ME_SUB_SCREENS];

function pathSegments(pathname: string, locale: string): string[] {
  const rest = pathname.startsWith(`/${locale}`) ? pathname.slice(locale.length + 1) : pathname;
  return rest.split('/').filter(Boolean);
}

function isStudioPath(segments: string[]): boolean {
  return segments[0] === 'clinic' && segments[1] === 'hub';
}

/**
 * Which destination a path belongs to. Studio belongs to Me (D36). Everything in the
 * workspace that is not Radio, Scenes, Messages or Me is a conversation (the English
 * Space, the main chat, specialists, other spaces) and so is Exam.
 */
export function resolveTopLevelDestination(
  pathname: string,
  locale: string
): TopLevelDestination {
  const segments = pathSegments(pathname, locale);
  if (isStudioPath(segments)) return 'me';
  if (segments[0] === RADIO_SEGMENT) return 'radio';
  if (segments[0] === SCENES_SEGMENT) return 'scenes';
  if (segments[0] === MESSAGES_SEGMENT) return 'messages';
  if (segments[0] && ME_SEGMENTS.includes(segments[0])) return 'me';
  return 'exam';
}

/** Screens reached from a top-level destination; they hide the mobile tab bar. */
// Derived from ME_SUB_SCREENS so a new Me sub-page cannot be added to only one list.
const SUB_SCREEN_SEGMENTS = [...ME_SUB_SCREENS, 'jobs'];

/**
 * True on a top-level screen (Exam, Radio's home, Scenes, Messages, Me), where the mobile
 * tab bar shows. Studio and the radio's other screens (player, settings, replay) are
 * sub-screens (D36; ❌ former D28: every radio screen, the home included, was one).
 */
export function isTopLevelScreen(pathname: string, locale: string): boolean {
  const segments = pathSegments(pathname, locale);
  const first = segments[0];
  if (isStudioPath(segments)) return false;
  if (first === RADIO_SEGMENT) return segments.length === 1;
  // The interview's report pages (readiness, growth, profile) are pages, not conversations:
  // sub-screens of Exam with their own back link to the interview, so no tab bar and no
  // Chat / Form switch (kazispace-ui Navigation 3.1, Exam 0.2; #314 review). The interview
  // itself, `/interview`, is a conversation.
  if (first === 'interview') return segments.length === 1;
  return !(first && SUB_SCREEN_SEGMENTS.includes(first));
}
