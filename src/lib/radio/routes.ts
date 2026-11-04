/**
 * Personal radio routes (KAZI-1209; kazispace-ui personal-radio.md, Screens and back).
 *
 * The radio is a set of sub-screens under `/radio`: the home, a story's player and a program's
 * player. They hide the tab bar and belong to the Studio destination (the desktop rail highlights
 * Studio), see `top-level-nav.ts`.
 */
export const RADIO_SEGMENT = 'radio';

export type RadioFrom = 'studio' | 'home';

export function radioHomeHref(locale: string): string {
  return `/${locale}/${RADIO_SEGMENT}`;
}

/** A story's player. `from=studio` when opened from Studio's continue card: back returns to Studio. */
export function radioStoryHref(locale: string, saveId: string, from: RadioFrom = 'home'): string {
  const q = from === 'studio' ? '?from=studio' : '';
  return `/${locale}/${RADIO_SEGMENT}/story/${encodeURIComponent(saveId)}${q}`;
}

/**
 * Radio settings (Radio settings · Screens and back). Opened from the player it carries the story,
 * so Back returns to it; from the radio home it carries nothing and Back returns home.
 */
export function radioSettingsHref(locale: string, from?: { saveId: string; from: RadioFrom }): string {
  const base = `${radioHomeHref(locale)}/settings`;
  if (!from) return base;
  const qs = new URLSearchParams({ save: from.saveId });
  if (from.from === 'studio') qs.set('from', 'studio');
  return `${base}?${qs.toString()}`;
}

/** Replay of a story (Replay); Back returns to the radio home. */
export function radioReplayHref(locale: string, saveId: string): string {
  return `${radioHomeHref(locale)}/replay/${encodeURIComponent(saveId)}`;
}

export function radioProgramHref(locale: string, programId: string): string {
  return `/${locale}/${RADIO_SEGMENT}/program/${encodeURIComponent(programId)}`;
}

/** D9 / MVP: the radio is offered to a Chinese interface only (the user, 2026-11-03: "For MVP, only support Chinese"). */
export function isRadioLocale(locale: string | null | undefined): boolean {
  const tag = (locale ?? '').trim().toLowerCase().replace('_', '-');
  return tag === 'zh' || tag.startsWith('zh-');
}
